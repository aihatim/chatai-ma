import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

export default async function (instance: FastifyInstance) {
  instance.addHook('preHandler', authenticate);

  instance.get('/campaigns/:id/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;

    const campaign = await prisma.prospectingCampaign.findFirst({
      where: { id, workspaceId: request.workspaceId },
    });
    if (!campaign) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    const [leadStats, sentimentStats, intentStats, topLeads, last7Days] = await Promise.all([
      prisma.lead.groupBy({
        by: ['status'],
        where: { campaignId: id },
        _count: { id: true },
      }),
      prisma.prospectingMessage.groupBy({
        by: ['sentiment'],
        where: { campaignId: id, sentiment: { not: null } },
        _count: { id: true },
      }),
      prisma.prospectingMessage.groupBy({
        by: ['intentDetected'],
        where: { campaignId: id, intentDetected: { not: null } },
        _count: { id: true },
      }),
      prisma.lead.findMany({
        where: { campaignId: id, status: { not: 'New' } },
        orderBy: { score: 'desc' },
        take: 10,
        select: { id: true, name: true, companyName: true, score: true, status: true, messagesSent: true, messagesReceived: true },
      }),
      prisma.lead.count({
        where: {
          campaignId: id,
          status: { in: ['Qualified', 'MeetingBooked', 'Closed'] },
          updatedAt: { gte: new Date(Date.now() - 7 * 86400000) },
        },
      }),
    ]);

    const responseRate = campaign.totalContacted > 0
      ? Math.round((campaign.totalResponded / campaign.totalContacted) * 10000) / 100
      : 0;

    const dailyMessages = await prisma.prospectingMessage.findMany({
      where: { campaignId: id },
      select: { direction: true, sentAt: true },
      orderBy: { sentAt: 'desc' },
      take: 1000,
    });

    const groupedByDay: Record<string, { outbound: number; inbound: number }> = {};
    for (const msg of dailyMessages) {
      const dateKey = msg.sentAt.toISOString().slice(0, 10);
      if (!groupedByDay[dateKey]) groupedByDay[dateKey] = { outbound: 0, inbound: 0 };
      if (msg.direction === 'outbound') groupedByDay[dateKey].outbound++;
      else groupedByDay[dateKey].inbound++;
    }

    const messageActivity = Object.entries(groupedByDay)
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);

    return {
      data: {
        overview: {
          totalLeads: campaign.totalLeads,
          totalContacted: campaign.totalContacted,
          totalResponded: campaign.totalResponded,
          totalQualified: campaign.totalQualified,
          totalMeetingsBooked: campaign.totalMeetingsBooked,
          totalRevenueGenerated: campaign.totalRevenueGenerated,
          responseRate,
        },
        leadStats: Object.fromEntries(leadStats.map((s) => [s.status, s._count.id])),
        sentimentDistribution: Object.fromEntries(sentimentStats.map((s) => [s.sentiment, s._count.id])),
        intentDistribution: Object.fromEntries(intentStats.map((s) => [s.intentDetected, s._count.id])),
        messageActivity,
        topLeads,
        recentConversions: last7Days,
      },
    };
  });

  instance.get('/workspace/:workspaceId/overview', async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as Record<string, string>;

    if (workspaceId !== request.workspaceId) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Cannot access other workspaces' } });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    const [
      totalConversations,
      totalMessages,
      activeConversations,
      totalCustomers,
      totalCampaigns,
      activeCampaigns,
      totalLeads,
      totalQualifiedLeads,
      totalRevenue,
      conversationsThisMonth,
      messagesThisMonth,
    ] = await Promise.all([
      prisma.conversation.count({ where: { workspaceId } }),
      prisma.message.count({ where: { conversation: { workspaceId } } }),
      prisma.conversation.count({ where: { workspaceId, status: 'Active' } }),
      prisma.customer.count({ where: { workspaceId } }),
      prisma.prospectingCampaign.count({ where: { workspaceId } }),
      prisma.prospectingCampaign.count({ where: { workspaceId, status: 'Active' } }),
      prisma.lead.count({ where: { workspaceId } }),
      prisma.lead.count({ where: { workspaceId, status: 'Qualified' } }),
      prisma.revenueAttribution.aggregate({
        where: { workspaceId },
        _sum: { amount: true },
      }),
      prisma.conversation.count({ where: { workspaceId, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.message.count({ where: { conversation: { workspaceId, createdAt: { gte: thirtyDaysAgo } } } }),
    ]);

    const conversationsByChannel = await prisma.conversation.groupBy({
      by: ['channel'],
      where: { workspaceId },
      _count: { id: true },
    });

    const channelOverview: Record<string, { conversations: number; messages: number }> = {};
    for (const channel of ['website', 'whatsapp', 'prospecting'] as const) {
      const byChannel = await prisma.conversation.count({ where: { workspaceId, channel } });
      const byMessages = await prisma.message.count({ where: { conversation: { workspaceId, channel } } });
      channelOverview[channel] = { conversations: byChannel, messages: byMessages };
    }

    return {
      data: {
        overview: {
          totalConversations,
          totalMessages,
          activeConversations,
          totalCustomers,
          totalCampaigns,
          activeCampaigns,
          totalLeads,
          totalQualifiedLeads,
          totalRevenue: totalRevenue._sum.amount || 0,
        },
        monthly: {
          conversations: conversationsThisMonth,
          messages: messagesThisMonth,
        },
        channels: channelOverview,
        conversationsByChannel: Object.fromEntries(conversationsByChannel.map((c) => [c.channel, c._count.id])),
      },
    };
  });

  instance.get('/workspace/:workspaceId/channel/:channel', async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, channel } = request.params as Record<string, string>;

    if (workspaceId !== request.workspaceId) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Cannot access other workspaces' } });
    }

    const validChannels = ['website', 'whatsapp', 'prospecting', 'all'];
    if (!validChannels.includes(channel)) {
      return reply.status(400).send({ error: { code: 'INVALID_CHANNEL', message: `Channel must be one of: ${validChannels.join(', ')}` } });
    }

    const snapshotFilter: Record<string, unknown> = { workspaceId };
    if (channel !== 'all') snapshotFilter.channel = channel;

    const [snapshots, conversations, messages, activeConversations] = await Promise.all([
      prisma.channelAnalyticsSnapshot.findMany({
        where: snapshotFilter as { workspaceId: string; channel?: string },
        orderBy: { date: 'desc' },
        take: 90,
      }),
      prisma.conversation.count({ where: { workspaceId, ...(channel !== 'all' ? { channel: channel as 'website' | 'whatsapp' | 'prospecting' } : {}) } }),
      prisma.message.count({ where: { conversation: { workspaceId, ...(channel !== 'all' ? { channel: channel as 'website' | 'whatsapp' | 'prospecting' } : {}) } } }),
      prisma.conversation.count({
        where: { workspaceId, status: 'Active', ...(channel !== 'all' ? { channel: channel as 'website' | 'whatsapp' | 'prospecting' } : {}) },
      }),
    ]);

    return {
      data: {
        channel,
        current: { conversations, messages, activeConversations },
        history: snapshots.map((s) => ({
          date: s.date,
          totalConversations: s.totalConversations,
          totalMessages: s.totalMessages,
          activeUsers: s.activeUsers,
          avgResponseTimeMs: s.avgResponseTimeMs,
          satisfactionPositive: s.satisfactionPositive,
          satisfactionNegative: s.satisfactionNegative,
          leadsContacted: s.leadsContacted,
          leadsResponded: s.leadsResponded,
          leadsQualified: s.leadsQualified,
          meetingsBooked: s.meetingsBooked,
          revenueGenerated: s.revenueGenerated,
        })),
      },
    };
  });
}
