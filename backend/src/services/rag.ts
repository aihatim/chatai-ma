import { prisma } from '../lib/prisma';
import { chatComplete, generateEmbedding, GroqMessage } from './groq';
import { getSystemPrompt, SupportedLanguage } from './language';

export interface ChunkResult {
  id: string;
  documentId: string;
  knowledgeBaseId: string;
  chunkIndex: number;
  content: string;
  source: string | null;
  metadata: Record<string, unknown>;
  score: number;
}

export async function search(
  query: string,
  kbId: string,
  limit = 5
): Promise<ChunkResult[]> {
  const embedding = await generateEmbedding(query);

  const results = await prisma.$queryRaw<ChunkResult[]>`
    SELECT
      id,
      "documentId",
      "knowledgeBaseId",
      "chunkIndex",
      content,
      source,
      metadata,
      1 - (embedding <=> ${embedding}::vector) AS score
    FROM "DocumentChunk"
    WHERE "knowledgeBaseId" = ${kbId}
    ORDER BY embedding <=> ${embedding}::vector
    LIMIT ${limit}
  `;

  return results.map((r) => ({
    ...r,
    score: typeof r.score === 'number' ? r.score : 0,
  }));
}

export interface ContextChunk {
  content: string;
  source: string | null;
  documentId: string;
  chunkIndex: number;
}

export function buildContext(chunks: ContextChunk[], _query: string): string {
  if (chunks.length === 0) return '';

  const parts = chunks.map((chunk, i) => {
    const source = chunk.source
      ? `[Source: ${chunk.source}]`
      : `[Document chunk ${chunk.chunkIndex + 1}]`;
    return `[${i + 1}] ${chunk.content}\n${source}`;
  });

  return `Here is the relevant information from the knowledge base:\n\n${parts.join('\n\n')}`;
}

export async function generateResponse(
  query: string,
  context: string,
  conversationHistory: GroqMessage[],
  language: SupportedLanguage
): Promise<string> {
  const systemPrompt = getSystemPrompt(language);

  let messages: GroqMessage[] = [];

  if (context) {
    messages.push({
      role: 'system',
      content: `${systemPrompt}\n\nUse the following context to answer the user's question. If the context doesn't contain relevant information, say so and provide a general response.\n\n${context}`,
    });
  } else {
    messages.push({
      role: 'system',
      content: systemPrompt,
    });
  }

  messages.push(...conversationHistory);
  messages.push({ role: 'user', content: query });

  return chatComplete(messages, {
    temperature: 0.3,
    max_tokens: 1024,
  });
}

export function getConfidenceScore(
  response: string,
  chunks: ChunkResult[]
): number {
  if (chunks.length === 0) return 0;

  const avgChunkScore =
    chunks.reduce((sum, c) => sum + c.score, 0) / chunks.length;

  const hasSubstance = response.length > 20;
  const hasResponse = response.trim().length > 0;

  const responseQuality = hasSubstance && hasResponse ? 1 : 0.3;

  const confidence = avgChunkScore * 0.7 + responseQuality * 0.3;

  return Math.round(confidence * 100) / 100;
}

export async function generateResponseWithStreaming(
  query: string,
  context: string,
  conversationHistory: GroqMessage[],
  language: SupportedLanguage
): Promise<AsyncGenerator<string, void, unknown>> {
  const { chat } = await import('./groq');
  const systemPrompt = getSystemPrompt(language);

  let messages: GroqMessage[] = [];

  if (context) {
    messages.push({
      role: 'system',
      content: `${systemPrompt}\n\nUse the following context to answer the user's question. If the context doesn't contain relevant information, say so and provide a general response.\n\n${context}`,
    });
  } else {
    messages.push({
      role: 'system',
      content: systemPrompt,
    });
  }

  messages.push(...conversationHistory);
  messages.push({ role: 'user', content: query });

  return chat(messages, {
    temperature: 0.3,
    max_tokens: 1024,
  });
}

export const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;
