import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { verify, TokenPayload } from '../services/jwt';

declare module 'fastify' {
  interface FastifyRequest {
    user?: TokenPayload;
    orgId?: string;
    workspaceId?: string;
    role?: string;
  }

  interface FastifyInstance {
    prisma: PrismaClient;
    redis: Redis;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

function extractToken(request: FastifyRequest): string | null {
  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const token = extractToken(request);
  if (!token) {
    return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' } });
  }
  try {
    const payload = verify(token);
    request.user = payload;
    request.orgId = payload.orgId;
    request.workspaceId = payload.workspaceId;
    request.role = payload.role;
  } catch {
    return reply.status(401).send({ error: { code: 'TOKEN_INVALID', message: 'Token is invalid or expired' } });
  }
}

export async function optionalAuth(request: FastifyRequest, _reply: FastifyReply) {
  const token = extractToken(request);
  if (!token) return;
  try {
    const payload = verify(token);
    request.user = payload;
    request.orgId = payload.orgId;
    request.workspaceId = payload.workspaceId;
    request.role = payload.role;
  } catch {
    // silently ignore invalid tokens for optional auth
  }
}

export default async function (instance: FastifyInstance) {
  instance.decorate('authenticate', authenticate);
  instance.decorate('optionalAuth', optionalAuth);
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
