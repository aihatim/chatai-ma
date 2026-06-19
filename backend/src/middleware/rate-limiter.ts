import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Redis from 'ioredis';

interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
  keyPrefix: string;
}

const LIMITS: Record<string, RateLimitConfig> = {
  website: { maxRequests: 30, windowSeconds: 60, keyPrefix: 'rl:website:' },
  whatsapp: { maxRequests: 60, windowSeconds: 60, keyPrefix: 'rl:whatsapp:' },
  prospecting: { maxRequests: 999999, windowSeconds: 86400, keyPrefix: 'rl:prospecting:' },
  admin: { maxRequests: 200, windowSeconds: 60, keyPrefix: 'rl:admin:' },
  upload: { maxRequests: 10, windowSeconds: 60, keyPrefix: 'rl:upload:' },
};

async function checkRateLimit(
  redis: Redis,
  key: string,
  config: RateLimitConfig,
): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> {
  const now = Date.now();
  const windowStart = now - config.windowSeconds * 1000;

  const multi = redis.multi();
  multi.zremrangebyscore(key, 0, windowStart);
  multi.zadd(key, now, `${now}-${Math.random()}`);
  multi.zcard(key);
  multi.expire(key, config.windowSeconds + 1);

  const [, , count] = await multi.exec() as [any, any, [null, number]];

  const currentCount = count[1] as number;
  const allowed = currentCount <= config.maxRequests;

  if (!allowed) {
    const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
    const oldestTimestamp = parseInt(oldest[1] || '0', 10);
    const retryAfter = Math.max(1, Math.ceil((oldestTimestamp - windowStart) / 1000));

    return { allowed: false, remaining: 0, retryAfter };
  }

  return { allowed: true, remaining: config.maxRequests - currentCount, retryAfter: 0 };
}

export async function rateLimitWebsiteWidget(request: FastifyRequest, reply: FastifyReply) {
  const redis: Redis = (request as any).server.redis;
  const sessionId = (request.body as any)?.sessionId || request.headers['x-session-id'] as string;

  if (!sessionId) {
    return reply.status(429).send({
      error: { code: 'RATE_LIMITED', message: 'Session identifier required for rate limiting' },
    });
  }

  const key = `rl:website:${sessionId}`;
  const result = await checkRateLimit(redis, key, LIMITS.website);

  reply.header('X-RateLimit-Limit', LIMITS.website.maxRequests);
  reply.header('X-RateLimit-Remaining', result.remaining);

  if (!result.allowed) {
    reply.header('Retry-After', result.retryAfter);
    return reply.status(429).send({
      error: { code: 'RATE_LIMITED', message: `Too many requests. Retry after ${result.retryAfter} seconds.` },
    });
  }
}

export async function rateLimitWhatsApp(request: FastifyRequest, reply: FastifyReply) {
  const redis: Redis = (request as any).server.redis;
  const workspaceId = request.workspaceId;

  if (!workspaceId) {
    return reply.status(429).send({
      error: { code: 'RATE_LIMITED', message: 'Workspace required for rate limiting' },
    });
  }

  const key = `rl:whatsapp:${workspaceId}`;
  const result = await checkRateLimit(redis, key, LIMITS.whatsapp);

  reply.header('X-RateLimit-Limit', LIMITS.whatsapp.maxRequests);
  reply.header('X-RateLimit-Remaining', result.remaining);

  if (!result.allowed) {
    reply.header('Retry-After', result.retryAfter);
    return reply.status(429).send({
      error: { code: 'RATE_LIMITED', message: `WhatsApp rate limit exceeded. Retry after ${result.retryAfter} seconds.` },
    });
  }
}

export async function rateLimitProspecting(request: FastifyRequest, reply: FastifyReply) {
  const redis: Redis = (request as any).server.redis;
  const campaignId = (request.params as any)?.campaignId || (request.body as any)?.campaignId;

  if (!campaignId) {
    return reply.status(429).send({
      error: { code: 'RATE_LIMITED', message: 'Campaign ID required for prospecting rate limiting' },
    });
  }

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const campaign = await prisma.prospectingCampaign.findUnique({
    where: { id: campaignId },
    select: { maxContactsPerDay: true },
  });
  await prisma.$disconnect();

  const dailyLimit = campaign?.maxContactsPerDay || 100;
  const config: RateLimitConfig = {
    maxRequests: dailyLimit,
    windowSeconds: 86400,
    keyPrefix: 'rl:prospecting:',
  };

  const key = `rl:prospecting:${campaignId}`;
  const result = await checkRateLimit(redis, key, config);

  reply.header('X-RateLimit-Limit', dailyLimit);
  reply.header('X-RateLimit-Remaining', result.remaining);

  if (!result.allowed) {
    reply.header('Retry-After', result.retryAfter);
    return reply.status(429).send({
      error: { code: 'RATE_LIMITED', message: `Daily prospecting limit reached for campaign. Retry after ${result.retryAfter} seconds.` },
    });
  }
}

export async function rateLimitAdminApi(request: FastifyRequest, reply: FastifyReply) {
  const redis: Redis = (request as any).server.redis;
  const userId = request.user?.userId;

  if (!userId) return;

  const key = `rl:admin:${userId}`;
  const result = await checkRateLimit(redis, key, LIMITS.admin);

  reply.header('X-RateLimit-Limit', LIMITS.admin.maxRequests);
  reply.header('X-RateLimit-Remaining', result.remaining);

  if (!result.allowed) {
    reply.header('Retry-After', result.retryAfter);
    return reply.status(429).send({
      error: { code: 'RATE_LIMITED', message: `Admin API rate limit exceeded. Retry after ${result.retryAfter} seconds.` },
    });
  }
}

export async function rateLimitFileUpload(request: FastifyRequest, reply: FastifyReply) {
  const redis: Redis = (request as any).server.redis;
  const workspaceId = request.workspaceId;

  if (!workspaceId) {
    return reply.status(429).send({
      error: { code: 'RATE_LIMITED', message: 'Workspace required for rate limiting' },
    });
  }

  const key = `rl:upload:${workspaceId}`;
  const result = await checkRateLimit(redis, key, LIMITS.upload);

  reply.header('X-RateLimit-Limit', LIMITS.upload.maxRequests);
  reply.header('X-RateLimit-Remaining', result.remaining);

  if (!result.allowed) {
    reply.header('Retry-After', result.retryAfter);
    return reply.status(429).send({
      error: { code: 'RATE_LIMITED', message: `File upload rate limit exceeded. Retry after ${result.retryAfter} seconds.` },
    });
  }
}

export default async function (instance: FastifyInstance) {
  instance.decorate('rateLimitWebsiteWidget', rateLimitWebsiteWidget);
  instance.decorate('rateLimitWhatsApp', rateLimitWhatsApp);
  instance.decorate('rateLimitProspecting', rateLimitProspecting);
  instance.decorate('rateLimitAdminApi', rateLimitAdminApi);
  instance.decorate('rateLimitFileUpload', rateLimitFileUpload);
}

declare module 'fastify' {
  interface FastifyInstance {
    rateLimitWebsiteWidget: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    rateLimitWhatsApp: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    rateLimitProspecting: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    rateLimitAdminApi: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    rateLimitFileUpload: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
