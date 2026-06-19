import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma, redis } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import {
  scoreLead, generateOpeningMessages, checkBlacklist, calculateDailyUsage,
  enrichLeadFromWeb, scheduleOptimalTime, generateObjectionResponses, getProspectingAnalytics,
} from '../services/prospecting';
import { getGaps } from '../services/knowledge-gap';
import { decryptToken, sendText, hashPhone } from '../services/whatsapp';
import { Queue } from 'bullmq';
import { stringify } from 'csv-stringify/sync';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const dispatchQueue = new Queue('prospecting-dispatch', {
  connection: { url: redisUrl },
});
const responseQueue = new Queue('prospecting-response', {
  connection: { url: redisUrl },
});
const handoffQueue = new Queue('human-handoff-requests', {
  connection: { url: redisUrl },
});

export default async function (instance: FastifyInstance) {
  instance.addHook('preHandler', authenticate);

  instance.post('/campaigns', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const { name, targetIndustries, targetCompanySizes, targetGeographies, targetJobTitles, keywords,
      maxContactsPerDay, timeWindowStart, timeWindowEnd, timezone, pauseWeekends,
      noResponseAfterNMsgs, noResponseAfterDays, maxConversationLength,
      valueProposition, ctaType, knowledgeBaseId, consentConfirmed } = body;

    if (!name) {
      return reply.status(400).send({ error: { code: 'MISSING_NAME', message: 'Campaign name is required' } });
    }

    if (knowledgeBaseId) {
      const kb = await prisma.knowledgeBase.findFirst({
        where: { id: knowledgeBaseId as string, workspaceId: request.workspaceId },
      });
      if (!kb) {
        return reply.status(404).send({ error: { code: 'KB_NOT_FOUND', message: 'Knowledge base not found' } });
      }
    }

    const campaign = await prisma.prospectingCampaign.create({
      data: {
        workspaceId: request.workspaceId!,
        name: name as string,
        createdBy: request.user!.userId,
        targetIndustries: targetIndustries ? JSON.stringify(targetIndustries) : undefined,
        targetCompanySizes: targetCompanySizes ? JSON.stringify(targetCompanySizes) : undefined,
        targetGeographies: targetGeographies ? JSON.stringify(targetGeographies) : undefined,
        targetJobTitles: targetJobTitles ? JSON.stringify(targetJobTitles) : undefined,
        keywords: keywords ? JSON.stringify(keywords) : undefined,
        maxContactsPerDay: (maxContactsPerDay as number) || 100,
        timeWindowStart: (timeWindowStart as string) || '09:00',
        timeWindowEnd: (timeWindowEnd as string) || '18:00',
        timezone: (timezone as string) || 'Africa/Casablanca',
        pauseWeekends: (pauseWeekends as boolean) ?? true,
        noResponseAfterNMsgs: (noResponseAfterNMsgs as number) || 3,
        noResponseAfterDays: (noResponseAfterDays as number) || 7,
        maxConversationLength: (maxConversationLength as number) || 5,
        valueProposition: valueProposition as string,
        ctaType: (ctaType as string) || 'BookDemo',
        knowledgeBaseId: knowledgeBaseId as string,
        consentConfirmed: (consentConfirmed as boolean) || false,
        consentConfirmedBy: (consentConfirmed as boolean) ? request.user!.userId : undefined,
        consentConfirmedAt: (consentConfirmed as boolean) ? new Date() : undefined,
      },
    });

    return reply.status(201).send({ data: campaign });
  });

  instance.get('/campaigns', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const status = query.status;

    const where: Record<string, unknown> = { workspaceId: request.workspaceId };
    if (status) where.status = status;

    const [campaigns, total] = await Promise.all([
      prisma.prospectingCampaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, name: true, status: true, totalLeads: true, totalContacted: true,
          totalResponded: true, totalQualified: true, totalMeetingsBooked: true,
          totalRevenueGenerated: true, createdAt: true, updatedAt: true,
        },
      }),
      prisma.prospectingCampaign.count({ where }),
    ]);

    return { data: campaigns, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  });

  instance.get('/campaigns/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;
    const campaign = await prisma.prospectingCampaign.findFirst({
      where: { id, workspaceId: request.workspaceId },
      include: {
        _count: { select: { leads: true } },
        knowledgeBase: { select: { id: true, name: true } },
      },
    });
    if (!campaign) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    const statusCounts = await prisma.lead.groupBy({
      by: ['status'],
      where: { campaignId: id },
      _count: true,
    });

    return {
      data: {
        ...campaign,
        leadStats: Object.fromEntries(statusCounts.map((s) => [s.status, s._count])),
      },
    };
  });

  instance.patch('/campaigns/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;
    const body = request.body as Record<string, unknown>;

    const existing = await prisma.prospectingCampaign.findFirst({
      where: { id, workspaceId: request.workspaceId },
    });
    if (!existing) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }
    if (existing.status !== 'Draft' && existing.status !== 'Paused') {
      return reply.status(400).send({ error: { code: 'INVALID_STATUS', message: 'Can only update Draft or Paused campaigns' } });
    }

    const updatableFields = [
      'name', 'targetIndustries', 'targetCompanySizes', 'targetGeographies', 'targetJobTitles',
      'keywords', 'maxContactsPerDay', 'timeWindowStart', 'timeWindowEnd', 'timezone',
      'pauseWeekends', 'noResponseAfterNMsgs', 'noResponseAfterDays', 'maxConversationLength',
      'valueProposition', 'ctaType', 'knowledgeBaseId',
    ];

    const data: Record<string, unknown> = {};
    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    const updated = await prisma.prospectingCampaign.update({ where: { id }, data });
    return { data: updated };
  });

  instance.post('/campaigns/:id/launch', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;
    const campaign = await prisma.prospectingCampaign.findFirst({
      where: { id, workspaceId: request.workspaceId },
      include: { leads: { where: { status: 'New' }, take: 1 } },
    });
    if (!campaign) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    const checks: string[] = [];
    if (!campaign.consentConfirmed) checks.push('Consent not confirmed');
    if (!campaign.knowledgeBaseId) checks.push('No knowledge base linked');
    if (!campaign.openingMessageVariants) checks.push('Opening messages not approved');
    if (campaign.leads.length === 0) checks.push('No leads in campaign');
    if (campaign.status !== 'Draft' && campaign.status !== 'Paused') checks.push(`Campaign is ${campaign.status}`);

    if (checks.length > 0) {
      return reply.status(400).send({ error: { code: 'LAUNCH_CHECKS_FAILED', message: checks.join('; ') } });
    }

    const updated = await prisma.prospectingCampaign.update({
      where: { id },
      data: { status: 'Active', scheduledStartAt: new Date(), startedAt: new Date() },
    });

    await dispatchQueue.add('dispatch-batch', {
      campaignId: id,
      workspaceId: request.workspaceId,
      batchSize: Math.min(campaign.maxContactsPerDay, 50),
    }, { removeOnComplete: true, removeOnFail: false });

    return { data: updated };
  });

  instance.post('/campaigns/:id/pause', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;
    const campaign = await prisma.prospectingCampaign.findFirst({
      where: { id, workspaceId: request.workspaceId },
    });
    if (!campaign) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }
    if (campaign.status !== 'Active') {
      return reply.status(400).send({ error: { code: 'INVALID_STATUS', message: 'Only Active campaigns can be paused' } });
    }
    const updated = await prisma.prospectingCampaign.update({
      where: { id },
      data: { status: 'Paused', pausedAt: new Date() },
    });
    return { data: updated };
  });

  instance.post('/campaigns/:id/complete', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;
    const campaign = await prisma.prospectingCampaign.findFirst({
      where: { id, workspaceId: request.workspaceId },
    });
    if (!campaign) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }
    const updated = await prisma.prospectingCampaign.update({
      where: { id },
      data: { status: 'Completed', completedAt: new Date() },
    });
    return { data: updated };
  });

  instance.delete('/campaigns/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;
    const campaign = await prisma.prospectingCampaign.findFirst({
      where: { id, workspaceId: request.workspaceId },
    });
    if (!campaign) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }
    const updated = await prisma.prospectingCampaign.update({
      where: { id },
      data: { status: 'Cancelled' },
    });
    return { data: updated };
  });

  instance.post('/campaigns/:id/leads/import', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;
    const campaign = await prisma.prospectingCampaign.findFirst({
      where: { id, workspaceId: request.workspaceId },
    });
    if (!campaign) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    const leads = request.body as Array<Record<string, string>>;
    if (!Array.isArray(leads) || leads.length === 0) {
      return reply.status(400).send({ error: { code: 'INVALID_LEADS', message: 'Expected a non-empty array of leads' } });
    }

    const results = { total: leads.length, imported: 0, duplicates: 0, invalid: 0, blacklisted: 0, skipped: 0, errors: [] as string[] };

    for (const lead of leads) {
      try {
        if (!lead.phone) {
          results.skipped++;
          results.errors.push(`Lead ${lead.name || 'unknown'}: missing phone`);
          continue;
        }

        const cleanedPhone = lead.phone.replace(/[\s\-\(\)]/g, '');
        if (!/^\+?\d{7,15}$/.test(cleanedPhone)) {
          results.invalid++;
          results.errors.push(`Lead ${lead.name || cleanedPhone}: invalid phone format`);
          continue;
        }

        const phoneHash = hashPhone(cleanedPhone);
        const existing = await prisma.lead.findFirst({
          where: { campaignId: id, phoneNumberHash: phoneHash },
        });
        if (existing) {
          results.duplicates++;
          continue;
        }

        const blacklistCheck = await checkBlacklist(cleanedPhone, request.workspaceId!);
        if (blacklistCheck.blocked) {
          results.blacklisted++;
          results.errors.push(`Lead ${lead.name || cleanedPhone}: ${blacklistCheck.reason}`);
          continue;
        }

        const scoring = scoreLead({
          industry: lead.industry,
          companyName: lead.companyName,
          companySize: lead.companySize,
          website: lead.website,
          jobTitle: lead.jobTitle,
          targetIndustries: campaign.targetIndustries as string[] | undefined,
          targetCompanySizes: campaign.targetCompanySizes as string[] | undefined,
          targetJobTitles: campaign.targetJobTitles as string[] | undefined,
          keywords: campaign.keywords as string[] | undefined,
        });

        await prisma.lead.create({
          data: {
            campaignId: id,
            workspaceId: request.workspaceId!,
            phoneNumber: cleanedPhone,
            phoneNumberHash: phoneHash,
            email: lead.email || null,
            name: lead.name || null,
            companyName: lead.companyName || null,
            jobTitle: lead.jobTitle || null,
            industry: lead.industry || null,
            website: lead.website || null,
            score: scoring.score,
            scoreFactors: scoring.factors,
            scoreCalculatedAt: new Date(),
          },
        });

        results.imported++;
      } catch (err: unknown) {
        results.errors.push(`Lead ${(lead as Record<string, string>).name || 'unknown'}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    await prisma.prospectingCampaign.update({
      where: { id },
      data: { totalLeads: { increment: results.imported } },
    });

    return reply.status(201).send(results);
  });

  instance.get('/campaigns/:id/leads', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '50', 10);
    const status = query.status;
    const minScore = query.minScore ? parseInt(query.minScore, 10) : undefined;
    const maxScore = query.maxScore ? parseInt(query.maxScore, 10) : undefined;
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
    const dateTo = query.dateTo ? new Date(query.dateTo) : undefined;

    const where: Record<string, unknown> = { campaignId: id };
    if (status) where.status = status;
    if (minScore !== undefined || maxScore !== undefined) {
      where.score = {};
      if (minScore !== undefined) (where.score as Record<string, number>).gte = minScore;
      if (maxScore !== undefined) (where.score as Record<string, number>).lte = maxScore;
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) (where.createdAt as Record<string, Date>).gte = dateFrom;
      if (dateTo) (where.createdAt as Record<string, Date>).lte = dateTo;
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { score: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, name: true, phoneNumber: true, companyName: true, jobTitle: true,
          industry: true, score: true, status: true, messagesSent: true, messagesReceived: true,
          overallSentiment: true, createdAt: true,
        },
      }),
      prisma.lead.count({ where }),
    ]);

    return { data: leads, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  });

  instance.get('/campaigns/:id/leads/:leadId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, leadId } = request.params as Record<string, string>;
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, campaignId: id },
      include: {
        messages: { orderBy: { sentAt: 'asc' }, take: 50 },
      },
    });
    if (!lead) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Lead not found' } });
    }
    return { data: lead };
  });

  instance.patch('/campaigns/:id/leads/:leadId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, leadId } = request.params as Record<string, string>;
    const body = request.body as Record<string, unknown>;

    const existing = await prisma.lead.findFirst({ where: { id: leadId, campaignId: id } });
    if (!existing) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Lead not found' } });
    }

    const data: Record<string, unknown> = {};
    if (body.score !== undefined && typeof body.score === 'number') {
      data.score = body.score as number;
      data.scoreFactors = { ...(existing.scoreFactors as Record<string, unknown> || {}), manualOverride: true };
      data.scoreCalculatedAt = new Date();
    }
    if (body.status) data.status = body.status;

    if (Object.keys(data).length === 0) {
      return reply.status(400).send({ error: { code: 'NO_CHANGES', message: 'No valid fields to update' } });
    }

    const updated = await prisma.lead.update({ where: { id: leadId }, data });
    return { data: updated };
  });

  instance.post('/campaigns/:id/leads/:leadId/unsubscribe', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, leadId } = request.params as Record<string, string>;
    const lead = await prisma.lead.findFirst({ where: { id: leadId, campaignId: id } });
    if (!lead) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Lead not found' } });
    }

    const phoneHash = hashPhone(lead.phoneNumber);
    await prisma.doNotContactList.upsert({
      where: { phoneHash },
      update: { reason: 'Unsubscribed' },
      create: {
        workspaceId: request.workspaceId!,
        phoneHash,
        emailHash: lead.email ? hashPhone(lead.email) : undefined,
        reason: 'Unsubscribed',
        addedBy: request.user!.userId,
      },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: { status: 'Unsubscribed', isBlacklisted: true, blacklistReason: 'Unsubscribed' },
    });

    return { status: 'unsubscribed' };
  });

  instance.get('/campaigns/:id/leads/:leadId/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, leadId } = request.params as Record<string, string>;
    const lead = await prisma.lead.findFirst({ where: { id: leadId, campaignId: id } });
    if (!lead) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Lead not found' } });
    }

    const query = request.query as Record<string, string>;
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '50', 10);

    const [messages, total] = await Promise.all([
      prisma.prospectingMessage.findMany({
        where: { leadId },
        orderBy: { sentAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.prospectingMessage.count({ where: { leadId } }),
    ]);

    return { data: messages, meta: { page, limit, total } };
  });

  instance.post('/campaigns/:id/leads/:leadId/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, leadId } = request.params as Record<string, string>;
    const { content } = request.body as Record<string, string>;
    if (!content) {
      return reply.status(400).send({ error: { code: 'MISSING_CONTENT', message: 'Message content is required' } });
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, campaignId: id },
      include: { campaign: { select: { workspaceId: true } } },
    });
    if (!lead) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Lead not found' } });
    }

    const channel = await prisma.whatsAppChannel.findFirst({
      where: { workspaceId: lead.campaign.workspaceId, isActive: true },
    });
    if (!channel) {
      return reply.status(400).send({ error: { code: 'NO_CHANNEL', message: 'No active WhatsApp channel' } });
    }

    const accessToken = decryptToken(channel.accessTokenEncrypted);
    const sent = await sendText(lead.phoneNumber, content, false, channel.phoneNumberId, accessToken);
    const waMessageId = (sent.messages as Record<string, unknown>[])?.[0]?.id as string | undefined;

    const message = await prisma.prospectingMessage.create({
      data: {
        leadId,
        campaignId: id,
        direction: 'outbound',
        content,
        sentVia: 'whatsapp',
        includesUnsubscribe: content.toLowerCase().includes('stop') || content.toLowerCase().includes('désabonner'),
      },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        messagesSent: { increment: 1 },
        lastMessageSentAt: new Date(),
        lastSentVariantId: waMessageId,
        status: lead.status === 'New' ? 'Contacted' : lead.status,
      },
    });

    return reply.status(201).send({ data: message });
  });

  instance.get('/campaigns/:id/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '50', 10);

    const [messages, total] = await Promise.all([
      prisma.prospectingMessage.findMany({
        where: { campaignId: id },
        orderBy: { sentAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          lead: { select: { id: true, name: true, phoneNumber: true, companyName: true } },
        },
      }),
      prisma.prospectingMessage.count({ where: { campaignId: id } }),
    ]);

    return { data: messages, meta: { page, limit, total } };
  });

  instance.get('/campaigns/:id/gaps', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    const since = query.since ? new Date(query.since) : undefined;

    const campaign = await prisma.prospectingCampaign.findFirst({
      where: { id, workspaceId: request.workspaceId },
    });
    if (!campaign) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    const gaps = await getGaps(request.workspaceId!, since);
    return { data: gaps };
  });

  instance.get('/campaigns/:id/analytics', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;

    const campaign = await prisma.prospectingCampaign.findFirst({
      where: { id, workspaceId: request.workspaceId },
    });
    if (!campaign) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    const analytics = await getProspectingAnalytics(request.workspaceId!, id);
    return { data: analytics };
  });

  instance.post('/leads/enrich', async (request: FastifyRequest, reply: FastifyReply) => {
    const { phoneNumber, companyName } = request.body as Record<string, string>;
    if (!phoneNumber || !companyName) {
      return reply.status(400).send({ error: { code: 'MISSING_PARAMS', message: 'phoneNumber and companyName are required' } });
    }

    const enriched = await enrichLeadFromWeb(phoneNumber, companyName);
    return { data: enriched };
  });

  instance.get('/campaigns/:id/messages/recent', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;

    const campaign = await prisma.prospectingCampaign.findFirst({
      where: { id, workspaceId: request.workspaceId },
    });
    if (!campaign) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    const messages = await prisma.prospectingMessage.findMany({
      where: { campaignId: id },
      orderBy: { sentAt: 'desc' },
      take: 50,
      include: {
        lead: { select: { id: true, name: true, companyName: true } },
      },
    });

    return {
      data: messages.map((m) => ({
        id: m.id,
        leadName: m.lead?.name || 'Unknown',
        companyName: m.lead?.companyName || '',
        content: m.content,
        sentiment: m.sentiment,
        timestamp: m.sentAt,
        direction: m.direction,
      })),
    };
  });

  instance.post('/campaigns/:id/opening-messages/generate', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;
    const { customInstructions } = request.body as Record<string, string | undefined>;

    const campaign = await prisma.prospectingCampaign.findFirst({
      where: { id, workspaceId: request.workspaceId },
    });
    if (!campaign) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    const variants = await generateOpeningMessages(
      {
        name: campaign.name,
        valueProposition: campaign.valueProposition,
        ctaType: campaign.ctaType,
        targetIndustries: campaign.targetIndustries,
        targetJobTitles: campaign.targetJobTitles,
      },
      { name: '{{name}}', companyName: '{{company}}', jobTitle: '{{title}}', industry: undefined, website: undefined },
      5,
    );

    return { data: variants.variants };
  });

  instance.post('/webhooks/crm', async (request: FastifyRequest, reply: FastifyReply) => {
    const { event, data } = request.body as { event: string; data: Record<string, unknown> };

    if (!event || !data) {
      return reply.status(400).send({ error: { code: 'INVALID_PAYLOAD', message: 'event and data are required' } });
    }

    switch (event) {
      case 'deal_won': {
        const leadId = data.leadId as string;
        if (leadId) {
          await prisma.lead.update({
            where: { id: leadId },
            data: {
              status: 'Closed',
              dealClosedAt: new Date(),
              dealValue: data.dealValue ? Number(data.dealValue) : undefined,
            },
          });
          const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { campaignId: true } });
          if (lead) {
            await prisma.prospectingCampaign.update({
              where: { id: lead.campaignId },
              data: { totalRevenueGenerated: { increment: data.dealValue ? Number(data.dealValue) : 0 } },
            });
          }
        }
        break;
      }
      case 'deal_lost': {
        const leadIdLost = data.leadId as string;
        if (leadIdLost) {
          await prisma.lead.update({
            where: { id: leadIdLost },
            data: { status: 'Cold', dealClosedAt: new Date() },
          });
        }
        break;
      }
      case 'lead_updated': {
        const leadIdUpd = data.leadId as string;
        if (leadIdUpd) {
          const updateData: Record<string, unknown> = {};
          if (data.name) updateData.name = data.name;
          if (data.companyName) updateData.companyName = data.companyName;
          if (data.jobTitle) updateData.jobTitle = data.jobTitle;
          if (data.industry) updateData.industry = data.industry;
          if (data.score !== undefined) updateData.score = data.score;
          if (data.status) updateData.status = data.status;
          if (Object.keys(updateData).length > 0) {
            await prisma.lead.update({ where: { id: leadIdUpd }, data: updateData });
          }
        }
        break;
      }
      default:
        return reply.status(400).send({ error: { code: 'UNKNOWN_EVENT', message: `Unknown event type: ${event}` } });
    }

    return { status: 'acknowledged', event };
  });

  instance.get('/campaigns/:id/export', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    const format = query.format || 'json';

    const campaign = await prisma.prospectingCampaign.findFirst({
      where: { id, workspaceId: request.workspaceId },
    });
    if (!campaign) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    }

    const leads = await prisma.lead.findMany({
      where: { campaignId: id },
      orderBy: { score: 'desc' },
    });

    const exportData = leads.map((l) => ({
      name: l.name,
      phone: l.phoneNumber,
      email: l.email,
      companyName: l.companyName,
      jobTitle: l.jobTitle,
      industry: l.industry,
      website: l.website,
      score: l.score,
      status: l.status,
      messagesSent: l.messagesSent,
      messagesReceived: l.messagesReceived,
      overallSentiment: l.overallSentiment,
      createdAt: l.createdAt.toISOString(),
    }));

    if (format === 'csv') {
      const csv = stringify(exportData, { header: true });
      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="campaign-${id}-leads.csv"`);
      return reply.send(csv);
    }

    return { data: exportData };
  });
}
