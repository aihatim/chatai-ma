import { prisma, redis } from '../lib/prisma';
import crypto from 'crypto';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

async function callGroq(messages: { role: string; content: string }[], temperature = 0.7, maxTokens = 1024): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(`Groq API error: ${(data.error as Record<string, unknown>)?.message || response.statusText}`);
  }
  const msg = (data.choices as Record<string, unknown>[])?.[0]?.message as Record<string, string> | undefined;
  return msg?.content || '';
}

const SCORE_WEIGHTS = {
  industryMatch: 30,
  companySize: 20,
  websiteAiReadiness: 25,
  socialPresence: 15,
  jobTitleRelevance: 10,
};

interface LeadData {
  industry?: string;
  companyName?: string;
  companySize?: string;
  website?: string;
  socialLinks?: string[];
  jobTitle?: string;
  targetIndustries?: string[];
  targetCompanySizes?: string[];
  targetJobTitles?: string[];
  keywords?: string[];
}

export function scoreLead(leadData: LeadData): { score: number; factors: Record<string, number> } {
  const factors: Record<string, number> = {};
  let total = 0;

  const industry = (leadData.industry || '').toLowerCase();
  const targetIndustries = (leadData.targetIndustries || [] as string[]).map((i) => i.toLowerCase());
  if (targetIndustries.length > 0) {
    const matchScore = targetIndustries.some((ti) => industry.includes(ti) || ti.includes(industry)) ? SCORE_WEIGHTS.industryMatch : 0;
    factors.industryMatch = matchScore;
    total += matchScore;
  } else {
    factors.industryMatch = SCORE_WEIGHTS.industryMatch * 0.5;
    total += factors.industryMatch;
  }

  const companySize = (leadData.companySize || '').toLowerCase();
  const targetSizes = (leadData.targetCompanySizes || [] as string[]).map((s) => s.toLowerCase());
  if (targetSizes.length > 0 && companySize) {
    const sizeRanges: Record<string, number> = { '1-10': 10, '11-50': 50, '51-200': 200, '201-500': 500, '501-1000': 1000, '1001+': 5000 };
    const leadVal = sizeRanges[companySize] || 0;
    let bestMatch = 0;
    for (const ts of targetSizes) {
      const targetVal = sizeRanges[ts] || 0;
      const match = targetVal === 0 ? 0 : Math.min(leadVal / targetVal, targetVal / leadVal) * SCORE_WEIGHTS.companySize;
      bestMatch = Math.max(bestMatch, match);
    }
    factors.companySize = Math.round(bestMatch);
    total += factors.companySize;
  } else {
    factors.companySize = companySize ? SCORE_WEIGHTS.companySize * 0.5 : 0;
    total += factors.companySize;
  }

  const website = leadData.website || '';
  let websiteScore = 0;
  if (website) {
    const hasBlog = /blog|news|insights/i.test(website);
    const hasChat = /chat|live|support|contact/i.test(website);
    const keywords = leadData.keywords || [];
    const hasKeywords = keywords.length === 0 || keywords.some((k) => website.toLowerCase().includes(k.toLowerCase()));
    if (hasBlog) websiteScore += 10;
    if (hasChat) websiteScore += 8;
    if (hasKeywords) websiteScore += 7;
  }
  factors.websiteAiReadiness = Math.min(websiteScore, SCORE_WEIGHTS.websiteAiReadiness);
  total += factors.websiteAiReadiness;

  const socialLinks = leadData.socialLinks || [];
  let socialScore = 0;
  if (socialLinks.length > 0) {
    socialScore += Math.min(socialLinks.length * 5, 10);
    const hasLinkedIn = socialLinks.some((l) => l.includes('linkedin'));
    if (hasLinkedIn) socialScore += 5;
  }
  factors.socialPresence = Math.min(socialScore, SCORE_WEIGHTS.socialPresence);
  total += factors.socialPresence;

  const jobTitle = (leadData.jobTitle || '').toLowerCase();
  const targetTitles = (leadData.targetJobTitles || [] as string[]).map((t) => t.toLowerCase());
  if (targetTitles.length > 0 && jobTitle) {
    const matchScore = targetTitles.some((tt) => jobTitle.includes(tt) || tt.includes(jobTitle)) ? SCORE_WEIGHTS.jobTitleRelevance : 0;
    factors.jobTitleRelevance = matchScore;
    total += matchScore;
  } else {
    const leadershipKeywords = ['ceo', 'founder', 'director', 'head', 'vp', 'chief', 'manager', 'lead'];
    const hasLeadership = leadershipKeywords.some((kw) => jobTitle.includes(kw));
    factors.jobTitleRelevance = jobTitle ? (hasLeadership ? SCORE_WEIGHTS.jobTitleRelevance : SCORE_WEIGHTS.jobTitleRelevance * 0.5) : 0;
    total += factors.jobTitleRelevance;
  }

  return { score: Math.min(Math.round(total), 100), factors };
}

