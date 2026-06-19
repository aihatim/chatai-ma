import { Worker, Job } from 'bullmq';
import { prisma, redis } from '../lib/prisma';
import { decryptToken, sendText, hashPhone } from '../services/whatsapp';
import { checkBlacklist, calculateDailyUsage, scheduleOptimalTime } from '../services/prospecting';

interface DispatchJob {
  campaignId: string;
  workspaceId: string;
  batchSize: number;
}

const worker = new Worker<DispatchJob>('prospecting-dispatch', async (job: Job<DispatchJob>) => {
  const { campaignId, workspaceId, batchSize } = job.data;

  const campaign = await prisma.prospectingCampaign.findUnique({
    where: { id: campaignId },
    include: { workspace: true },
  });
  if (!campaign || campaign.status !== 'Active') {
    await job.log(`Campaign ${campaignId} is not active (status: ${campaign?.status}). Skipping.`);
    return;
  }

  const channel = await prisma.whatsAppChannel.findFirst({
    where: { workspaceId, isActive: true, isConnected: true },
  });
  if (!channel) {
    await job.log(`No active WhatsApp channel for workspace ${workspaceId}. Skipping.`);
    return;
  }

  const accessToken = decryptToken(channel.accessTokenEncrypted);
  const dailySent = await calculateDailyUsage(campaignId);
  const dailyRemaining = Math.max(0, campaign.maxContactsPerDay - dailySent);
  const dispatchSize = Math.min(batchSize, dailyRemaining);

  if (dispatchSize === 0) {
    await job.log(`Daily limit reached for campaign ${campaignId} (${dailySent}/${campaign.maxContactsPerDay}).`);
    return;
  }

  const now = new Date();
  const currentHour = now.getUTCHours() + (parseInt(campaign.timezone.split(':')[0].replace(/[+-]/, '')) || 0);
  const [startH, startM] = (campaign.timeWindowStart || '09:00').split(':').map(Number);
  const [endH, endM] = (campaign.timeWindowEnd || '18:00').split(':').map(Number);
  const currentMinutes = currentHour * 60 + now.getMinutes();
  const windowStartMinutes = startH * 60 + startM;
  const windowEndMinutes = endH * 60 + endM;

  if (currentMinutes < windowStartMinutes || currentMinutes >= windowEndMinutes) {
    const nextRunMs = (windowStartMinutes - currentMinutes + 1440) % 1440 * 60000;
    await job.log(`Outside time window. Rescheduling in ${nextRunMs / 60000} minutes.`);
    await job.moveToDelayed(nextRunMs);
    return;
  }

  if (campaign.pauseWeekends && (now.getDay() === 0 || now.getDay() === 6)) {
    await job.log('Weekend pause enabled. Skipping dispatch.');
    return;
  }

  const leads = await prisma.lead.findMany({
    where: {
      campaignId,
      status: { in: ['New', 'Contacted', 'Responded'] },
      isBlacklisted: false,
      OR: [
        { lastMessageSentAt: null },
        { lastMessageSentAt: { lte: new Date(Date.now() - 3 * 60 * 1000) } },
      ],
    },
    orderBy: [{ status: 'asc' }, { score: 'desc' }],
    take: dispatchSize,
  });

  await job.log(`Found ${leads.length} leads to dispatch (daily: ${dailySent}/${campaign.maxContactsPerDay})`);

  let dispatched = 0;

  for (const lead of leads) {
    try {
      const blacklist = await checkBlacklist(lead.phoneNumber, workspaceId);
      if (blacklist.blocked) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { isBlacklisted: true, blacklistReason: blacklist.reason },
        });
        await job.log(`Lead ${lead.id}: blacklisted (${blacklist.reason}). Skipping.`);
        continue;
      }

      const optimalTime = await scheduleOptimalTime({ phoneNumber: lead.phoneNumber, id: lead.id });
      const delayMs = optimalTime.getTime() - Date.now();
      if (delayMs > 5000) {
        await job.log(`Lead ${lead.id}: optimal send at ${optimalTime.toISOString()}, scheduling with ${Math.round(delayMs / 1000)}s delay.`);
        await job.moveToDelayed(delayMs);
        continue;
      }

      const variants = campaign.openingMessageVariants as { content: string; language: string }[] | null;
      if (!variants || variants.length === 0) {
        await job.log(`Lead ${lead.id}: no opening message variants. Skipping.`);
        continue;
      }

      const preferredLang = lead.detectedLanguage || 'en';
      let bestVariant = variants.find((v) => v.language === preferredLang) || variants[0];

      const noResponseDays = lead.lastMessageSentAt
        ? (Date.now() - lead.lastMessageSentAt.getTime()) / (1000 * 86400)
        : 99;

      if (noResponseDays < 2 && lead.status !== 'New') {
        await job.log(`Lead ${lead.id}: waiting for response (${Math.round(noResponseDays * 10) / 10}d since last message). Skipping.`);
        continue;
      }

      if (noResponseDays >= 2 && lead.status !== 'New' && lead.messagesReceived === 0) {
        const retryIndex = Math.min(Math.floor(noResponseDays / 2), variants.length - 1);
        const retryVariants = variants.filter((v) => v.language === preferredLang);
        bestVariant = retryVariants[retryIndex] || variants[Math.min(retryIndex, variants.length - 1)];
      }

      const personalizedContent = bestVariant.content
        .replace(/\{\{name\}\}/g, lead.name || 'there')
        .replace(/\{\{company\}\}/g, lead.companyName || 'your company')
        .replace(/\{\{title\}\}/g, lead.jobTitle || '');

      const result = await sendText(lead.phoneNumber, personalizedContent, false, channel.phoneNumberId, accessToken);

      if (result.queued) {
        await job.log(`Lead ${lead.id}: rate limited, will retry later.`);
        continue;
      }

      const waMessageId = (result.messages as Record<string, unknown>[])?.[0]?.id as string | undefined;

      await prisma.prospectingMessage.create({
        data: {
          leadId: lead.id,
          campaignId,
          direction: 'outbound',
          content: personalizedContent,
          variantId: bestVariant.language,
          sentVia: 'whatsapp',
          includesUnsubscribe: true,
        },
      });

      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          status: 'Contacted',
          messagesSent: { increment: 1 },
          lastMessageSentAt: new Date(),
          lastSentVariantId: waMessageId,
        },
      });

      await prisma.prospectingCampaign.update({
        where: { id: campaignId },
        data: { totalContacted: { increment: 1 } },
      });

      dispatched++;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      await job.log(`Lead ${lead.id}: dispatch error - ${errorMessage}`);
    }
  }

  await job.log(`Dispatched ${dispatched}/${leads.length} messages for campaign ${campaignId}`);

  if (dispatched === 0 && dailyRemaining > 0) {
    await job.moveToDelayed(5 * 60 * 1000);
  } else if (dailyRemaining > 0) {
    await job.moveToDelayed(60 * 1000);
  }

  const workspaceDailyLimit = 1000;
  const workspaceSentToday = await redis.get(`wa:daily:${channel.phoneNumberId}`);
  const wsCount = parseInt(workspaceSentToday || '0', 10);
  if (wsCount + dispatched > workspaceDailyLimit) {
    await job.log(`Workspace daily limit (${workspaceDailyLimit}) approaching. Slowing down.`);
    await job.moveToDelayed(120 * 1000);
  }

}, {
  connection: redis,
  concurrency: 3,
  lockDuration: 60000,
});

worker.on('completed', (job: Job) => {
  console.log(`[Dispatcher] Job ${job.id} completed for campaign ${job.data.campaignId}`);
});

worker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`[Dispatcher] Job ${job?.id} failed:`, err.message);
});

export default worker;
