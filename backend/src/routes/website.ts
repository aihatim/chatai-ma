import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { handleChatMessageStreaming, ChatResponse } from '../services/chat-engine';
import { detectLanguage, isDarija, getScriptDirection } from '../services/language';

export default async function (app: FastifyInstance) {
  app.post('/:embedToken/chat', async (req, reply) => {
    const { embedToken } = req.params as { embedToken: string };
    const { message, sessionId, customer } = req.body as {
      message: string;
      sessionId: string;
      customer?: { name?: string; email?: string; phone?: string };
    };

    if (!message || !sessionId) {
      return reply.status(400).send({ error: 'message and sessionId are required' });
    }

    const channel = await prisma.websiteChannel.findUnique({
      where: { embedToken },
      include: {
        chatbots: {
          where: { status: 'Active' },
          include: { knowledgeBase: true },
          take: 1,
        },
      },
    });

    if (!channel || !channel.isActive) {
      return reply.status(404).send({ error: 'Website channel not found or inactive' });
    }

    const chatbot = channel.chatbots[0];
    if (!chatbot) {
      return reply.status(404).send({ error: 'No active chatbot for this channel' });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    try {
      const stream = handleChatMessageStreaming(
        channel.workspaceId,
        chatbot.id,
        'website',
        message,
        sessionId,
        customer
      );

      for await (const token of stream) {
        if (token === '__context_loaded__') continue;
        const safeToken = token.replace(/\n/g, '\\n').replace(/\r/g, '');
        reply.raw.write(`data: ${safeToken}\n\n`);
      }

      const result = await stream.return(undefined as any);

      if (result?.value) {
        const meta = result.value as unknown as ChatResponse;
        reply.raw.write(
          `data: __done__\nevent: metadata\ndata: ${JSON.stringify({
            confidence: meta.confidence,
            citations: meta.citations,
            language: meta.language,
            isDarija: meta.isDarija,
          })}\n\n`
        );
      }

      reply.raw.write('data: [DONE]\n\n');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      reply.raw.write(`data: __error__\ndata: ${JSON.stringify({ error: errorMessage })}\n\n`);
    } finally {
      reply.raw.end();
    }
  });

  app.get('/:embedToken/config', async (req, reply) => {
    const { embedToken } = req.params as { embedToken: string };

    const channel = await prisma.websiteChannel.findUnique({
      where: { embedToken },
      include: {
        chatbots: {
          where: { status: 'Active' },
          take: 1,
          select: {
            id: true,
            name: true,
            widgetConfig: true,
            supportedLanguages: true,
            autoDetectLanguage: true,
            fallbackMessageEn: true,
            fallbackMessageFr: true,
            fallbackMessageAr: true,
            fallbackMessageEs: true,
          },
        },
      },
    });

    if (!channel || !channel.isActive) {
      return reply.status(404).send({ error: 'Widget not found' });
    }

    const chatbot = channel.chatbots[0];
    if (!chatbot) {
      return reply.status(404).send({ error: 'No active chatbot' });
    }

    const lang = 'en';

    return {
      name: chatbot.name,
      widgetConfig: chatbot.widgetConfig || channel.widgetConfig || {},
      supportedLanguages: chatbot.supportedLanguages,
      autoDetectLanguage: chatbot.autoDetectLanguage,
      direction: getScriptDirection(lang),
      fallbackMessage:
        chatbot.fallbackMessageEn ||
        "Hi! How can I help you today?",
    };
  });

  app.post('/:embedToken/feedback', async (req, reply) => {
    const { embedToken } = req.params as { embedToken: string };
    const { sessionId, rating, comment } = req.body as {
      sessionId: string;
      rating: 'positive' | 'negative';
      comment?: string;
    };

    if (!sessionId || !rating) {
      return reply.status(400).send({ error: 'sessionId and rating are required' });
    }

    const channel = await prisma.websiteChannel.findUnique({
      where: { embedToken },
    });

    if (!channel) {
      return reply.status(404).send({ error: 'Channel not found' });
    }

    const conversation = await prisma.conversation.findFirst({
      where: { sessionId, workspaceId: channel.workspaceId },
    });

    if (!conversation) {
      return reply.status(404).send({ error: 'Conversation not found' });
    }

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { satisfactionRating: rating },
    });

    if (comment) {
      console.log(`[feedback] ${conversation.id}: ${rating} - ${comment}`);
    }

    return { success: true };
  });

  app.addHook('preHandler', async (req, reply) => {
    if (req.method === 'OPTIONS') {
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Content-Type');
      reply.status(204).send();
    }
  });
}
