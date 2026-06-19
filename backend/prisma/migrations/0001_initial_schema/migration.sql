-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('Starter', 'Pro', 'Business', 'Enterprise');
CREATE TYPE "SubscriptionStatus" AS ENUM ('Active', 'PastDue', 'Cancelled', 'Trialing');
CREATE TYPE "Channel" AS ENUM ('website', 'whatsapp', 'prospecting');
CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant', 'system', 'human_agent');
CREATE TYPE "ConversationStatus" AS ENUM ('Active', 'Escalated', 'Closed');
CREATE TYPE "LeadStatus" AS ENUM ('New', 'Contacted', 'Responded', 'Engaged', 'Qualified', 'MeetingBooked', 'Closed', 'Cold', 'Archived', 'Unsubscribed');
CREATE TYPE "CampaignStatus" AS ENUM ('Draft', 'Scheduled', 'Active', 'Paused', 'Completed', 'Cancelled');
CREATE TYPE "ChatbotStatus" AS ENUM ('Draft', 'Active', 'Paused', 'Archived');
CREATE TYPE "Sentiment" AS ENUM ('Positive', 'Neutral', 'Negative');
CREATE TYPE "Language" AS ENUM ('en', 'fr', 'ar', 'es');
CREATE TYPE "DocumentStatus" AS ENUM ('Processing', 'Ready', 'Error');
CREATE TYPE "KBStatus" AS ENUM ('Empty', 'Indexing', 'Ready', 'Error');
CREATE TYPE "FileType" AS ENUM ('pdf', 'docx', 'txt', 'md', 'csv', 'json', 'png', 'jpg', 'mp4', 'mp3', 'web_crawl');
CREATE TYPE "RevenueChannel" AS ENUM ('website', 'whatsapp', 'prospecting');

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Organization
CREATE TABLE "Organization" (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    "logoUrl" TEXT,
    "ownerId" TEXT NOT NULL,
    plan "Plan" NOT NULL DEFAULT 'Starter',
    "maxWebsites" INTEGER NOT NULL DEFAULT 1,
    "maxWhatsappNumbers" INTEGER NOT NULL DEFAULT 0,
    "maxProspectingLeadsMonthly" INTEGER NOT NULL DEFAULT 0,
    "maxConcurrentCampaigns" INTEGER NOT NULL DEFAULT 0,
    "maxKnowledgeBases" INTEGER NOT NULL DEFAULT 1,
    "maxTeamMembers" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Organization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"(id)
);

-- Workspace
CREATE TABLE "Workspace" (
    id TEXT PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    "defaultLanguage" "Language" NOT NULL DEFAULT 'fr',
    timezone TEXT NOT NULL DEFAULT 'Africa/Casablanca',
    currency TEXT NOT NULL DEFAULT 'MAD',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Workspace_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id)
);

-- User
CREATE TABLE "User" (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    "passwordHash" TEXT,
    "googleId" TEXT UNIQUE,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- OrgMember
CREATE TABLE "OrgMember" (
    id TEXT PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    UNIQUE("organizationId", "userId"),
    CONSTRAINT "OrgMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id),
    CONSTRAINT "OrgMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id)
);

-- WorkspaceMember
CREATE TABLE "WorkspaceMember" (
    id TEXT PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    UNIQUE("workspaceId", "userId"),
    CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id),
    CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id)
);

-- WebsiteChannel
CREATE TABLE "WebsiteChannel" (
    id TEXT PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    "embedToken" TEXT UNIQUE NOT NULL,
    "widgetConfig" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalConversations" INTEGER NOT NULL DEFAULT 0,
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTimeMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebsiteChannel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id)
);

-- WhatsAppChannel
CREATE TABLE "WhatsAppChannel" (
    id TEXT PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    name TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "businessAccountId" TEXT NOT NULL,
    "verifyToken" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalConversations" INTEGER NOT NULL DEFAULT 0,
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTimeMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppChannel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id)
);

