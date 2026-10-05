import { jwtVerify, SignJWT } from 'jose';
import { prisma } from './prisma.js';

const developmentSecret = 'local-development-only-secret-do-not-use-in-production';

function getSigningKey() {
  const secret = process.env.JWT_SECRET
    || (process.env.NODE_ENV === 'production' ? '' : developmentSecret);
  return secret ? new TextEncoder().encode(secret) : null;
}

export async function createAccessToken(userId) {
  const key = getSigningKey();
  if (!key) throw new Error('JWT_SECRET must be configured before issuing access tokens');

  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(key);
}

export function authenticate(request, response, next) {
  const authorization = request.get('authorization') || '';
  const [, token] = authorization.match(/^Bearer\s+(.+)$/i) || [];
  const key = getSigningKey();

  if (!key || !token) {
    return response.status(401).json({ error: 'Authentication required' });
  }

  jwtVerify(token, key)
    .then(async ({ payload }) => {
      if (typeof payload.sub !== 'string') {
        response.status(401).json({ error: 'Invalid or expired session' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true, email: true, role: true, status: true }
      });

      if (!user || (user.role === 'Admin' && user.status !== 'APPROVED')) {
        response.status(401).json({ error: 'Invalid or expired session' });
        return;
      }

      request.user = user;
      next();
    })
    .catch((error) => {
      if (error.code?.startsWith('ERR_JWT_') || error.code === 'ERR_JWS_INVALID') {
        response.status(401).json({ error: 'Invalid or expired session' });
        return;
      }
      next(error);
    });
}

export function requireRoles(...roles) {
  return (request, response, next) => {
    if (!request.user || !roles.includes(request.user.role)) {
      return response.status(403).json({ error: 'You are not authorized to perform this action' });
    }
    next();
  };
}
