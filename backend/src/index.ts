import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import dotenv from 'dotenv';

import { prisma, redis } from './lib/prisma';
import authPlugin from './middleware/auth';
import rbacPlugin from './middleware/rbac';
import authRoutes from './routes/auth';
import orgRoutes from './routes/organizations';
import workspaceRoutes from './routes/workspaces';
import chatbotRoutes from './routes/chatbots';
import websiteRoutes from './routes/website';
import whatsappRoutes from './routes/whatsapp';
import prospectingRoutes from './routes/prospecting';
import kbRoutes from './routes/knowledge-base';
import analyticsRoutes from './routes/analytics';
import billingRoutes from './routes/billing';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

const app = Fastify({
  logger: isProduction
    ? { level: process.env.LOG_LEVEL || 'info' }
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss Z' },
        },
        level: 'debug',
      },
});

// Graceful shutdown handlers
const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'Shutdown signal received');
  await app.close();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function start() {
  // CORS — locked down in production
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:4000'];

  await app.register(cors, {
    origin: isProduction ? allowedOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  });

  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, context) => ({
      error: {
        code: 'RATE_LIMITED',
        message: `Too many requests. Rate limit: ${context.max} per ${context.after}`,
      },
    }),
  });

  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

  if (!isProduction) {
    await app.register(fastifySwagger, {
      openapi: {
        info: { title: 'ChatAi.ma API', version: '0.1.0', description: 'Enterprise AI Revenue Engine' },
      },
    });
    await app.register(fastifySwaggerUi, { routePrefix: '/docs' });
  }

  // Global error handler
  app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, _request, reply) => {
    app.log.error(error);

    if (reply.statusCode >= 500) {
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: isProduction ? 'An unexpected error occurred' : error.message,
        },
      });
    }

    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      error: {
        code: error.code || 'ERROR',
        message: error.message,
      },
    });
  });

  // Health check
  app.get('/health', async () => {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Security headers
  app.addHook('onRequest', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  });

  app.decorate('prisma', prisma);
  app.decorate('redis', redis);

  await app.register(authPlugin);
  await app.register(rbacPlugin);

  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(orgRoutes, { prefix: '/api/v1/organizations' });
  await app.register(workspaceRoutes, { prefix: '/api/v1/workspaces' });
  await app.register(chatbotRoutes, { prefix: '/api/v1/chatbots' });
  await app.register(websiteRoutes, { prefix: '/api/v1/website' });
  await app.register(whatsappRoutes, { prefix: '/api/v1/whatsapp' });
  await app.register(prospectingRoutes, { prefix: '/api/v1/prospecting' });
  await app.register(kbRoutes, { prefix: '/api/v1/knowledge-base' });
  await app.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
  await app.register(billingRoutes, { prefix: '/api/v1/billing' });

  // 404 handler
  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  const port = parseInt(process.env.PORT || '4000', 10);
  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`ChatAi.ma API running on port ${port}`);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export { app };
