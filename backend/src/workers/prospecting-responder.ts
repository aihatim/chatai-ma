import { Worker, Job, Queue } from 'bullmq';
import { prisma, redis } from '../lib/prisma';
import { decryptToken, sendText } from '../services/whatsapp';
import { qualifyLead, generateOpeningMessages, scoreLead, checkBlacklist, hashPhone } from '../services/prospecting';

const handoffQueue = new Queue('human-handoff-requests', {
  connection: redis,
});

interface ResponseJob {
  campaignId: string;
  leadId: string;
  messageContent: string;
  messageId: string;
  timestamp: number;
}

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

async function callGroq(messages: { role: string; content: string }[], temperature = 0.3, maxTokens = 1024): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: GROQ_MODEL, messages, temperature, max_tokens: maxTokens }),
  });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(`Groq API error: ${(data.error as Record<string, unknown>)?.message || response.statusText}`);
  }
  const msg = (data.choices as Record<string, unknown>[])?.[0]?.message as Record<string, string> | undefined;
  return msg?.content || '';
}

interface SentimentResult {
  sentiment: 'positive' | 'neutral' | 'negative';
  intent: 'interested' | 'objection_price' | 'objection_timing' | 'not_interested' | 'meeting_request' | 'question' | 'unsubscribe' | 'other';
  confidence: number;
}

async function detectSentimentAndIntent(text: string): Promise<SentimentResult> {
  const lower = text.toLowerCase().trim();
  if (['stop', 'unsubscribe', 'arrêter', 'désabonner', 'توقف', 'توقف', 'بطل'].some((w) => lower.includes(w))) {
    return { sentiment: 'negative', intent: 'unsubscribe', confidence: 0.95 };
  }

  const prompt = `Analyze this prospect's WhatsApp message and determine sentiment and intent.

Message: "${text}"

Return JSON: {"sentiment": "positive|neutral|negative", "intent": "interested|objection_price|objection_timing|not_interested|meeting_request|question|other", "confidence": 0.0-1.0}`;

  try {
    const result = await callGroq([
      { role: 'system', content: 'You are a sales conversation analyzer. Return ONLY valid JSON.' },
      { role: 'user', content: prompt },
    ], 0.2, 512);
    const cleaned = result.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim();
    return JSON.parse(cleaned) as SentimentResult;
  } catch {
    return { sentiment: 'neutral', intent: 'other', confidence: 0.5 };
  }
}

async function handleObjection(
  objectionType: string,
  messageContent: string,
  lead: Record<string, unknown>,
  campaign: Record<string, unknown>,
): Promise<string> {
  const objectionHandlers = campaign.objectionHandlers as Record<string, string> | null;
  const handlerKey = objectionType.replace('objection_', '');
  const builtinResponse = objectionHandlers?.[handlerKey];

  if (builtinResponse) {
    return builtinResponse.replace(/\{\{name\}\}/g, (lead.name as string) || 'there');
  }

  const template = await prisma.objectionTemplate.findFirst({
    where: { workspaceId: campaign.workspaceId as string, category: handlerKey },
    orderBy: { usageCount: 'desc' },
  });

  if (template) {
    const responses = template.responses as Record<string, string> || {};
    const lang = (lead.detectedLanguage as string) || 'en';
    const response = responses[lang] || responses.en || Object.values(responses)[0];
    if (response) {
      await prisma.objectionTemplate.update({
        where: { id: template.id },
        data: { usageCount: { increment: 1 } },
      });
      return response.replace(/\{\{name\}\}/g, (lead.name as string) || 'there');
    }
  }

  const prompt = `Generate a persuasive response to this sales objection from ${lead.name || 'a prospect'} at ${lead.companyName || 'their company'}.

Objection type: ${handlerKey}
Their message: "${messageContent}"
Our value proposition: ${campaign.valueProposition || 'N/A'}

Write a concise WhatsApp response (max 200 chars) that addresses the concern and moves the conversation forward.`;

  try {
    return await callGroq([
      { role: 'system', content: 'You are a sales objection handling expert. Write persuasive, concise responses.' },
      { role: 'user', content: prompt },
    ], 0.5, 512);
  } catch {
    return `I understand your concern about ${handlerKey}. Let me share how we've helped similar companies overcome this. Would you be open to a brief call to discuss?`;
  }
}

