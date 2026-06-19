import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

type Channel = 'website' | 'whatsapp' | 'prospecting';
type Action = 'create' | 'read' | 'update' | 'delete' | 'manage' | 'respond' | 'launch' | 'read_assigned' | 'update_widget' | 'update_kb';

interface PermissionEntry {
  all?: boolean;
  channels?: Partial<Record<Channel, Action[]>>;
}

const ROLE_PERMISSIONS: Record<string, PermissionEntry> = {
  owner: { all: true },
  admin: { all: true },
  website_editor: {
    channels: {
      website: ['read', 'update', 'update_widget', 'update_kb'],
    },
  },
  whatsapp_agent: {
    channels: {
      whatsapp: ['read', 'respond'],
    },
  },
  sales_manager: {
    channels: {
      prospecting: ['create', 'read', 'update', 'delete', 'launch', 'manage'],
    },
  },
  sales_rep: {
    channels: {
      prospecting: ['read_assigned'],
    },
  },
  analyst: {
    channels: {
      website: ['read'],
      whatsapp: ['read'],
      prospecting: ['read'],
    },
  },
  api_consumer: {
    channels: {},
  },
};

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userRole = request.role;
    if (!userRole || !roles.includes(userRole)) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: `Requires one of roles: ${roles.join(', ')}`,
        },
      });
    }
  };
}

export function requireChannelAccess(channel: Channel, action: Action) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userRole = request.role;
    if (!userRole) {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'Authentication required' },
      });
    }

    const perm = ROLE_PERMISSIONS[userRole];
    if (!perm) {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: `Unknown role: ${userRole}` },
      });
    }

    if (perm.all) return;

    const channelActions = perm.channels?.[channel];
    if (!channelActions || !channelActions.includes(action)) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: `Role '${userRole}' does not have '${action}' access on channel '${channel}'`,
        },
      });
    }
  };
}

export function isOrgOwner(request: FastifyRequest, _reply: FastifyReply) {
  return request.role === 'owner';
}

export default async function (instance: FastifyInstance) {
  instance.decorate('requireRole', requireRole);
  instance.decorate('requireChannelAccess', requireChannelAccess);
}
