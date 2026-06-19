import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma, redis } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import {
  validateWebhookSignature,
  decryptToken,
  encryptToken,
  sendText,
  sendTemplate,
  sendImage,
  sendInteractive,
  markAsRead,
  getMediaUrl,
  detectLanguage,
  hashPhone,
  sendCarousel,
  sendDocument,
  transcribeVoice,
  sendProactiveAlert,
  generateQRCode,
} from '../services/whatsapp';

const WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'chatai-verify-token';
const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET || '';

function getAppSecret(channel: { accessTokenEncrypted: string; verifyToken: string }): string {
  return channel.verifyToken || WHATSAPP_APP_SECRET;
}

export default async function (instance: FastifyInstance) {
  instance.addContentTypeParser('application/json', {
    parseAs: 'buffer',
    bodyLimit: 10 * 1024 * 1024,
  }, async (request: FastifyRequest, body: Buffer) => {
    (request as unknown as Record<string, unknown>).rawBody = body.toString('utf8');
    return JSON.parse(body.toString('utf8'));
  });

  instance.get('/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
      return reply.type('text/plain').send(challenge);
    }
    return reply.status(403).send({ error: { code: 'VERIFICATION_FAILED', message: 'Invalid verify token' } });
  });

  instance.post('/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const rawBody = (request as unknown as Record<string, unknown>).rawBody as string;
      const signature = request.headers['x-hub-signature-256'] as string;
      if (!signature) {
        return reply.status(401).send({ error: { code: 'MISSING_SIGNATURE', message: 'No signature header' } });
      }

      const entry = (request.body as Record<string, unknown>).entry as Record<string, unknown>[];
      if (!entry || entry.length === 0) {
        return reply.status(200).send({ status: 'ok' });
      }

      for (const changeEntry of entry) {
        const changes = changeEntry.changes as Record<string, unknown>[] || [];
        for (const change of changes) {
          const value = change.value as Record<string, unknown> || {};
          const metadata = value.metadata as Record<string, string> || {};
          const phoneNumberId = metadata.phone_number_id;
          if (!phoneNumberId) continue;

          const channel = await prisma.whatsAppChannel.findFirst({
            where: { phoneNumberId, isActive: true },
            include: { workspace: true },
          });
          if (!channel) continue;
          const appSecret = getAppSecret(channel);
          if (!validateWebhookSignature(signature.replace('sha256=', ''), rawBody, appSecret)) {
            continue;
          }
          const accessToken = decryptToken(channel.accessTokenEncrypted);

          if (value.statuses) {
            for (const status of value.statuses as Record<string, unknown>[]) {
              const messageId = status.id as string;
              const statusType = status.status as string;
              const dedupKey = `wa:status:${messageId}`;
              const exists = await redis.set(dedupKey, '1', 'EX', 86400, 'NX');
              if (!exists) continue;

              await prisma.message.updateMany({
                where: { whatsappMessageId: messageId },
                data: { content: statusType === 'failed' ? `[${statusType}] ${(status.errors as Record<string, unknown>[])?.[0]?.message || 'Unknown error'}` : `[${statusType}]` },
              });
            }
          }

          if (value.messages) {
            for (const msg of value.messages as Record<string, unknown>[]) {
              const messageId = msg.id as string;
              const dedupKey = `wa:msg:${messageId}`;
              const exists = await redis.set(dedupKey, '1', 'EX', 86400, 'NX');
              if (!exists) continue;

              const from = msg.from as string;
              const msgType = msg.type as string;
              const timestamp = parseInt(msg.timestamp as string, 10) * 1000;
              const contactProfile = (value.contacts as Record<string, unknown>[])?.[0]?.profile as Record<string, string> | undefined;
              const contactName = contactProfile?.name || from;

              let textContent = '';
              let mediaUrl: string | undefined;
              if (msgType === 'text') {
                textContent = (msg.text as Record<string, string>).body || '';
              } else if (msgType === 'image') {
                const image = msg.image as Record<string, string>;
                textContent = image.caption || '[Image]';
                mediaUrl = await getMediaUrl(image.id, accessToken).catch(() => undefined);
              } else if (msgType === 'audio' || msgType === 'voice') {
                const audio = (msg.audio || msg.voice) as Record<string, string> | undefined;
                if (audio?.id) {
                  mediaUrl = await getMediaUrl(audio.id, accessToken).catch(() => undefined);
                  textContent = await transcribeVoice(audio.id, accessToken).catch(() => '[Audio]');
                } else {
                  textContent = '[Audio]';
                }
              } else if (msgType === 'document') {
                textContent = '[Document]';
              } else if (msgType === 'button') {
                textContent = (msg.button as Record<string, string>).text || '[Button Reply]';
              } else if (msgType === 'interactive') {
                const interactive = msg.interactive as Record<string, unknown>;
                const buttonReply = interactive.button_reply as Record<string, string> | undefined;
                const listReply = interactive.list_reply as Record<string, string> | undefined;
                textContent = buttonReply?.title || listReply?.title || '[Interactive Response]';
              } else {
                textContent = `[${msgType} message]`;
              }

              const lang = await detectLanguage(textContent);

              let customer = await prisma.customer.findFirst({
                where: { workspaceId: channel.workspaceId, phone: from },
              });
              if (!customer) {
                customer = await prisma.customer.create({
                  data: {
                    workspaceId: channel.workspaceId,
                    phone: from,
                    phoneHash: hashPhone(from),
                    name: contactName,
                    firstSeenChannel: 'whatsapp',
                    lastSeenChannel: 'whatsapp',
                    preferredLanguage: lang.language as 'en' | 'fr' | 'ar' | 'es',
                  },
                });
              } else {
                await prisma.customer.update({
                  where: { id: customer.id },
                  data: { lastSeenAt: new Date(), lastSeenChannel: 'whatsapp', name: contactName || customer.name },
                });
              }

              let conversation = await prisma.conversation.findFirst({
                where: { workspaceId: channel.workspaceId, channelId: channel.id, customerPhone: from, status: 'Active' },
              });
              if (!conversation) {
                conversation = await prisma.conversation.create({
                  data: {
                    workspaceId: channel.workspaceId,
                    channel: 'whatsapp',
                    channelId: channel.id,
                    customerId: customer.id,
                    customerPhone: from,
                    customerPhoneHash: hashPhone(from),
                    sessionId: `wa-${channel.id}-${from}`,
                    userLanguage: lang.language as 'en' | 'fr' | 'ar' | 'es',
                  },
                });
              }

              await prisma.message.create({
                data: {
                  conversationId: conversation.id,
                  role: 'user',
                  content: textContent,
                  whatsappMessageId: messageId,
                  whatsappMessageType: msgType,
                  detectedLanguage: lang.language as 'en' | 'fr' | 'ar' | 'es',
                  isDarija: lang.isDarija,
                },
              });

              await prisma.conversation.update({
                where: { id: conversation.id },
                data: { lastMessageAt: new Date(), messageCount: { increment: 1 } },
              });

              await markAsRead(messageId, phoneNumberId, accessToken);

              let chatbot = await prisma.chatbot.findFirst({
                where: { workspaceId: channel.workspaceId, channel: 'whatsapp', channelId: channel.id, status: 'Active' },
                include: { knowledgeBase: true },
              });

              if (chatbot) {
                try {
                  const startTime = Date.now();
                  const aiResponse = await generateChatResponse(textContent, conversation, chatbot, channel);
                  const responseTimeMs = Date.now() - startTime;

                  const sent = await sendText(from, aiResponse, false, phoneNumberId, accessToken);
                  const waMessageId = (sent.messages as Record<string, unknown>[])?.[0]?.id as string | undefined;

                  await prisma.message.create({
                    data: {
                      conversationId: conversation.id,
                      role: 'assistant',
                      content: aiResponse,
                      whatsappMessageId: waMessageId,
                      whatsappMessageType: 'text',
                      detectedLanguage: lang.language as 'en' | 'fr' | 'ar' | 'es',
                      responseTimeMs,
                      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
                    },
                  });
                } catch (err: unknown) {
                  const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                  const fallback = getFallbackMessage(chatbot, lang.language);
                  if (fallback) {
                    await sendText(from, fallback, false, phoneNumberId, accessToken);
                  }
                  await prisma.message.create({
                    data: {
                      conversationId: conversation.id,
                      role: 'assistant',
                      content: `[AI Error: ${errorMessage}]`,
                      whatsappMessageType: 'text',
                      detectedLanguage: lang.language as 'en' | 'fr' | 'ar' | 'es',
                    },
                  });
                }
              }
            }
          }
        }
      }
      return reply.status(200).send({ status: 'ok' });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      request.log.error({ error: errorMessage }, 'WhatsApp webhook error');
      return reply.status(200).send({ status: 'ok' });
    }
  });

  instance.get('/channels', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const channels = await prisma.whatsAppChannel.findMany({
      where: { workspaceId: request.workspaceId },
      select: { id: true, name: true, phoneNumber: true, phoneNumberId: true, isConnected: true, isActive: true, totalConversations: true, totalMessages: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return { data: channels };
  });

  instance.post('/channels', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, phoneNumber, phoneNumberId, businessAccountId, accessToken, verifyToken } = request.body as Record<string, string>;
    if (!name || !phoneNumber || !phoneNumberId || !businessAccountId || !accessToken) {
      return reply.status(400).send({ error: { code: 'MISSING_FIELDS', message: 'name, phoneNumber, phoneNumberId, businessAccountId, accessToken are required' } });
    }

    const existing = await prisma.whatsAppChannel.findFirst({
      where: { workspaceId: request.workspaceId, phoneNumberId },
    });
    if (existing) {
      return reply.status(409).send({ error: { code: 'ALREADY_EXISTS', message: 'This phone number is already connected' } });
    }

    const channel = await prisma.whatsAppChannel.create({
      data: {
        workspaceId: request.workspaceId!,
        name,
        phoneNumber,
        phoneNumberId,
        businessAccountId,
        verifyToken: verifyToken || '',
        accessTokenEncrypted: encryptToken(accessToken),
        isConnected: true,
      },
    });

    return reply.status(201).send({
      data: {
        id: channel.id,
        name: channel.name,
        phoneNumber: channel.phoneNumber,
        phoneNumberId: channel.phoneNumberId,
        isConnected: channel.isConnected,
      },
    });
  });

  instance.delete('/channels/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;
    const channel = await prisma.whatsAppChannel.findFirst({
      where: { id, workspaceId: request.workspaceId },
    });
    if (!channel) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Channel not found' } });
    }
    await prisma.whatsAppChannel.update({
      where: { id },
      data: { isActive: false, isConnected: false },
    });
    return { status: 'disconnected' };
  });

  instance.post('/channels/:id/test', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;
    const channel = await prisma.whatsAppChannel.findFirst({
      where: { id, workspaceId: request.workspaceId, isActive: true },
    });
    if (!channel) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Channel not found or inactive' } });
    }

    const owner = await prisma.user.findUnique({ where: { id: request.user!.userId } });
    if (!owner?.name) {
      return reply.status(400).send({ error: { code: 'NO_OWNER_PHONE', message: 'User has no phone number configured' } });
    }

    const accessToken = decryptToken(channel.accessTokenEncrypted);
    const result = await sendText(
      request.body ? (request.body as Record<string, string>).testNumber || owner.name : owner.name,
      '🧪 This is a test message from your ChatAi.ma WhatsApp channel. Your connection is working!',
      false,
      channel.phoneNumberId,
      accessToken,
    );

    return { data: result, message: 'Test message sent' };
  });

  instance.post('/channels/:id/generate-qr', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;
    const channel = await prisma.whatsAppChannel.findFirst({
      where: { id, workspaceId: request.workspaceId, isActive: true },
    });
    if (!channel) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Channel not found or inactive' } });
    }
    const qr = generateQRCode(channel.phoneNumber);
    return { data: qr };
  });

  instance.post('/channels/:id/send-carousel', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;
    const { to, products } = request.body as { to: string; products: Array<{ title: string; description: string; imageUrl: string; linkUrl: string }> };
    if (!to || !products?.length) {
      return reply.status(400).send({ error: { code: 'MISSING_FIELDS', message: 'to and products are required' } });
    }
    const channel = await prisma.whatsAppChannel.findFirst({
      where: { id, workspaceId: request.workspaceId, isActive: true },
    });
    if (!channel) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Channel not found or inactive' } });
    }
    const accessToken = decryptToken(channel.accessTokenEncrypted);
    const result = await sendCarousel(to, products, 'en', channel.phoneNumberId, accessToken);
    return { data: result };
  });

  instance.post('/channels/:id/send-document', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;
    const channel = await prisma.whatsAppChannel.findFirst({
      where: { id, workspaceId: request.workspaceId, isActive: true },
    });
    if (!channel) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Channel not found or inactive' } });
    }
    const accessToken = decryptToken(channel.accessTokenEncrypted);

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: { code: 'MISSING_FILE', message: 'File is required' } });
    }

    const buffer = await data.toBuffer();
    const maxSize = 16 * 1024 * 1024;
    if (buffer.length > maxSize) {
      return reply.status(400).send({ error: { code: 'FILE_TOO_LARGE', message: `File exceeds 16MB limit (${(buffer.length / (1024 * 1024)).toFixed(1)}MB)` } });
    }

    const to = (data.fields?.to as unknown as { value: string })?.value || '';
    const caption = (data.fields?.caption as unknown as { value: string })?.value || undefined;
    if (!to) {
      return reply.status(400).send({ error: { code: 'MISSING_FIELDS', message: 'to field is required' } });
    }

    const filename = data.filename || 'document';
    const uploadsDir = './uploads/whatsapp';
    const fs = await import('fs');
    const path = await import('path');
    fs.mkdirSync(uploadsDir, { recursive: true });
    const filePath = path.join(uploadsDir, `${Date.now()}-${filename}`);
    fs.writeFileSync(filePath, buffer);

    const result = await sendDocument(to, `file://${filePath}`, filename, channel.phoneNumberId, accessToken, caption);

    fs.unlinkSync(filePath);

    return { data: result };
  });

  instance.post('/channels/:id/proactive-alert', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;
    const { to, alertType, data } = request.body as { to: string; alertType: 'order_confirmation' | 'shipping_update' | 'abandoned_cart' | 'appointment_reminder'; data: Record<string, string> };
    if (!to || !alertType) {
      return reply.status(400).send({ error: { code: 'MISSING_FIELDS', message: 'to and alertType are required' } });
    }
    const channel = await prisma.whatsAppChannel.findFirst({
      where: { id, workspaceId: request.workspaceId, isActive: true },
    });
    if (!channel) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Channel not found or inactive' } });
    }
    const accessToken = decryptToken(channel.accessTokenEncrypted);
    const result = await sendProactiveAlert(to, alertType, data || {}, channel.phoneNumberId, accessToken);
    return { data: result };
  });

  instance.post('/channels/:id/broadcast', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;
    const { templateName, language, components } = request.body as { templateName: string; language?: string; components?: Record<string, unknown>[] };
    if (!templateName) {
      return reply.status(400).send({ error: { code: 'MISSING_FIELDS', message: 'templateName is required' } });
    }
    const channel = await prisma.whatsAppChannel.findFirst({
      where: { id, workspaceId: request.workspaceId, isActive: true },
    });
    if (!channel) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Channel not found or inactive' } });
    }
    const accessToken = decryptToken(channel.accessTokenEncrypted);

    const optedIn = await prisma.customer.findMany({
      where: { workspaceId: channel.workspaceId, isBlacklisted: false, phone: { not: null } },
      select: { phone: true },
    });

    const lang = language || 'en';
    const broadcastKey = `wa:broadcast:${id}`;
    const broadcastCount = parseInt(await redis.get(broadcastKey) || '0', 10);
    const maxPerHour = 1000;
    const remaining = maxPerHour - broadcastCount;

    if (remaining <= 0) {
      return reply.status(429).send({ error: { code: 'RATE_LIMITED', message: 'Broadcast rate limit exceeded (max 1000/hour)' } });
    }

    const toProcess = optedIn.slice(0, remaining);
    let sent = 0;
    let failed = 0;

    for (const contact of toProcess) {
      try {
        if (!contact.phone) continue;
        await sendTemplate(contact.phone, templateName, lang, channel.phoneNumberId, accessToken, components);
        sent++;
      } catch {
        failed++;
      }
    }

    await redis.set(broadcastKey, (broadcastCount + sent + failed).toString(), 'EX', 3600);

    return { sent, failed, total: optedIn.length, processed: toProcess.length };
  });
}

