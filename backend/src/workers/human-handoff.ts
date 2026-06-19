import { Worker, Job } from 'bullmq';
import { prisma, redis } from '../lib/prisma';

interface HandoffJobData {
  campaignId: string;
  leadId: string;
  workspaceId: string;
  leadName: string | null;
  leadCompany: string | null;
  score: number;
  bant: {
    budgetConfirmed: boolean | null;
    authorityConfirmed: boolean | null;
    needConfirmed: boolean | null;
    timelineConfirmed: boolean | null;
  };
  detectedIntent: string;
  sentiment: string;
  lastMessages: { content: string; direction: string; sentAt: Date }[];
}

const worker = new Worker<HandoffJobData>('human-handoff-requests', async (job: Job<HandoffJobData>) => {
  const { campaignId, leadId, workspaceId, leadName, leadCompany, score, bant, detectedIntent, sentiment, lastMessages } = job.data;

  const salesManagers = await prisma.workspaceMember.findMany({
    where: { workspaceId, role: 'sales_manager' },
    select: { userId: true },
  });

  if (salesManagers.length === 0) {
    await job.log(`No sales managers found for workspace ${workspaceId}. Skipping handoff.`);
    return;
  }

  const notification = {
    type: 'lead_qualified',
    campaignId,
    leadId,
    leadName: leadName || 'Unknown Lead',
    leadCompany: leadCompany || '',
    score,
    bantSummary: `${bant.budgetConfirmed ? '✅' : '❌'} Budget | ${bant.authorityConfirmed ? '✅' : '❌'} Authority | ${bant.needConfirmed ? '✅' : '❌'} Need | ${bant.timelineConfirmed ? '✅' : '❌'} Timeline`,
    intent: detectedIntent,
    sentiment,
    recentConversation: lastMessages.map((m) => `[${m.direction}] ${m.content}`).join('\n'),
    timestamp: new Date().toISOString(),
  };

  for (const manager of salesManagers) {
    await redis.lpush(
      `notifications:${manager.userId}`,
      JSON.stringify(notification),
    );
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: { status: 'Qualified' },
  });

  await job.log(`Handoff notification sent for lead ${leadId} (${leadName}) to ${salesManagers.length} sales managers.`);
}, {
  connection: redis,
  concurrency: 5,
  lockDuration: 30000,
});

worker.on('completed', (job: Job) => {
  console.log(`[HumanHandoff] Job ${job.id} completed for lead ${job.data.leadId}`);
});

worker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`[HumanHandoff] Job ${job?.id} failed:`, err.message);
});

export default worker;
