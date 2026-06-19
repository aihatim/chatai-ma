import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
});

const updateOrgSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  logoUrl: z.string().url().optional(),
});

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'member']),
});

export default async function (instance: FastifyInstance) {
  const prisma: PrismaClient = instance.prisma;

  instance.addHook('preHandler', instance.authenticate);

  instance.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.userId;

    const memberships = await prisma.orgMember.findMany({
      where: { userId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            plan: true,
            isActive: true,
            createdAt: true,
            _count: { select: { members: true, workspaces: true } },
          },
        },
      },
      orderBy: { organization: { createdAt: 'desc' } },
    });

    return memberships.map((m) => ({
      ...m.organization,
      role: m.role,
    }));
  });

  instance.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createOrgSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const userId = request.user!.userId;
    const { name } = parsed.data;

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();

    const org = await prisma.organization.create({
      data: { name, slug, ownerId: userId },
    });

    await prisma.orgMember.create({
      data: { organizationId: org.id, userId, role: 'owner' },
    });

    const workspace = await prisma.workspace.create({
      data: {
        organizationId: org.id,
        name: `${name} Workspace`,
        slug: `${slug}-workspace`,
      },
    });

    await prisma.workspaceMember.create({
      data: { workspaceId: workspace.id, userId, role: 'admin' },
    });

    return reply.status(201).send({
      ...org,
      workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
    });
  });

  instance.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.userId;

    const membership = await prisma.orgMember.findFirst({
      where: { organizationId: id, userId },
      include: {
        organization: {
          include: {
            _count: { select: { members: true, workspaces: true } },
          },
        },
      },
    });

    if (!membership) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Organization not found' },
      });
    }

    return { ...membership.organization, role: membership.role };
  });

  instance.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.userId;

    const membership = await prisma.orgMember.findFirst({
      where: { organizationId: id, userId },
    });

    if (!membership) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Organization not found' },
      });
    }

    if (membership.role !== 'owner' && membership.role !== 'admin') {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'Only owners and admins can update the organization' },
      });
    }

    const parsed = updateOrgSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const org = await prisma.organization.update({
      where: { id },
      data: parsed.data,
    });

    return org;
  });

  instance.get('/:id/members', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.userId;

    const membership = await prisma.orgMember.findFirst({
      where: { organizationId: id, userId },
    });

    if (!membership) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Organization not found' },
      });
    }

    const members = await prisma.orgMember.findMany({
      where: { organizationId: id },
      include: {
        user: {
          select: { id: true, email: true, name: true, imageUrl: true },
        },
      },
      orderBy: { user: { name: 'asc' } },
    });

    return members.map((m) => ({
      id: m.id,
      role: m.role,
      user: m.user,
      joinedAt: m.user.createdAt,
    }));
  });

  instance.post('/:id/members', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.userId;

    const membership = await prisma.orgMember.findFirst({
      where: { organizationId: id, userId },
    });

    if (!membership) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Organization not found' },
      });
    }

    if (membership.role !== 'owner' && membership.role !== 'admin') {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'Only owners and admins can invite members' },
      });
    }

    const parsed = inviteMemberSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const { email, role } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.status(404).send({
        error: { code: 'USER_NOT_FOUND', message: 'No user found with this email. They must sign up first.' },
      });
    }

    const existingMember = await prisma.orgMember.findUnique({
      where: { organizationId_userId: { organizationId: id, userId: user.id } },
    });
    if (existingMember) {
      return reply.status(409).send({
        error: { code: 'ALREADY_MEMBER', message: 'User is already a member of this organization' },
      });
    }

    const member = await prisma.orgMember.create({
      data: { organizationId: id, userId: user.id, role },
      include: {
        user: { select: { id: true, email: true, name: true, imageUrl: true } },
      },
    });

    return reply.status(201).send({
      id: member.id,
      role: member.role,
      user: member.user,
    });
  });
}
