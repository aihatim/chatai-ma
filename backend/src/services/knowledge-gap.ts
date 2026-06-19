import { prisma, redis } from '../lib/prisma';
import crypto from 'crypto';

export interface KnowledgeGap {
  id: string;
  question: string;
  channel: 'website' | 'whatsapp' | 'prospecting';
  frequency: number;
  lastAskedAt: Date;
  suggestedAnswer?: string;
  status: 'new' | 'reviewed' | 'added_to_kb';
}

const SIMILARITY_CUTOFF = 0.65;
const RESOLVED_PREFIX = 'knowledge-gap:resolved:';

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s\u0600-\u06FF\u0400-\u04FF]/g, '').split(/\s+/).filter(Boolean);
}

function jaccardSimilarity(a: string, b: string): number {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  const intersection = new Set([...tokensA].filter((t) => tokensB.has(t)));
  const union = new Set([...tokensA, ...tokensB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

function gapId(question: string, channel: string): string {
  return crypto.createHash('md5').update(`${channel}:${question.toLowerCase().trim()}`).digest('hex');
}

function groupSimilarQuestions(
  questions: { text: string; channel: string; createdAt: Date }[],
  resolvedSet: Set<string>,
): KnowledgeGap[] {
  const groups: { texts: string[]; channel: string; createdAt: Date }[] = [];

  for (const q of questions) {
    const gid = gapId(q.text, q.channel);
    if (resolvedSet.has(gid)) continue;

    let added = false;
    for (const group of groups) {
      const groupGid = gapId(group.texts[0], group.channel);
      if (resolvedSet.has(groupGid)) continue;
      const similarity = group.texts.some((t) => jaccardSimilarity(t, q.text) >= SIMILARITY_CUTOFF);
      if (similarity) {
        group.texts.push(q.text);
        if (q.createdAt > group.createdAt) group.createdAt = q.createdAt;
        added = true;
        break;
      }
    }
    if (!added) {
      groups.push({ texts: [q.text], channel: q.channel, createdAt: q.createdAt });
    }
  }

  return groups.map((g) => ({
    id: gapId(g.texts.sort((a, b) => b.length - a.length)[0], g.channel),
    question: g.texts.sort((a, b) => b.length - a.length)[0],
    channel: g.channel as 'website' | 'whatsapp' | 'prospecting',
    frequency: g.texts.length,
    lastAskedAt: g.createdAt,
    suggestedAnswer: undefined,
    status: 'new' as const,
  }));
}

export async function getGaps(workspaceId: string, since?: Date): Promise<KnowledgeGap[]> {
  const sinceDate = since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const resolvedIds = await redis.smembers(`${RESOLVED_PREFIX}${workspaceId}`);
  const resolvedSet = new Set(resolvedIds);

  const messages = await prisma.message.findMany({
    where: {
      role: 'user',
      confidenceScore: { lt: 0.6, not: null },
      retrievedChunks: null as any,
      conversation: { workspaceId },
      createdAt: { gte: sinceDate },
    },
    include: {
      conversation: { select: { channel: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const prospectingLowConfidence = await prisma.prospectingMessage.findMany({
    where: {
      direction: 'inbound',
      confidenceScore: { lt: 0.6, not: null },
      campaign: { workspaceId },
      sentAt: { gte: sinceDate },
    },
    select: {
      content: true,
      sentAt: true,
    },
    orderBy: { sentAt: 'desc' },
  });

  const websiteQuestions = (messages as any[])
    .filter((m: any) => m.conversation.channel === 'website')
    .map((m: any) => ({ text: m.content, channel: 'website' as const, createdAt: m.createdAt }));

  const whatsappQuestions = (messages as any[])
    .filter((m: any) => m.conversation.channel === 'whatsapp')
    .map((m: any) => ({ text: m.content, channel: 'whatsapp' as const, createdAt: m.createdAt }));

  const prospectingQuestions = prospectingLowConfidence.map((m) => ({
    text: m.content,
    channel: 'prospecting' as const,
    createdAt: m.sentAt,
  }));

  const allQuestions = [...websiteQuestions, ...whatsappQuestions, ...prospectingQuestions];

  const gaps = groupSimilarQuestions(allQuestions, resolvedSet);
  gaps.sort((a, b) => b.frequency - a.frequency);

  return gaps;
}

export async function markGapResolved(gapId: string, workspaceId: string, knowledgeBaseId: string): Promise<void> {
  await redis.sadd(`${RESOLVED_PREFIX}${workspaceId}`, gapId);
  await redis.hset(`${RESOLVED_PREFIX}meta:${gapId}`, {
    knowledgeBaseId,
    resolvedAt: new Date().toISOString(),
    status: 'added_to_kb',
  });
}