function getFallbackMessage(chatbot: Record<string, unknown>, language: string): string | null {
  const key = `fallbackMessage${language.charAt(0).toUpperCase() + language.slice(1)}` as keyof typeof chatbot;
  return (chatbot[key] as string) || null;
}

async function generateChatResponse(
  userMessage: string,
  conversation: Record<string, unknown>,
  chatbot: Record<string, unknown>,
  channel: Record<string, unknown>,
): Promise<string> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const recentMessages = await prisma.message.findMany({
    where: { conversationId: conversation.id as string },
    orderBy: { createdAt: 'asc' },
    take: 20,
    select: { role: true, content: true },
  });

  const systemPrompt = (chatbot.customSystemPrompt as string) ||
    `You are a helpful AI assistant for the company. Answer questions professionally and conversationally.
     Current language: ${(conversation as Record<string, unknown>).userLanguage || 'fr'}.
     Respond in the same language as the user. Keep responses concise and friendly.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...recentMessages.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
  ];

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: chatbot.temperature as number || 0.3,
      max_tokens: chatbot.maxTokens as number || 1024,
    }),
  });

  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(`Groq API error: ${(data.error as Record<string, unknown>)?.message || response.statusText}`);
  }
  const msg = (data.choices as Record<string, unknown>[])?.[0]?.message as Record<string, string> | undefined;
  return msg?.content || '';
}
