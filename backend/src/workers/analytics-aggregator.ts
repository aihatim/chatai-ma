import { Queue, Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });

const prisma = new PrismaClient();

export const analyticsQueue = new Queue('analytics-aggregation', { connection });

const DATA_RETENTION_DAYS = parseInt(process.env.ANALYTICS_RETENTION_DAYS || '90', 10);

export interface AggregationPayload {
  workspaceId: string;
  date: string;
}

async function aggregateWorkspaceDay(workspaceId: string, dateStr: string) {
  const date = new Date(dateStr);
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);

  const channels = ['website', 'whatsapp', 'prospecting'] as const;

  for (const channel of channels) {
    const conversations = await prisma.conversation.findMany({
      where: {
        workspaceId,
        channel,
        startedAt: { gte: dayStart, lte: dayEnd },
      },
      include: {
        messages: {
          select: {
            responseTimeMs: true,
            confidenceScore: true,
            detectedLanguage: true,
            intentDetected: true,
          },
        },
        _count: { select: { messages: true } },
      },
    });

    if (conversations.length === 0) continue;

    const totalConversations = conversations.length;
    const totalMessages = conversations.reduce((sum, c) => sum + c._count.messages, 0);
    const responseTimes = conversations
      .flatMap((c) => c.messages.map((m) => m.responseTimeMs))
      .filter((t): t is number => t !== null);
    const avgResponseTimeMs = responseTimes.length
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;

    const intentDistribution: Record<string, number> = {};
    const languageDistribution: Record<string, number> = {};
    const leadDistribution: Record<string, number> = {};

    for (const conv of conversations) {
      for (const msg of conv.messages) {
        if (msg.detectedLanguage) {
          languageDistribution[msg.detectedLanguage] = (languageDistribution[msg.detectedLanguage] || 0) + 1;
        }
      }
    }

    const leads = await prisma.lead.findMany({
      where: {
        workspaceId,
        createdAt: { gte: dayStart, lte: dayEnd },
        campaign: { workspaceId },
      },
      select: { status: true },
    });

    for (const lead of leads) {
      leadDistribution[lead.status] = (leadDistribution[lead.status] || 0) + 1;
    }

    const revenueResult = await prisma.revenueAttribution.aggregate({
      where: { workspaceId, channel, createdAt: { gte: dayStart, lte: dayEnd } },
      _sum: { amount: true },
    });

    const satisfactionPositive = conversations.filter(
      (c) => c.satisfactionRating && parseInt(c.satisfactionRating) >= 4
    ).length;
    const satisfactionNegative = conversations.filter(
      (c) => c.satisfactionRating && parseInt(c.satisfactionRating) <= 2
    ).length;

    const leadsContacted = leads.filter((l) => l.status !== 'New' && l.status !== 'Cold').length;
    const leadsResponded = leads.filter((l) => l.status === 'Responded' || l.status === 'Engaged' || l.status === 'Qualified' || l.status === 'MeetingBooked').length;
    const leadsQualified = leads.filter((l) => l.status === 'Qualified' || l.status === 'MeetingBooked' || l.status === 'Closed').length;
    const meetingsBooked = leads.filter((l) => l.status === 'MeetingBooked' || l.status === 'Closed').length;

    await prisma.channelAnalyticsSnapshot.upsert({
      where: {
        workspaceId_channel_chatbotId_date: {
          workspaceId,
          channel,
          chatbotId: '',
          date: dayStart,
        },
      },
      update: {
        totalConversations,
        totalMessages,
        activeUsers: conversations.length,
        avgResponseTimeMs,
        satisfactionPositive,
        satisfactionNegative,
        intentDistribution,
        languageDistribution,
        leadDistribution,
        leadsContacted,
        leadsResponded,
        leadsQualified,
        meetingsBooked,
        revenueGenerated: revenueResult._sum.amount || 0,
      },
      create: {
        workspaceId,
        channel,
        chatbotId: '',
        date: dayStart,
        totalConversations,
        totalMessages,
        activeUsers: conversations.length,
        avgResponseTimeMs,
        satisfactionPositive,
        satisfactionNegative,
        intentDistribution,
        languageDistribution,
        leadDistribution,
        leadsContacted,
        leadsResponded,
        leadsQualified,
        meetingsBooked,
        revenueGenerated: revenueResult._sum.amount || 0,
      },
    });
  }

  const allConversations = await prisma.conversation.findMany({
    where: {
      workspaceId,
      startedAt: { gte: dayStart, lte: dayEnd },
    },
    select: { channel: true },
  });

  const allRevenue = await prisma.revenueAttribution.aggregate({
    where: { workspaceId, createdAt: { gte: dayStart, lte: dayEnd } },
    _sum: { amount: true },
  });

  const allResponseTimes = await prisma.message.findMany({
    where: {
      conversation: { workspaceId },
      createdAt: { gte: dayStart, lte: dayEnd },
      responseTimeMs: { not: null },
    },
    select: { responseTimeMs: true },
  });

  const allResponseMs = allResponseTimes.map((m) => m.responseTimeMs!).filter(Boolean);
  const allAvgResponse = allResponseMs.length
    ? Math.round(allResponseMs.reduce((a, b) => a + b, 0) / allResponseMs.length)
    : 0;

  const totalRevenue = allRevenue._sum.amount || 0;

  await prisma.channelAnalyticsSnapshot.upsert({
    where: {
      workspaceId_channel_chatbotId_date: {
        workspaceId,
        channel: 'all',
        chatbotId: '',
        date: dayStart,
      },
    },
    update: {
      totalConversations: allConversations.length,
      totalMessages: allConversations.length,
      activeUsers: allConversations.length,
      avgResponseTimeMs: allAvgResponse,
      revenueGenerated: totalRevenue,
    },
    create: {
      workspaceId,
      channel: 'all',
      chatbotId: '',
      date: dayStart,
      totalConversations: allConversations.length,
      totalMessages: allConversations.length,
      activeUsers: allConversations.length,
      avgResponseTimeMs: allAvgResponse,
      revenueGenerated: totalRevenue,
    },
  });
}