export async function generateOpeningMessages(
  campaign: { name: string; valueProposition?: string | null; ctaType: string; targetIndustries?: unknown; targetGeographies?: unknown; targetJobTitles?: unknown },
  lead: { name?: string | null; companyName?: string | null; jobTitle?: string | null; industry?: string | null; website?: string | null },
  count = 5,
): Promise<{ variants: { content: string; language: string }[] }> {
  const prompt = `Generate ${count} personalized WhatsApp opening messages for a prospecting campaign. The messages should be in a mix of English, French, Arabic, and Moroccan Darija.

Campaign: "${campaign.name}"
Value Proposition: "${campaign.valueProposition || ''}"
CTA Type: ${campaign.ctaType}

Lead Details:
- Name: ${lead.name || 'Valued Prospect'}
- Company: ${lead.companyName || 'their company'}
- Job Title: ${lead.jobTitle || 'Professional'}
- Industry: ${lead.industry || 'their industry'}
- Website: ${lead.website || 'N/A'}

Rules:
1. Each message must be personalized with the lead's name and company
2. Messages should be conversational and not sound like spam
3. Include a clear call-to-action
4. Do not use emojis
5. Messages should be under 150 characters
6. Generate at least one message in each language (en, fr, ar, ary)
7. Make the Arabic (ar) messages formal, and the Darija (ary) messages casual

Return the messages as a JSON array of objects with keys "content" and "language" (one of: en, fr, ar, ary).
Example: [{"content": "Hello [name], I noticed...", "language": "en"}, ...]`;

  const result = await callGroq(
    [{ role: 'system', content: 'You are a sales prospecting expert. Return ONLY valid JSON.' }, { role: 'user', content: prompt }],
    0.8,
    2048,
  );

  try {
    const cleaned = result.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim();
    const variants = JSON.parse(cleaned) as { content: string; language: string }[];
    return { variants: variants.slice(0, count) };
  } catch {
    return {
      variants: [
        { content: `Hi ${lead.name || 'there'}, I came across ${lead.companyName || 'your company'} and thought we could help. Would you be open to a quick chat?`, language: 'en' },
        { content: `Bonjour ${lead.name || 'cher professionnel'}, je me suis intéressé à ${lead.companyName || 'votre entreprise'}. Pouvons-nous échanger rapidement ?`, language: 'fr' },
        { content: `السلام عليكم ${lead.name || 'السيد'}، لاحظت اهتمام ${lead.companyName || 'شركتكم'} بمجالنا. هل يمكننا التحدث؟`, language: 'ar' },
        { content: `سلام ${lead.name || 'صاحبي'}, شفت ${lead.companyName || 'شركتكم'} و عجبني. واش ممكن ندوزو ندويو شويا؟`, language: 'ary' },
        { content: `Hi ${lead.name || 'there'}, ${lead.companyName || 'your company'} looks interesting! Can I share how we help businesses like yours grow?`, language: 'en' },
      ],
    };
  }
}

interface BANTResult {
  budgetConfirmed: boolean;
  authorityConfirmed: boolean;
  needConfirmed: boolean;
  timelineConfirmed: boolean;
  budgetDetails?: string;
  authorityDetails?: string;
  needDetails?: string;
  timelineDetails?: string;
}