-- ProspectingCampaign
CREATE TABLE "ProspectingCampaign" (
    id TEXT PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    name TEXT NOT NULL,
    status "CampaignStatus" NOT NULL DEFAULT 'Draft',
    "targetIndustries" JSONB,
    "targetCompanySizes" JSONB,
    "targetGeographies" JSONB,
    "targetJobTitles" JSONB,
    keywords JSONB,
    "dataSource" TEXT NOT NULL DEFAULT 'CSV',
    "maxContactsPerDay" INTEGER NOT NULL DEFAULT 100,
    "timeWindowStart" TEXT NOT NULL DEFAULT '09:00',
    "timeWindowEnd" TEXT NOT NULL DEFAULT '18:00',
    timezone TEXT NOT NULL DEFAULT 'Africa/Casablanca',
    "pauseWeekends" BOOLEAN NOT NULL DEFAULT true,
    "noResponseAfterNMsgs" INTEGER NOT NULL DEFAULT 3,
    "noResponseAfterDays" INTEGER NOT NULL DEFAULT 7,
    "maxConversationLength" INTEGER NOT NULL DEFAULT 5,
    "openingMessageVariants" JSONB,
    "valueProposition" TEXT,
    "objectionHandlers" JSONB,
    "ctaType" TEXT NOT NULL DEFAULT 'BookDemo',
    "knowledgeBaseId" TEXT,
    "consentConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "consentConfirmedBy" TEXT,
    "consentConfirmedAt" TIMESTAMP,
    "totalLeads" INTEGER NOT NULL DEFAULT 0,
    "totalContacted" INTEGER NOT NULL DEFAULT 0,
    "totalResponded" INTEGER NOT NULL DEFAULT 0,
    "totalQualified" INTEGER NOT NULL DEFAULT 0,
    "totalMeetingsBooked" INTEGER NOT NULL DEFAULT 0,
    "totalRevenueGenerated" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "scheduledStartAt" TIMESTAMP,
    "startedAt" TIMESTAMP,
    "pausedAt" TIMESTAMP,
    "completedAt" TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProspectingCampaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id),
    CONSTRAINT "ProspectingCampaign_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"(id),
    CONSTRAINT "ProspectingCampaign_consentConfirmedBy_fkey" FOREIGN KEY ("consentConfirmedBy") REFERENCES "User"(id),
    CONSTRAINT "ProspectingCampaign_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"(id)
);

-- Lead
CREATE TABLE "Lead" (
    id TEXT PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "phoneNumberHash" TEXT NOT NULL,
    email TEXT,
    name TEXT,
    "companyName" TEXT,
    "jobTitle" TEXT,
    industry TEXT,
    website TEXT,
    score INTEGER NOT NULL DEFAULT 0,
    "scoreFactors" JSONB,
    "scoreCalculatedAt" TIMESTAMP,
    status "LeadStatus" NOT NULL DEFAULT 'New',
    "messagesSent" INTEGER NOT NULL DEFAULT 0,
    "messagesReceived" INTEGER NOT NULL DEFAULT 0,
    "lastMessageSentAt" TIMESTAMP,
    "lastMessageReceivedAt" TIMESTAMP,
    "lastSentVariantId" TEXT,
    "budgetConfirmed" BOOLEAN,
    "authorityConfirmed" BOOLEAN,
    "needConfirmed" BOOLEAN,
    "timelineConfirmed" BOOLEAN,
    "meetingBookedAt" TIMESTAMP,
    "meetingScheduledFor" TIMESTAMP,
    "dealClosedAt" TIMESTAMP,
    "dealValue" DECIMAL(12,2),
    "overallSentiment" "Sentiment",
    "detectedLanguage" "Language",
    "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
    "blacklistReason" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ProspectingCampaign"(id),
    CONSTRAINT "Lead_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id)
);

-- ProspectingMessage
CREATE TABLE "ProspectingMessage" (
    id TEXT PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    direction TEXT NOT NULL,
    content TEXT NOT NULL,
    "variantId" TEXT,
    sentiment "Sentiment",
    "intentDetected" TEXT,
    "confidenceScore" FLOAT,
    model TEXT,
    "responseTimeMs" INTEGER,
    "includesUnsubscribe" BOOLEAN NOT NULL DEFAULT false,
    "sentVia" TEXT NOT NULL DEFAULT 'whatsapp',
    "sentAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProspectingMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"(id),
    CONSTRAINT "ProspectingMessage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ProspectingCampaign"(id)
);

