import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  defaultLanguage: z.enum(['en', 'fr', 'ar', 'es']).optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
});

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  defaultLanguage: z.enum(['en', 'fr', 'ar', 'es']).optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
});

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'website_editor', 'whatsapp_agent', 'sales_manager', 'sales_rep', 'analyst', 'api_consumer']),
});

export default async function (instance: FastifyInstance) {
  const prisma: PrismaClient = instance.prisma;

  instance.addHook('preHandler', instance.authenticate);

  instance.get('/:orgId/workspaces', async (request: FastifyRequest, reply: FastifyReply) => {
    const { orgId } = request.params as { orgId: string };
    const userId = request.user!.userId;

    const orgMember = await prisma.orgMember.findFirst({
      where: { organizationId: orgId, userId },
    });
    if (!orgMember) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Organization not found' },
      });
    }

    const workspaces = await prisma.workspace.findMany({
      where: { organizationId: orgId },
      include: {
        _count: { select: { members: true, chatbots: true, conversations: true } },
        members: {
          where: { userId },
          select: { role: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
      organizationId: w.organizationId,
      defaultLanguage: w.defaultLanguage,
      timezone: w.timezone,
      currency: w.currency,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      memberCount: w._count.members,
      chatbotCount: w._count.chatbots,
      conversationCount: w._count.conversations,
      role: w.members[0]?.role || null,
    }));
  });

  instance.post('/:orgId/workspaces', async (request: FastifyRequest, reply: FastifyReply) => {
    const { orgId } = request.params as { orgId: string };
    const userId = request.user!.userId;

    const orgMember = await prisma.orgMember.findFirst({
      where: { organizationId: orgId, userId },
    });
    if (!orgMember) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Organization not found' },
      });
    }

    if (orgMember.role !== 'owner' && orgMember.role !== 'admin') {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'Only owners and admins can create workspaces' },
      });
    }

    const parsed = createWorkspaceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const { name, defaultLanguage, timezone, currency } = parsed.data;

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();

    const workspace = await prisma.workspace.create({
      data: {
        organizationId: orgId,
        name,
        slug,
        ...(defaultLanguage && { defaultLanguage }),
        ...(timezone && { timezone }),
        ...(currency && { currency }),
      },
    });

    await prisma.workspaceMember.create({
      data: { workspaceId: workspace.id, userId, role: 'admin' },
    });

    return reply.status(201).send(workspace);
  });

  instance.get('/:orgId/workspaces/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { orgId, id } = request.params as { orgId: string; id: string };
    const userId = request.user!.userId;

    const orgMember = await prisma.orgMember.findFirst({
      where: { organizationId: orgId, userId },
    });
    if (!orgMember) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Organization not found' },
      });
    }

    const workspace = await prisma.workspace.findFirst({
      where: { id, organizationId: orgId },
      include: {
        _count: { select: { members: true, chatbots: true, conversations: true, knowledgeBases: true, customers: true } },
        members: {
          where: { userId },
          select: { role: true },
        },
      },
    });

    if (!workspace) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Workspace not found' },
      });
    }

    return {
      ...workspace,
      _count: undefined,
      members: undefined,
      stats: workspace._count,
      role: workspace.members[0]?.role || null,
    };
  });

  instance.patch('/:orgId/workspaces/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { orgId, id } = request.params as { orgId: string; id: string };
    const userId = request.user!.userId;

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId: id, userId },
    });
    if (!workspaceMember) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Workspace not found' },
      });
    }

    if (workspaceMember.role !== 'admin') {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'Only workspace admins can update the workspace' },
      });
    }

    const parsed = updateWorkspaceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const workspace = await prisma.workspace.update({
      where: { id },
      data: parsed.data,
    });

    return workspace;
  });

  instance.get('/:orgId/workspaces/:id/members', async (request: FastifyRequest, reply: FastifyReply) => {
    const { orgId, id } = request.params as { orgId: string; id: string };
    const userId = request.user!.userId;

    const orgMember = await prisma.orgMember.findFirst({
      where: { organizationId: orgId, userId },
    });
    if (!orgMember) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Organization not found' },
      });
    }

    const workspace = await prisma.workspace.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!workspace) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Workspace not found' },
      });
    }

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: id },
      include: {
        user: { select: { id: true, email: true, name: true, imageUrl: true } },
      },
      orderBy: { user: { name: 'asc' } },
    });

    return members.map((m) => ({
      id: m.id,
      role: m.role,
      user: m.user,
    }));
  });

  instance.post('/:orgId/workspaces/:id/members', async (request: FastifyRequest, reply: FastifyReply) => {
    const { orgId, id } = request.params as { orgId: string; id: string };
    const userId = request.user!.userId;

    const requesterMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId: id, userId },
    });
    if (!requesterMember || (requesterMember.role !== 'admin' && requesterMember.role !== 'owner')) {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'Only workspace admins can add members' },
      });
    }

    const workspace = await prisma.workspace.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!workspace) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Workspace not found' },
      });
    }

    const parsed = addMemberSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const { email, role } = parsed.data;

    const targetUser = await prisma.user.findUnique({ where: { email } });
    if (!targetUser) {
      return reply.status(404).send({
        error: { code: 'USER_NOT_FOUND', message: 'No user found with this email' },
      });
    }

    const orgMember = await prisma.orgMember.findFirst({
      where: { organizationId: orgId, userId: targetUser.id },
    });
    if (!orgMember) {
      return reply.status(400).send({
        error: { code: 'NOT_ORG_MEMBER', message: 'User must be a member of the organization first' },
      });
    }

    const existingMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: id, userId: targetUser.id } },
    });
    if (existingMember) {
      return reply.status(409).send({
        error: { code: 'ALREADY_MEMBER', message: 'User is already a member of this workspace' },
      });
    }

    const member = await prisma.workspaceMember.create({
      data: { workspaceId: id, userId: targetUser.id, role },
      include: {
        user: { select: { id: true, email: true, name: true, imageUrl: true } },
      },
    });

    return reply.status(201).send({
      id: member.id,
      role: member.role,
      user: member.user,
    });
  });
}
