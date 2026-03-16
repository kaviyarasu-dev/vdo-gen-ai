import type { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError } from '../../common/errors/index.js';
import { verifyJwt } from '../../common/utils/jwt.js';
import { config } from '../../config/index.js';
import type { JwtPayload } from './auth.types.js';

const BEARER_PREFIX = 'Bearer ';

/**
 * Fastify preHandler hook that authenticates requests using a Bearer JWT.
 * On success, sets `request.user` with the decoded JWT payload.
 */
export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith(BEARER_PREFIX)) {
    throw new UnauthorizedError('Missing or malformed authorization header');
  }

  const token = authHeader.slice(BEARER_PREFIX.length);

  if (!token) {
    throw new UnauthorizedError('Missing authentication token');
  }

  try {
    const decoded = verifyJwt<JwtPayload>(token, config.JWT_ACCESS_SECRET);

    request.user = {
      userId: decoded.userId,
      email: decoded.email,
    };
  } catch {
    throw new UnauthorizedError('Invalid or expired access token');
  }
}