-- Conversation
CREATE TABLE "Conversation" (
    id TEXT PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    channel "Channel" NOT NULL,
    "channelId" TEXT NOT NULL,
    "chatbotId" TEXT,
    "customerPhone" TEXT,
    "customerPhoneHash" TEXT,
    "customerEmail" TEXT,
    "customerId" TEXT,
    "sessionId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceDomain" TEXT,
    "userAgent" TEXT,
    "userIpHash" TEXT,
    "userCountry" TEXT,
    "userLanguage" "Language",
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "firstResponseTimeMs" INTEGER,
    "satisfactionRating" TEXT,
    "leadScore" TEXT,
    "leadTags" JSONB NOT NULL DEFAULT '[]',
    "attributedRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "revenueAttributionChannel" "RevenueChannel",
    status "ConversationStatus" NOT NULL DEFAULT 'Active',
    "escalatedTo" TEXT,
    "startedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Conversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id),
    CONSTRAINT "Conversation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"(id)
);

-- Message
CREATE TABLE "Message" (
    id TEXT PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    role "MessageRole" NOT NULL,
    content TEXT NOT NULL,
    "retrievedChunks" JSONB,
    "confidenceScore" FLOAT,
    model TEXT,
    "responseTimeMs" INTEGER,
    "whatsappMessageId" TEXT,
    "whatsappMessageType" TEXT,
    "detectedLanguage" "Language",
    "isDarija" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"(id),
    CONSTRAINT "Message_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"(id)
);

-- Customer
CREATE TABLE "Customer" (
    id TEXT PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    phone TEXT,
    "phoneHash" TEXT,
    email TEXT,
    name TEXT,
    "firstSeenAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstSeenChannel" "Channel" NOT NULL,
    "lastSeenAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenChannel" "Channel" NOT NULL,
    "totalConversations" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "preferredLanguage" "Language",
    "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Customer_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id)
);

-- KnowledgeBase
CREATE TABLE "KnowledgeBase" (
    id TEXT PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status "KBStatus" NOT NULL DEFAULT 'Empty',
    "totalDocuments" INTEGER NOT NULL DEFAULT 0,
    "totalChunks" INTEGER NOT NULL DEFAULT 0,
    "totalSizeMb" FLOAT NOT NULL DEFAULT 0,
    "lastIndexedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeBase_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id)
);

-- KnowledgeDocument
CREATE TABLE "KnowledgeDocument" (
    id TEXT PRIMARY KEY,
    "knowledgeBaseId" TEXT NOT NULL,
    filename TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "storageUrl" TEXT,
    status "DocumentStatus" NOT NULL DEFAULT 'Processing',
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP,
    CONSTRAINT "KnowledgeDocument_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"(id),
    CONSTRAINT "KnowledgeDocument_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"(id)
);

-- DocumentChunk (pgvector)
CREATE TABLE "DocumentChunk" (
    id TEXT PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(768),
    source TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"(id) ON DELETE CASCADE,
    CONSTRAINT "DocumentChunk_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_chunk_embedding ON "DocumentChunk" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_document_chunk_kb ON "DocumentChunk" ("knowledgeBaseId");
CREATE INDEX IF NOT EXISTS idx_document_chunk_doc ON "DocumentChunk" ("documentId");

-- Chatbot
CREATE TABLE "Chatbot" (
    id TEXT PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    name TEXT NOT NULL,
    channel "Channel" NOT NULL,
    "channelId" TEXT,
    status "ChatbotStatus" NOT NULL DEFAULT 'Draft',
    "personaId" TEXT,
    "customSystemPrompt" TEXT,
    temperature FLOAT NOT NULL DEFAULT 0.3,
    "maxTokens" INTEGER NOT NULL DEFAULT 1024,
    "fallbackMessageEn" TEXT,
    "fallbackMessageFr" TEXT,
    "fallbackMessageAr" TEXT,
    "fallbackMessageEs" TEXT,
    "confidenceThreshold" FLOAT NOT NULL DEFAULT 0.6,
    "widgetConfig" JSONB,
    "isChameleonEnabled" BOOLEAN NOT NULL DEFAULT false,
    "embedToken" TEXT UNIQUE,
    "autoDetectLanguage" BOOLEAN NOT NULL DEFAULT true,
    "supportedLanguages" JSONB NOT NULL DEFAULT '["en","fr","ar","es"]',
    "hitlEnabled" BOOLEAN NOT NULL DEFAULT false,
    "hitlTriggerConfidence" FLOAT NOT NULL DEFAULT 0.3,
    "activeKnowledgeBaseId" TEXT,
    "totalConversations" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTimeMs" INTEGER NOT NULL DEFAULT 0,
    "satisfactionScore" FLOAT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Chatbot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id),
    CONSTRAINT "Chatbot_activeKnowledgeBaseId_fkey" FOREIGN KEY ("activeKnowledgeBaseId") REFERENCES "KnowledgeBase"(id),
    CONSTRAINT "Chatbot_channelId_fkey_website" FOREIGN KEY ("channelId") REFERENCES "WebsiteChannel"(id),
    CONSTRAINT "Chatbot_channelId_fkey_whatsapp" FOREIGN KEY ("channelId") REFERENCES "WhatsAppChannel"(id)
);

