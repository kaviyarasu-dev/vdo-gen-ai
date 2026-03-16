import type { Socket } from 'socket.io';
import { verifyJwt } from '../common/utils/jwt.js';
import { config } from '../config/index.js';
import { logger } from '../common/utils/logger.js';
import { SERVER_EVENTS, userRoom } from './socket.events.js';

interface JwtPayload {
  userId: string;
  email: string;
}

export interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    email: string;
  };
}

/**
 * Socket.io middleware that verifies the JWT access token
 * from the `auth.token` handshake parameter.
 *
 * On success: populates `socket.data.userId` / `socket.data.email`
 *             and auto-joins the user to their personal room.
 * On failure: emits `auth:error` and disconnects.
 */
export function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
): void {
  try {
    const token = extractToken(socket);

    if (!token) {
      return rejectConnection(socket, next, 'Authentication token required');
    }

    const payload = verifyJwt<JwtPayload>(token, config.JWT_ACCESS_SECRET);

    socket.data.userId = payload.userId;
    socket.data.email = payload.email;

    // Auto-join personal user room
    void socket.join(userRoom(payload.userId));

    logger.debug(
      { userId: payload.userId, socketId: socket.id },
      'Socket authenticated',
    );

    next();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Authentication failed';
    return rejectConnection(socket, next, message);
  }
}

function extractToken(socket: Socket): string | undefined {
  const raw = socket.handshake.auth?.token as string | undefined;

  if (!raw) {
    return undefined;
  }

  // Support both "Bearer <token>" and raw token
  return raw.startsWith('Bearer ') ? raw.slice(7) : raw;
}

function rejectConnection(
  socket: Socket,
  next: (err?: Error) => void,
  reason: string,
): void {
  logger.warn({ socketId: socket.id, reason }, 'Socket connection rejected');
  socket.emit(SERVER_EVENTS.AUTH_ERROR, { message: reason });
  next(new Error(reason));
}