export async function qualifyLead(conversationHistory: { role: string; content: string }[]): Promise<BANTResult> {
  const historyText = conversationHistory.map((m) => `${m.role}: ${m.content}`).join('\n');

  const prompt = `Analyze the following sales conversation and extract BANT (Budget, Authority, Need, Timeline) qualification status.

Conversation:
${historyText}

Return a JSON object with:
- budgetConfirmed (boolean): Did they discuss budget and indicate they have it?
- authorityConfirmed (boolean): Is the person a decision-maker?
- needConfirmed (boolean): Did they express a clear need/pain point?
- timelineConfirmed (boolean): Did they mention a timeline for purchase?
- budgetDetails (string): Brief note on budget discussion
- authorityDetails (string): Brief note on authority indication
- needDetails (string): Brief note on identified need
- timelineDetails (string): Brief note on timeline mentioned

Example output:
{"budgetConfirmed": false, "authorityConfirmed": true, "needConfirmed": true, "timelineConfirmed": false, "budgetDetails": "No budget discussed", "authorityDetails": "Is the CEO", "needDetails": "Needs better CRM integration", "timelineDetails": "No timeline mentioned"}`;

  const result = await callGroq(
    [{ role: 'system', content: 'You are a BANT qualification expert. Return ONLY valid JSON.' }, { role: 'user', content: prompt }],
    0.3,
    1024,
  );

  try {
    const cleaned = result.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim();
    return JSON.parse(cleaned) as BANTResult;
  } catch {
    return {
      budgetConfirmed: false,
      authorityConfirmed: false,
      needConfirmed: false,
      timelineConfirmed: false,
    };
  }
}

export async function checkBlacklist(phoneNumber: string, workspaceId: string): Promise<{ blocked: boolean; reason?: string }> {
  const phoneHash = crypto.createHash('sha256').update(phoneNumber.trim()).digest('hex');

  const workspaceDnc = await prisma.doNotContactList.findFirst({
    where: { workspaceId, phoneHash },
  });
  if (workspaceDnc) {
    return { blocked: true, reason: workspaceDnc.reason };
  }

  const platformDnc = await prisma.doNotContactList.findFirst({
    where: { phoneHash, workspaceId: { not: workspaceId } },
  });
  if (platformDnc) {
    return { blocked: true, reason: `Platform ${platformDnc.reason}` };
  }

  const customerDnc = await prisma.customer.findFirst({
    where: { workspaceId, phone: phoneNumber, isBlacklisted: true },
  });
  if (customerDnc) {
    return { blocked: true, reason: 'Customer blacklisted' };
  }

  return { blocked: false };
}

export function hashPhone(phone: string): string {
  return crypto.createHash('sha256').update(phone).digest('hex');
}

export function calculateDailyUsage(campaignId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return prisma.prospectingMessage.count({
    where: {
      campaignId,
      direction: 'outbound',
      sentAt: { gte: startOfDay },
    },
  });
}

export interface EnrichedLead {
  industry: string;
  companySize: string;
  website: string;
  socialProfiles: string[];
}

export async function enrichLeadFromWeb(phoneNumber: string, companyName: string): Promise<EnrichedLead> {
  const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');
  if (!/^\+?\d{7,15}$/.test(cleaned)) {
    throw new Error(`Invalid phone number format: ${phoneNumber}`);
  }

  const prompt = `You are a business data enrichment tool. Given a company name, return structured business information.
Company: "${companyName}"

Return a JSON object with:
- industry: the industry the company operates in
- companySize: estimated company size range (1-10, 11-50, 51-200, 201-500, 501-1000, 1001+)
- website: the company's likely website URL
- socialProfiles: array of likely social media profile URLs (LinkedIn, Twitter, Facebook)

Only return valid JSON. If unsure, make reasonable estimates based on the company name.`;

  try {
    const result = await callGroq(
      [{ role: 'system', content: 'You are a business data enrichment tool. Return ONLY valid JSON.' }, { role: 'user', content: prompt }],
      0.3,
      1024,
    );
    const cleaned = result.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim();
    return JSON.parse(cleaned) as EnrichedLead;
  } catch {
    return {
      industry: 'Technology',
      companySize: '11-50',
      website: `https://${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
      socialProfiles: [
        `https://linkedin.com/company/${companyName.toLowerCase().replace(/\s+/g, '')}`,
      ],
    };
  }
}

interface CountryTimezone {
  countryCode: string;
  timezone: string;
}