-- ObjectionTemplate
CREATE TABLE "ObjectionTemplate" (
    id TEXT PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    category TEXT NOT NULL,
    "objectionPattern" TEXT NOT NULL,
    responses JSONB NOT NULL,
    "effectivenessScore" FLOAT NOT NULL DEFAULT 0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isBuiltin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ObjectionTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id)
);

-- DoNotContactList
CREATE TABLE "DoNotContactList" (
    id TEXT PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "phoneHash" TEXT UNIQUE NOT NULL,
    "emailHash" TEXT UNIQUE,
    reason TEXT NOT NULL,
    "addedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DoNotContactList_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id),
    CONSTRAINT "DoNotContactList_addedBy_fkey" FOREIGN KEY ("addedBy") REFERENCES "User"(id)
);

-- RevenueAttribution
CREATE TABLE "RevenueAttribution" (
    id TEXT PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "customerId" TEXT,
    channel "RevenueChannel" NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    "dealStage" TEXT NOT NULL,
    "attributedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RevenueAttribution_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id),
    CONSTRAINT "RevenueAttribution_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"(id),
    CONSTRAINT "RevenueAttribution_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"(id),
    CONSTRAINT "RevenueAttribution_attributedBy_fkey" FOREIGN KEY ("attributedBy") REFERENCES "User"(id)
);

-- ChannelAnalyticsSnapshot
CREATE TABLE "ChannelAnalyticsSnapshot" (
    id TEXT PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    channel TEXT NOT NULL,
    "chatbotId" TEXT,
    date TIMESTAMP NOT NULL,
    "totalConversations" INTEGER NOT NULL DEFAULT 0,
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "activeUsers" INTEGER NOT NULL DEFAULT 0,
    "bounceRate" FLOAT NOT NULL DEFAULT 0,
    "avgResponseTimeMs" INTEGER NOT NULL DEFAULT 0,
    "satisfactionPositive" INTEGER NOT NULL DEFAULT 0,
    "satisfactionNegative" INTEGER NOT NULL DEFAULT 0,
    "intentDistribution" JSONB NOT NULL DEFAULT '{}',
    "languageDistribution" JSONB NOT NULL DEFAULT '{}',
    "leadDistribution" JSONB NOT NULL DEFAULT '{}',
    "leadsContacted" INTEGER NOT NULL DEFAULT 0,
    "leadsResponded" INTEGER NOT NULL DEFAULT 0,
    "leadsQualified" INTEGER NOT NULL DEFAULT 0,
    "meetingsBooked" INTEGER NOT NULL DEFAULT 0,
    "revenueGenerated" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("workspaceId", channel, "chatbotId", date),
    CONSTRAINT "ChannelAnalyticsSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id)
);

-- Subscription
CREATE TABLE "Subscription" (
    id TEXT PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT UNIQUE NOT NULL,
    plan "Plan" NOT NULL,
    status "SubscriptionStatus" NOT NULL DEFAULT 'Trialing',
    "currentPeriodStart" TIMESTAMP NOT NULL,
    "currentPeriodEnd" TIMESTAMP NOT NULL,
    "whatsappConversationsUsed" INTEGER NOT NULL DEFAULT 0,
    "whatsappConversationsLimit" INTEGER NOT NULL,
    "prospectingLeadsUsed" INTEGER NOT NULL DEFAULT 0,
    "prospectingLeadsLimit" INTEGER NOT NULL,
    "amountPerMonth" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id)
);

-- Persona
CREATE TABLE "Persona" (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    "systemPrompt" TEXT NOT NULL,
    "isBuiltin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
