import { prisma } from '../lib/prisma';
import { GroqMessage } from './groq';
import {
  search,
  buildContext,
  generateResponse,
  generateResponseWithStreaming,
  getConfidenceScore,
  DEFAULT_CONFIDENCE_THRESHOLD,
  ChunkResult,
} from './rag';
import {
  detectLanguage,
  isDarija,
  getResponseLanguage,
  SupportedLanguage,
} from './language';

export interface CustomerInfo {
  name?: string;
  email?: string;
  phone?: string;
}

export interface ChatResponse {
  content: string;
  confidence: number;
  citations: Citation[];
  language: SupportedLanguage;
  isDarija: boolean;
}

export interface Citation {
  source: string;
  chunkIndex: number;
  documentId: string;
  score: number;
}

export async function handleChatMessage(
  workspaceId: string,
  chatbotId: string,
  channel: string,
  message: string,
  sessionId: string,
  customerInfo?: CustomerInfo
): Promise<ChatResponse> {
  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
    include: { knowledgeBase: true },
  });

  if (!chatbot) throw new Error(`Chatbot ${chatbotId} not found`);

  const startTime = Date.now();

  const lang = chatbot.autoDetectLanguage
    ? getResponseLanguage(message)
    : ((chatbot.supportedLanguages as string[])?.[0] as SupportedLanguage) || 'en';

  const darija = isDarija(message);

  let conversation = await prisma.conversation.findFirst({
    where: { sessionId, workspaceId, channel: channel as never },
    orderBy: { createdAt: 'desc' },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        workspaceId,
        sessionId,
        channel: channel as never,
        channelId: chatbotId,
        chatbotId,
        userLanguage: lang,
        customerId: customerInfo?.email
          ? await getOrCreateCustomer(workspaceId, channel, customerInfo)
          : undefined,
      },
    });
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      messageCount: { increment: 1 },
    },
  });

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'user',
      content: message,
      detectedLanguage: lang,
      isDarija: darija,
    },
  });

  const recentMessages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });

  const conversationHistory: GroqMessage[] = recentMessages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));

  let chunks: ChunkResult[] = [];
  let context = '';

  const kbId = chatbot.activeKnowledgeBaseId;
  if (kbId) {
    chunks = await search(message, kbId, 5);
    context = buildContext(
      chunks.map((c) => ({
        content: c.content,
        source: c.source,
        documentId: c.documentId,
        chunkIndex: c.chunkIndex,
      })),
      message
    );
  }

  const response = await generateResponse(
    message,
    context,
    conversationHistory.slice(0, -1),
    lang
  );

  const confidence = getConfidenceScore(response, chunks);

  let finalResponse = response;

  if (confidence < (chatbot.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD)) {
    finalResponse = getFallbackMessage(chatbot, lang);
  }

  const responseTimeMs = Date.now() - startTime;

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'assistant',
      content: finalResponse,
      detectedLanguage: lang,
      isDarija: darija,
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      confidenceScore: confidence,
      retrievedChunks: chunks.map((c) => ({
        id: c.id,
        documentId: c.documentId,
        chunkIndex: c.chunkIndex,
        score: c.score,
      })),
      responseTimeMs,
    },
  });

  if (!conversation.firstResponseTimeMs) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { firstResponseTimeMs: responseTimeMs },
    });
  }

  const citations: Citation[] = chunks.map((c) => ({
    source: c.source || 'unknown',
    chunkIndex: c.chunkIndex,
    documentId: c.documentId,
    score: c.score,
  }));

  return {
    content: finalResponse,
    confidence,
    citations,
    language: lang,
    isDarija: darija,
  };
}