const PHONE_COUNTRY_MAP: Record<string, CountryTimezone> = {
  '212': { countryCode: 'MA', timezone: 'Africa/Casablanca' },
  '213': { countryCode: 'DZ', timezone: 'Africa/Algiers' },
  '216': { countryCode: 'TN', timezone: 'Africa/Tunis' },
  '33': { countryCode: 'FR', timezone: 'Europe/Paris' },
  '1': { countryCode: 'US', timezone: 'America/New_York' },
  '44': { countryCode: 'GB', timezone: 'Europe/London' },
  '49': { countryCode: 'DE', timezone: 'Europe/Berlin' },
  '34': { countryCode: 'ES', timezone: 'Europe/Madrid' },
  '32': { countryCode: 'BE', timezone: 'Europe/Brussels' },
  '31': { countryCode: 'NL', timezone: 'Europe/Amsterdam' },
  '39': { countryCode: 'IT', timezone: 'Europe/Rome' },
  '351': { countryCode: 'PT', timezone: 'Europe/Lisbon' },
  '966': { countryCode: 'SA', timezone: 'Asia/Riyadh' },
  '971': { countryCode: 'AE', timezone: 'Asia/Dubai' },
  '974': { countryCode: 'QA', timezone: 'Asia/Qatar' },
  '973': { countryCode: 'BH', timezone: 'Asia/Bahrain' },
  '965': { countryCode: 'KW', timezone: 'Asia/Kuwait' },
  '20': { countryCode: 'EG', timezone: 'Africa/Cairo' },
  '91': { countryCode: 'IN', timezone: 'Asia/Kolkata' },
  '86': { countryCode: 'CN', timezone: 'Asia/Shanghai' },
};

function getTimezoneFromPhone(phone: string): string {
  for (const [code, info] of Object.entries(PHONE_COUNTRY_MAP)) {
    if (phone.startsWith(`+${code}`) || phone.startsWith(code)) {
      return info.timezone;
    }
  }
  return 'Africa/Casablanca';
}

export async function scheduleOptimalTime(lead: {
  phoneNumber: string;
  id?: string;
}): Promise<Date> {
  const timezone = getTimezoneFromPhone(lead.phoneNumber);

  const recentMessages = lead.id ? await prisma.prospectingMessage.findMany({
    where: { leadId: lead.id, direction: 'inbound' },
    select: { sentAt: true },
    orderBy: { sentAt: 'asc' },
  }) : [];

  if (recentMessages.length >= 3) {
    const hourCounts: Record<number, number> = {};
    for (const msg of recentMessages) {
      const localHour = new Date(msg.sentAt.toLocaleString('en-US', { timeZone: timezone })).getHours();
      hourCounts[localHour] = (hourCounts[localHour] || 0) + 1;
    }
    const bestHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    if (bestHour) {
      const now = new Date();
      const localParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      }).formatToParts(now);

      const localNow = new Date(
        `${localParts.find((p) => p.type === 'year')?.value}-${localParts.find((p) => p.type === 'month')?.value}-${localParts.find((p) => p.type === 'day')?.value}T${localParts.find((p) => p.type === 'hour')?.value}:${localParts.find((p) => p.type === 'minute')?.value}:${localParts.find((p) => p.type === 'second')?.value}`,
      );

      const optimalLocal = new Date(localNow);
      optimalLocal.setHours(parseInt(bestHour[0]), 0, 0, 0);

      if (optimalLocal <= localNow) {
        optimalLocal.setDate(optimalLocal.getDate() + 1);
      }

      const utcOffset = getUtcOffset(timezone);
      const optimalUtc = new Date(optimalLocal.getTime() - utcOffset * 60000);
      return optimalUtc;
    }
  }

  const now = new Date();
  const localParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const localNow = new Date(
    `${localParts.find((p) => p.type === 'year')?.value}-${localParts.find((p) => p.type === 'month')?.value}-${localParts.find((p) => p.type === 'day')?.value}T10:00:00`,
  );

  const utcOffset = getUtcOffset(timezone);
  const optimalUtc = new Date(localNow.getTime() - utcOffset * 60000);

  if (optimalUtc <= now) {
    optimalUtc.setDate(optimalUtc.getDate() + 1);
  }

  return optimalUtc;
}

function getUtcOffset(timezone: string): number {
  const now = new Date();
  const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  return (tzDate.getTime() - utcDate.getTime()) / 60000;
}

export interface ObjectionResponse {
  content: string;
  source: 'template' | 'generated';
  templateId?: string;
  language: string;
}

export async function generateObjectionResponses(
  category: string,
  prospectMessage: string,
  language: string,
  workspaceId: string,
): Promise<ObjectionResponse> {
  const template = await prisma.objectionTemplate.findFirst({
    where: { workspaceId, category },
    orderBy: { usageCount: 'desc' },
  });

  if (template) {
    const responses = template.responses as Record<string, string> | null;
    const response = responses?.[language] || responses?.en;
    if (response) {
      await prisma.objectionTemplate.update({
        where: { id: template.id },
        data: { usageCount: { increment: 1 }, effectivenessScore: { increment: 0.1 } },
      });
      return { content: response, source: 'template', templateId: template.id, language };
    }
  }

  const prompt = `Generate a persuasive sales objection response in ${language} for the following:

Category: ${category}
Prospect's message: "${prospectMessage}"

Write a concise response (max 200 characters) that addresses the concern professionally and moves the conversation forward. Respond in ${language}.`;

  try {
    const content = await callGroq(
      [{ role: 'system', content: 'You are a sales objection handling expert.' }, { role: 'user', content: prompt }],
      0.5,
      512,
    );
    return { content, source: 'generated', language };
  } catch {
    return {
      content: `I understand your concern. Let me share how we can address this. Would you be open to a quick call?`,
      source: 'generated',
      language,
    };
  }
}

