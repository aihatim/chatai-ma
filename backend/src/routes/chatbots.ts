import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient, Channel, ChatbotStatus } from '@prisma/client';
import { z } from 'zod';

const createChatbotSchema = z.object({
  name: z.string().min(1).max(100),
  channel: z.enum(['website', 'whatsapp', 'prospecting']),
  channelId: z.string().optional(),
  personaId: z.string().optional(),
  customSystemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(64).max(8192).optional(),
  fallbackMessageEn: z.string().optional(),
  fallbackMessageFr: z.string().optional(),
  fallbackMessageAr: z.string().optional(),
  fallbackMessageEs: z.string().optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  widgetConfig: z.any().optional(),
  isChameleonEnabled: z.boolean().optional(),
  autoDetectLanguage: z.boolean().optional(),
  supportedLanguages: z.array(z.enum(['en', 'fr', 'ar', 'es'])).optional(),
  hitlEnabled: z.boolean().optional(),
  hitlTriggerConfidence: z.number().min(0).max(1).optional(),
  activeKnowledgeBaseId: z.string().optional(),
});

const updateChatbotSchema = createChatbotSchema.partial();

export default async function (instance: FastifyInstance) {
  const prisma: PrismaClient = instance.prisma;

  instance.addHook('preHandler', instance.authenticate);

  instance.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.userId;
    const { workspaceId, orgId } = request.query as { workspaceId?: string; orgId?: string };

    const where: any = {};

    if (workspaceId) {
      const wm = await prisma.workspaceMember.findFirst({
        where: { workspaceId, userId },
      });
      if (!wm) {
        return reply.status(403).send({
          error: { code: 'FORBIDDEN', message: 'Access denied to this workspace' },
        });
      }
      where.workspaceId = workspaceId;
    } else if (orgId) {
      const om = await prisma.orgMember.findFirst({
        where: { organizationId: orgId, userId },
      });
      if (!om) {
        return reply.status(403).send({
          error: { code: 'FORBIDDEN', message: 'Access denied to this organization' },
        });
      }
      const workspaces = await prisma.workspace.findMany({
        where: { organizationId: orgId },
        select: { id: true },
      });
      where.workspaceId = { in: workspaces.map((w) => w.id) };
    } else {
      const wms = await prisma.workspaceMember.findMany({
        where: { userId },
        select: { workspaceId: true },
      });
      where.workspaceId = { in: wms.map((wm) => wm.workspaceId) };
    }

    const chatbots = await prisma.chatbot.findMany({
      where,
      include: {
        workspace: { select: { id: true, name: true, organizationId: true } },
        knowledgeBase: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const countPromises = chatbots.map((c) =>
      prisma.conversation.count({ where: { chatbotId: c.id } }).then((count) => ({ id: c.id, count })),
    );
    const counts = await Promise.all(countPromises);
    const countMap = new Map(counts.map((c) => [c.id, c.count]));

    return chatbots.map((c) => ({
      id: c.id,
      name: c.name,
      channel: c.channel,
      channelId: c.channelId,
      status: c.status,
      workspace: c.workspace,
      knowledgeBase: c.knowledgeBase,
      temperature: c.temperature,
      maxTokens: c.maxTokens,
      confidenceThreshold: c.confidenceThreshold,
      isChameleonEnabled: c.isChameleonEnabled,
      autoDetectLanguage: c.autoDetectLanguage,
      supportedLanguages: c.supportedLanguages,
      hitlEnabled: c.hitlEnabled,
      totalConversations: c.totalConversations,
      avgResponseTimeMs: c.avgResponseTimeMs,
      satisfactionScore: c.satisfactionScore,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      conversationCount: countMap.get(c.id) || 0,
    }));
  });

  instance.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createChatbotSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const userId = request.user!.userId;
    const data = parsed.data;

    if (!data.channelId) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'channelId is required' },
      });
    }

    const channel = data.channel as Channel;

    if (channel === 'website') {
      const wc = await prisma.websiteChannel.findUnique({ where: { id: data.channelId } });
      if (!wc) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Website channel not found' },
        });
      }
      if (!request.user!.workspaceId || request.user!.workspaceId !== wc.workspaceId) {
        const wm = await prisma.workspaceMember.findFirst({
          where: { workspaceId: wc.workspaceId, userId },
        });
        if (!wm) {
          return reply.status(403).send({
            error: { code: 'FORBIDDEN', message: 'Access denied to this channel' },
          });
        }
      }
    } else if (channel === 'whatsapp') {
      const wa = await prisma.whatsAppChannel.findUnique({ where: { id: data.channelId } });
      if (!wa) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'WhatsApp channel not found' },
        });
      }
      if (!request.user!.workspaceId || request.user!.workspaceId !== wa.workspaceId) {
        const wm = await prisma.workspaceMember.findFirst({
          where: { workspaceId: wa.workspaceId, userId },
        });
        if (!wm) {
          return reply.status(403).send({
            error: { code: 'FORBIDDEN', message: 'Access denied to this channel' },
          });
        }
      }
    }

    const chatbot = await prisma.chatbot.create({
      data: {
        name: data.name,
        channel: data.channel as Channel,
        channelId: data.channelId,
        workspaceId: request.user!.workspaceId || '',
        personaId: data.personaId,
        customSystemPrompt: data.customSystemPrompt,
        temperature: data.temperature,
        maxTokens: data.maxTokens,
        fallbackMessageEn: data.fallbackMessageEn,
        fallbackMessageFr: data.fallbackMessageFr,
        fallbackMessageAr: data.fallbackMessageAr,
        fallbackMessageEs: data.fallbackMessageEs,
        confidenceThreshold: data.confidenceThreshold,
        widgetConfig: data.widgetConfig,
        isChameleonEnabled: data.isChameleonEnabled,
        autoDetectLanguage: data.autoDetectLanguage,
        supportedLanguages: data.supportedLanguages || ['en', 'fr', 'ar', 'es'],
        hitlEnabled: data.hitlEnabled,
        hitlTriggerConfidence: data.hitlTriggerConfidence,
        activeKnowledgeBaseId: data.activeKnowledgeBaseId,
      },
      include: {
        workspace: { select: { id: true, name: true } },
      },
    });

    return reply.status(201).send(chatbot);
  });

  instance.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.userId;

    const chatbot = await prisma.chatbot.findUnique({
      where: { id },
      include: {
        workspace: { select: { id: true, name: true, organizationId: true } },
        knowledgeBase: { select: { id: true, name: true, status: true, totalDocuments: true } },
        websiteChannel: { select: { id: true, name: true, domain: true, isActive: true } },
        whatsappChannel: { select: { id: true, name: true, phoneNumber: true, isActive: true } },
      },
    });

    if (!chatbot) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Chatbot not found' },
      });
    }

    const wm = await prisma.workspaceMember.findFirst({
      where: { workspaceId: chatbot.workspaceId, userId },
    });
    if (!wm) {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'Access denied to this chatbot' },
      });
    }

    return chatbot;
  });

  instance.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.userId;

    const chatbot = await prisma.chatbot.findUnique({ where: { id } });
    if (!chatbot) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Chatbot not found' },
      });
    }

    const wm = await prisma.workspaceMember.findFirst({
      where: { workspaceId: chatbot.workspaceId, userId },
    });
    if (!wm || (wm.role !== 'admin' && wm.role !== 'owner' && wm.role !== 'website_editor')) {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'You do not have permission to update this chatbot' },
      });
    }

    const parsed = updateChatbotSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const updated = await prisma.chatbot.update({
      where: { id },
      data: parsed.data as any,
    });

    return updated;
  });

  instance.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.userId;

    const chatbot = await prisma.chatbot.findUnique({ where: { id } });
    if (!chatbot) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Chatbot not found' },
      });
    }

    const wm = await prisma.workspaceMember.findFirst({
      where: { workspaceId: chatbot.workspaceId, userId },
    });
    if (!wm || (wm.role !== 'admin' && wm.role !== 'owner')) {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'Only workspace admins can delete chatbots' },
      });
    }

    await prisma.chatbot.delete({ where: { id } });

    return reply.status(204).send();
  });

  instance.post('/:id/activate', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.userId;

    const chatbot = await prisma.chatbot.findUnique({ where: { id } });
    if (!chatbot) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Chatbot not found' },
      });
    }

    const wm = await prisma.workspaceMember.findFirst({
      where: { workspaceId: chatbot.workspaceId, userId },
    });
    if (!wm || (wm.role !== 'admin' && wm.role !== 'owner')) {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'Only workspace admins can activate chatbots' },
      });
    }

    if (chatbot.status === 'Active') {
      return reply.status(400).send({
        error: { code: 'ALREADY_ACTIVE', message: 'Chatbot is already active' },
      });
    }

    const updated = await prisma.chatbot.update({
      where: { id },
      data: { status: 'Active' as ChatbotStatus },
    });

    return { ...updated, message: 'Chatbot activated successfully' };
  });

  instance.post('/:id/pause', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.userId;

    const chatbot = await prisma.chatbot.findUnique({ where: { id } });
    if (!chatbot) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Chatbot not found' },
      });
    }

    const wm = await prisma.workspaceMember.findFirst({
      where: { workspaceId: chatbot.workspaceId, userId },
    });
    if (!wm || (wm.role !== 'admin' && wm.role !== 'owner')) {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'Only workspace admins can pause chatbots' },
      });
    }

    if (chatbot.status !== 'Active') {
      return reply.status(400).send({
        error: { code: 'NOT_ACTIVE', message: 'Chatbot is not currently active' },
      });
    }

    const updated = await prisma.chatbot.update({
      where: { id },
      data: { status: 'Paused' as ChatbotStatus },
    });

    return { ...updated, message: 'Chatbot paused successfully' };
  });
}