async function purgeOldData() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DATA_RETENTION_DAYS);

  const retentionDays = parseInt(process.env.ANALYTICS_RETENTION_DAYS || '90', 10);

  if (retentionDays >= 365) return;

  await prisma.channelAnalyticsSnapshot.deleteMany({
    where: { date: { lt: cutoff } },
  });

  const msgCutoff = new Date();
  msgCutoff.setDate(msgCutoff.getDate() - Math.min(retentionDays, 180));

  await prisma.message.deleteMany({
    where: { createdAt: { lt: msgCutoff } },
  });
}

async function processJob(job: Job<AggregationPayload>) {
  const { workspaceId, date } = job.data;
  await aggregateWorkspaceDay(workspaceId, date);
}

async function aggregateAllWorkspaces() {
  const workspaces = await prisma.workspace.findMany({
    select: { id: true },
  });

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  for (const ws of workspaces) {
    await analyticsQueue.add('aggregate-workspace', {
      workspaceId: ws.id,
      date: dateStr,
    });
  }
}

const worker = new Worker<AggregationPayload>('analytics-aggregation', processJob, {
  connection,
  concurrency: 5,
});

worker.on('completed', (job) => {
  console.log(`Analytics aggregation completed for workspace ${job.data.workspaceId}`);
});

worker.on('failed', (job, err) => {
  console.error(`Analytics aggregation failed for workspace ${job?.data.workspaceId}:`, err);
});

export { aggregateAllWorkspaces, purgeOldData };

export default async function startAggregator() {
  const isDev = process.env.NODE_ENV !== 'production';
  const intervalMs = isDev ? 5 * 60 * 1000 : 60 * 60 * 1000;

  await aggregateAllWorkspaces();

  setInterval(async () => {
    try {
      await aggregateAllWorkspaces();
      await purgeOldData();
    } catch (err) {
      console.error('Analytics aggregation cycle failed:', err);
    }
  }, intervalMs);
}