export interface ProspectingAnalytics {
  totalLeads: number;
  contactRate: number;
  responseRate: number;
  conversionRate: number;
  meetingBookedRate: number;
  revenueGenerated: number;
  costPerLead: number;
  bestPerformingPitch: { variantId: string; responseRate: number } | null;
  bestTimeToSend: { hour: number; responseRate: number } | null;
}

export async function getProspectingAnalytics(
  workspaceId: string,
  campaignId?: string,
): Promise<ProspectingAnalytics> {
  const campaignWhere = campaignId ? { id: campaignId, workspaceId } : { workspaceId };

  const campaigns = await prisma.prospectingCampaign.findMany({
    where: campaignWhere,
    select: {
      id: true,
      totalLeads: true,
      totalContacted: true,
      totalResponded: true,
      totalQualified: true,
      totalMeetingsBooked: true,
      totalRevenueGenerated: true,
    },
  });

  const totalLeads = campaigns.reduce((s, c) => s + c.totalLeads, 0);
  const totalContacted = campaigns.reduce((s, c) => s + c.totalContacted, 0);
  const totalResponded = campaigns.reduce((s, c) => s + c.totalResponded, 0);
  const totalQualified = campaigns.reduce((s, c) => s + c.totalQualified, 0);
  const totalMeetingsBooked = campaigns.reduce((s, c) => s + c.totalMeetingsBooked, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + Number(c.totalRevenueGenerated), 0);

  const campaignIds = campaigns.map((c) => c.id);

  const [variantStats, hourlyStats] = await Promise.all([
    prisma.prospectingMessage.groupBy({
      by: ['variantId'],
      where: {
        campaignId: { in: campaignIds },
        direction: 'outbound',
        variantId: { not: null },
      },
      _count: { id: true },
      _sum: { confidenceScore: true },
    }),
    prisma.prospectingMessage.groupBy({
      by: ['sentAt'],
      where: {
        campaignId: { in: campaignIds },
        direction: 'inbound',
      },
      _count: { id: true },
    }),
  ]);

  let bestPerformingPitch: { variantId: string; responseRate: number } | null = null;
  if (variantStats.length > 0) {
    let bestRate = 0;
    for (const stat of variantStats) {
      const rate = stat._count.id / totalContacted || 0;
      if (rate > bestRate && stat.variantId) {
        bestRate = rate;
        bestPerformingPitch = { variantId: stat.variantId, responseRate: Math.round(rate * 100) / 100 };
      }
    }
  }

  let bestTimeToSend: { hour: number; responseRate: number } | null = null;
  if (hourlyStats.length > 0) {
    const hourMap: Record<number, number> = {};
    for (const stat of hourlyStats) {
      const h = stat.sentAt.getHours();
      hourMap[h] = (hourMap[h] || 0) + stat._count.id;
    }
    let maxCount = 0;
    let bestHour = 10;
    for (const [h, count] of Object.entries(hourMap)) {
      if (count > maxCount) {
        maxCount = count;
        bestHour = parseInt(h);
      }
    }
    bestTimeToSend = { hour: bestHour, responseRate: Math.round((maxCount / totalResponded || 0) * 100) / 100 };
  }

  return {
    totalLeads,
    contactRate: totalLeads > 0 ? Math.round((totalContacted / totalLeads) * 10000) / 100 : 0,
    responseRate: totalContacted > 0 ? Math.round((totalResponded / totalContacted) * 10000) / 100 : 0,
    conversionRate: totalResponded > 0 ? Math.round((totalQualified / totalResponded) * 10000) / 100 : 0,
    meetingBookedRate: totalQualified > 0 ? Math.round((totalMeetingsBooked / totalQualified) * 10000) / 100 : 0,
    revenueGenerated: totalRevenue,
    costPerLead: totalLeads > 0 ? Math.round((totalRevenue * 0.1) / totalLeads * 100) / 100 : 0,
    bestPerformingPitch,
    bestTimeToSend,
  };
}
