import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'chatai-dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface TokenPayload {
  userId: string;
  email: string;
  orgId?: string;
  workspaceId?: string;
  role?: string;
}

export function sign(payload: TokenPayload): string {
  return jwt.sign(payload as object, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as any);
}

export function verify(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}