export async function* handleChatMessageStreaming(
  workspaceId: string,
  chatbotId: string,
  channel: string,
  message: string,
  sessionId: string,
  customerInfo?: CustomerInfo
): AsyncGenerator<string, ChatResponse, unknown> {
  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
    include: { knowledgeBase: true },
  });

  if (!chatbot) throw new Error(`Chatbot ${chatbotId} not found`);

  const startTime = Date.now();

  const lang = chatbot.autoDetectLanguage
    ? getResponseLanguage(message)
    : ((chatbot.supportedLanguages as string[])?.[0] as SupportedLanguage) || 'en';

  const darija = isDarija(message);

  let conversation = await prisma.conversation.findFirst({
    where: { sessionId, workspaceId, channel: channel as never },
    orderBy: { createdAt: 'desc' },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        workspaceId,
        sessionId,
        channel: channel as never,
        channelId: chatbotId,
        chatbotId,
        userLanguage: lang,
        customerId: customerInfo?.email
          ? await getOrCreateCustomer(workspaceId, channel, customerInfo)
          : undefined,
      },
    });
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      messageCount: { increment: 1 },
    },
  });

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'user',
      content: message,
      detectedLanguage: lang,
      isDarija: darija,
    },
  });

  const recentMessages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });

  const conversationHistory: GroqMessage[] = recentMessages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));

  let chunks: ChunkResult[] = [];
  let context = '';

  const kbId = chatbot.activeKnowledgeBaseId;
  if (kbId) {
    chunks = await search(message, kbId, 5);
    context = buildContext(
      chunks.map((c) => ({
        content: c.content,
        source: c.source,
        documentId: c.documentId,
        chunkIndex: c.chunkIndex,
      })),
      message
    );
  }

  if (context) {
    yield '__context_loaded__';
  }

  const stream = await generateResponseWithStreaming(
    message,
    context,
    conversationHistory.slice(0, -1),
    lang
  );

  let fullResponse = '';

  for await (const token of stream) {
    fullResponse += token;
    yield token;
  }

  const confidence = getConfidenceScore(fullResponse, chunks);
  let finalResponse = fullResponse;

  if (confidence < (chatbot.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD)) {
    finalResponse = getFallbackMessage(chatbot, lang);
  }

  const responseTimeMs = Date.now() - startTime;

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'assistant',
      content: finalResponse,
      detectedLanguage: lang,
      isDarija: darija,
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      confidenceScore: confidence,
      retrievedChunks: chunks.map((c) => ({
        id: c.id,
        documentId: c.documentId,
        chunkIndex: c.chunkIndex,
        score: c.score,
      })),
      responseTimeMs,
    },
  });

  if (!conversation.firstResponseTimeMs) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { firstResponseTimeMs: responseTimeMs },
    });
  }

  const citations: Citation[] = chunks.map((c) => ({
    source: c.source || 'unknown',
    chunkIndex: c.chunkIndex,
    documentId: c.documentId,
    score: c.score,
  }));

  return {
    content: finalResponse,
    confidence,
    citations,
    language: lang,
    isDarija: darija,
  };
}

function getFallbackMessage(
  chatbot: {
    fallbackMessageEn?: string | null;
    fallbackMessageFr?: string | null;
    fallbackMessageAr?: string | null;
    fallbackMessageEs?: string | null;
  },
  lang: SupportedLanguage
): string {
  const fallbacks: Record<SupportedLanguage, string | null | undefined> = {
    en: chatbot.fallbackMessageEn,
    fr: chatbot.fallbackMessageFr,
    ar: chatbot.fallbackMessageAr,
    es: chatbot.fallbackMessageEs,
  };

  return (
    fallbacks[lang] ||
    chatbot.fallbackMessageEn ||
    "I'm not sure I can answer that accurately. Could you rephrase or contact our support team?"
  );
}

async function getOrCreateCustomer(
  workspaceId: string,
  channel: string,
  info: CustomerInfo
): Promise<string | undefined> {
  if (!info.email && !info.phone) return undefined;

  const where = info.email
    ? { workspaceId, email: info.email }
    : { workspaceId, phone: info.phone };

  let customer = await prisma.customer.findFirst({ where });

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        workspaceId,
        email: info.email,
        phone: info.phone,
        name: info.name,
        firstSeenChannel: channel as never,
        lastSeenChannel: channel as never,
      },
    });
  }

  return customer.id;
}