async function handleMeetingRequest(lead: Record<string, unknown>): Promise<string> {
  return `I'd be happy to schedule a meeting! Here's my calendar link where you can pick a time that works for you: https://cal.chatai.ma/book/${lead.id}\n\nLooking forward to our conversation!`;
}

async function askBantQuestion(lead: Record<string, unknown>, answeredFields: string[]): Promise<string> {
  const bantQuestions: Record<string, string> = {
    budget: `Thanks ${lead.name || 'for your interest'}! To better understand how we can help, could you share what budget range you've allocated for this type of solution?`,
    authority: `Great! And are you the decision-maker for this, or would there be others involved in the decision?`,
    need: `What specific challenges are you looking to solve with [solution]? Understanding your needs will help me tailor the demo.`,
    timeline: `When were you thinking of implementing a solution?`,
  };

  for (const [field, question] of Object.entries(bantQuestions)) {
    if (!answeredFields.includes(field)) {
      return question;
    }
  }

  return `Thank you for all that info! Let me schedule a demo to show you exactly how we can help ${lead.companyName || 'your company'}. What time works best for you?`;
}

const worker = new Worker<ResponseJob>('prospecting-response', async (job: Job<ResponseJob>) => {
  const { campaignId, leadId, messageContent, messageId } = job.data;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { campaign: { include: { workspace: true } } },
  });
  if (!lead) {
    await job.log(`Lead ${leadId} not found.`);
    return;
  }

  const campaign = lead.campaign;
  if (campaign.status !== 'Active') {
    await job.log(`Campaign ${campaignId} is not active.`);
    return;
  }

  const channel = await prisma.whatsAppChannel.findFirst({
    where: { workspaceId: campaign.workspaceId, isActive: true, isConnected: true },
  });
  if (!channel) {
    await job.log(`No active channel for workspace ${campaign.workspaceId}`);
    return;
  }
  const accessToken = decryptToken(channel.accessTokenEncrypted);

  const detected = await detectSentimentAndIntent(messageContent);

  await prisma.prospectingMessage.update({
    where: { id: messageId },
    data: {
      sentiment: detected.sentiment.toUpperCase() as 'Positive' | 'Neutral' | 'Negative',
      intentDetected: detected.intent,
      confidenceScore: detected.confidence,
    },
  });

  if (detected.intent === 'unsubscribe') {
    const phoneHash = hashPhone(lead.phoneNumber);
    await prisma.doNotContactList.upsert({
      where: { phoneHash },
      update: { reason: 'Unsubscribed' },
      create: {
        workspaceId: campaign.workspaceId,
        phoneHash,
        reason: 'Unsubscribed',
        addedBy: campaign.createdBy,
      },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: { status: 'Unsubscribed', isBlacklisted: true, blacklistReason: 'Unsubscribed', overallSentiment: 'Negative' },
    });

    await job.log(`Lead ${leadId}: unsubscribed via STOP message. Added to DNC.`);
    return;
  }

  const recentMessages = await prisma.prospectingMessage.findMany({
    where: { leadId },
    orderBy: { sentAt: 'desc' },
    take: 20,
  });

  let responseContent = '';

  if (detected.intent.startsWith('objection_')) {
    responseContent = await handleObjection(detected.intent, messageContent, lead as unknown as Record<string, unknown>, campaign as unknown as Record<string, unknown>);
  } else if (detected.intent === 'meeting_request') {
    responseContent = await handleMeetingRequest(lead as unknown as Record<string, unknown>);
  } else if (detected.intent === 'interested') {
    const qualified = await qualifyLead(
      recentMessages.map((m) => ({ role: m.direction === 'outbound' ? 'assistant' : 'user', content: m.content })),
    );
    const answeredFields: string[] = [];
    if (qualified.budgetConfirmed) answeredFields.push('budget');
    if (qualified.authorityConfirmed) answeredFields.push('authority');
    if (qualified.needConfirmed) answeredFields.push('need');
    if (qualified.timelineConfirmed) answeredFields.push('timeline');
    responseContent = await askBantQuestion(lead as unknown as Record<string, unknown>, answeredFields);

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        budgetConfirmed: qualified.budgetConfirmed || lead.budgetConfirmed,
        authorityConfirmed: qualified.authorityConfirmed || lead.authorityConfirmed,
        needConfirmed: qualified.needConfirmed || lead.needConfirmed,
        timelineConfirmed: qualified.timelineConfirmed || lead.timelineConfirmed,
      },
    });
  } else if (detected.intent === 'not_interested') {
    responseContent = `No worries ${lead.name || 'there'}! Thanks for your time. If you ever reconsider, feel free to reach out.`;
  } else if (detected.intent === 'question') {
    responseContent = `Great question! Let me check with our team and get back to you shortly.`;
  } else {
    responseContent = `Thanks for your response ${lead.name || 'there'}! Is there anything specific you'd like to know about how we can help ${lead.companyName || 'your company'}?`;
  }

  try {
    const sent = await sendText(lead.phoneNumber, responseContent, false, channel.phoneNumberId, accessToken);
    const waMessageId = (sent.messages as Record<string, unknown>[])?.[0]?.id as string | undefined;

    await prisma.prospectingMessage.create({
      data: {
        leadId,
        campaignId,
        direction: 'outbound',
        content: responseContent,
        sentVia: 'whatsapp',
        includesUnsubscribe: responseContent.toLowerCase().includes('stop') || responseContent.toLowerCase().includes('désabonner'),
      },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        messagesSent: { increment: 1 },
        lastMessageSentAt: new Date(),
        overallSentiment: detected.sentiment.toUpperCase() as 'Positive' | 'Neutral' | 'Negative',
        status: 'Responded',
      },
    });

    const newScore = lead.score + (detected.sentiment === 'positive' ? 10 : detected.sentiment === 'negative' ? -10 : 0);
    const updatedScore = Math.min(100, Math.max(0, newScore));
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        score: updatedScore,
        scoreFactors: { ...(lead.scoreFactors as Record<string, unknown> || {}), sentimentUpdate: detected.sentiment },
      },
    });

    if (detected.intent === 'interested' && updatedScore >= 70) {
      const salesManagers = await prisma.workspaceMember.findMany({
        where: { workspaceId: campaign.workspaceId, role: 'sales_manager' },
        include: { user: { select: { id: true, email: true, name: true } } },
      });

      const notificationPayload = {
        type: 'lead_qualified',
        campaignId,
        leadId,
        leadName: lead.name,
        leadCompany: lead.companyName,
        score: updatedScore,
        timestamp: new Date().toISOString(),
      };

      for (const manager of salesManagers) {
        await redis.lpush(
          `notifications:${manager.userId}`,
          JSON.stringify(notificationPayload),
        );
      }

      await handoffQueue.add('human-handoff', {
        campaignId,
        leadId,
        workspaceId: campaign.workspaceId,
        leadName: lead.name,
        leadCompany: lead.companyName,
        score: updatedScore,
        bant: {
          budgetConfirmed: lead.budgetConfirmed,
          authorityConfirmed: lead.authorityConfirmed,
          needConfirmed: lead.needConfirmed,
          timelineConfirmed: lead.timelineConfirmed,
        },
        detectedIntent: detected.intent,
        sentiment: detected.sentiment,
        lastMessages: recentMessages.slice(0, 5).map((m) => ({
          content: m.content,
          direction: m.direction,
          sentAt: m.sentAt,
        })),
      }, {
        removeOnComplete: true,
        removeOnFail: false,
      });

      await prisma.prospectingCampaign.update({
        where: { id: campaignId },
        data: { totalQualified: { increment: 1 } },
      });
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    await job.log(`Failed to send response to lead ${leadId}: ${errorMessage}`);
  }

}, {
  connection: redis,
  concurrency: 5,
  lockDuration: 30000,
});

worker.on('completed', (job: Job) => {
  console.log(`[Responder] Job ${job.id} completed for lead ${job.data.leadId}`);
});

worker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`[Responder] Job ${job?.id} failed:`, err.message);
});

export default worker;
