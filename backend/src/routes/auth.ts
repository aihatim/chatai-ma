import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { sign } from '../services/jwt';
import { hash, verify } from '../services/password';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
  organizationName: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const googleSchema = z.object({
  googleIdToken: z.string().min(1),
});

const magicLinkSchema = z.object({
  email: z.string().email(),
});

export default async function (instance: FastifyInstance) {
  const prisma: PrismaClient = instance.prisma;

  instance.post('/signup', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = signupSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const { email, password, name, organizationName } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({
        error: { code: 'EMAIL_EXISTS', message: 'A user with this email already exists' },
      });
    }

    const passwordHash = await hash(password);

    const user = await prisma.user.create({
      data: { email, name, passwordHash },
    });

    const slug = organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();

    const org = await prisma.organization.create({
      data: {
        name: organizationName,
        slug,
        ownerId: user.id,
      },
    });

    await prisma.orgMember.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        role: 'owner',
      },
    });

    const workspaceSlug = `${slug}-workspace`;
    const workspace = await prisma.workspace.create({
      data: {
        organizationId: org.id,
        name: `${organizationName} Workspace`,
        slug: workspaceSlug,
      },
    });

    await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: 'admin',
      },
    });

    const token = sign({
      userId: user.id,
      email: user.email,
      orgId: org.id,
      workspaceId: workspace.id,
      role: 'admin',
    });

    return reply.status(201).send({
      token,
      user: { id: user.id, email: user.email, name: user.name },
      organization: { id: org.id, name: org.name, slug: org.slug },
      workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
    });
  });

  instance.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return reply.status(401).send({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    const valid = await verify(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    const orgMember = await prisma.orgMember.findFirst({
      where: { userId: user.id },
      include: { organization: true },
      orderBy: { organization: { createdAt: 'asc' } },
    });

    let workspaceMember: { workspaceId: string; workspace: { id: string; name: string; slug: string }; role: string } | null = null;
    if (orgMember) {
      workspaceMember = await prisma.workspaceMember.findFirst({
        where: { userId: user.id, workspace: { organizationId: orgMember.organizationId } },
        include: { workspace: true },
        orderBy: { workspace: { createdAt: 'asc' } },
      }) as any;
    }

    const token = sign({
      userId: user.id,
      email: user.email,
      orgId: orgMember?.organizationId,
      workspaceId: workspaceMember?.workspaceId,
      role: workspaceMember?.role,
    });

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, imageUrl: user.imageUrl },
      organization: orgMember
        ? { id: orgMember.organization.id, name: orgMember.organization.name, slug: orgMember.organization.slug, role: orgMember.role }
        : null,
      workspace: workspaceMember
        ? { id: workspaceMember.workspace.id, name: workspaceMember.workspace.name, slug: workspaceMember.workspace.slug, role: workspaceMember.role }
        : null,
    };
  });

  instance.post('/google', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = googleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const { googleIdToken } = parsed.data;

    let payload: { sub: string; email: string; name?: string; picture?: string };
    try {
      const parts = googleIdToken.split('.');
      if (parts.length !== 3) throw new Error('Invalid token format');
      const body = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
      payload = { sub: body.sub, email: body.email, name: body.name, picture: body.picture };
    } catch {
      return reply.status(401).send({
        error: { code: 'INVALID_GOOGLE_TOKEN', message: 'Invalid Google ID token' },
      });
    }

    let user = await prisma.user.findUnique({ where: { googleId: payload.sub } });
    if (!user) {
      user = await prisma.user.findUnique({ where: { email: payload.email } });
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: payload.sub, imageUrl: payload.picture || user.imageUrl },
        });
      } else {
        user = await prisma.user.create({
          data: {
            email: payload.email,
            name: payload.name || payload.email.split('@')[0],
            googleId: payload.sub,
            imageUrl: payload.picture,
          },
        });
      }
    }

    let orgMember = await prisma.orgMember.findFirst({
      where: { userId: user.id },
      include: { organization: true },
      orderBy: { organization: { createdAt: 'asc' } },
    });

    if (!orgMember) {
      const slug = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
      const org = await prisma.organization.create({
        data: { name: `${user.name || user.email}'s Organization`, slug, ownerId: user.id },
      });
      await prisma.orgMember.create({
        data: { organizationId: org.id, userId: user.id, role: 'owner' },
      });
      const ws = await prisma.workspace.create({
        data: { organizationId: org.id, name: 'Default Workspace', slug: `${slug}-workspace` },
      });
      await prisma.workspaceMember.create({
        data: { workspaceId: ws.id, userId: user.id, role: 'admin' },
      });
      orgMember = await prisma.orgMember.findFirst({
        where: { userId: user.id },
        include: { organization: true },
      });
    }

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id, workspace: { organizationId: orgMember!.organizationId } },
      include: { workspace: true },
      orderBy: { workspace: { createdAt: 'asc' } },
    });

    const token = sign({
      userId: user.id,
      email: user.email,
      orgId: orgMember!.organizationId,
      workspaceId: workspaceMember?.workspaceId,
      role: workspaceMember?.role,
    });

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, imageUrl: user.imageUrl },
      organization: { id: orgMember!.organization.id, name: orgMember!.organization.name, slug: orgMember!.organization.slug, role: orgMember!.role },
      workspace: workspaceMember
        ? { id: workspaceMember.workspace.id, name: workspaceMember.workspace.name, slug: workspaceMember.workspace.slug, role: workspaceMember.role }
        : null,
    };
  });

  instance.post('/magic-link', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = magicLinkSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const { email } = parsed.data;
    instance.log.info({ email }, 'Magic link requested - placeholder email send');

    return { message: 'If the email exists, a magic link has been sent' };
  });

  instance.get('/me', { preHandler: [instance.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        imageUrl: true,
        isActive: true,
        createdAt: true,
        orgMemberships: {
          include: {
            organization: {
              select: { id: true, name: true, slug: true, logoUrl: true, plan: true, isActive: true },
            },
          },
        },
        workspaceMemberships: {
          include: {
            workspace: {
              select: { id: true, name: true, slug: true, organizationId: true, defaultLanguage: true, timezone: true },
            },
          },
        },
      },
    });

    if (!user) {
      return reply.status(404).send({
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      imageUrl: user.imageUrl,
      isActive: user.isActive,
      createdAt: user.createdAt,
      organizations: user.orgMemberships.map((m) => ({
        ...m.organization,
        role: m.role,
      })),
      workspaces: user.workspaceMemberships.map((m) => ({
        ...m.workspace,
        role: m.role,
      })),
    };
  });
}
