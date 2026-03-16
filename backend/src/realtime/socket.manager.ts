import { Server as SocketServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { logger } from '../common/utils/logger.js';
import { WorkflowExecutionService } from '../modules/workflows/workflow-execution.service.js';
import {
  socketAuthMiddleware,
  type AuthenticatedSocket,
} from './socket.middleware.js';
import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  executionRoom,
  projectRoom,
  userRoom,
} from './socket.events.js';

class SocketManager {
  private io: SocketServer | null = null;
  private readonly executionService = new WorkflowExecutionService();

  /**
   * Attach Socket.io to an existing HTTP server.
   * Must be called once during app bootstrap (after Fastify is listening).
   */
  initialize(httpServer: HttpServer, corsOrigin: string | boolean): void {
    if (this.io) {
      logger.warn('SocketManager already initialized – skipping');
      return;
    }

    this.io = new SocketServer(httpServer, {
      cors: {
        origin: corsOrigin,
        credentials: true,
      },
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      pingInterval: 25_000,
      pingTimeout: 20_000,
    });

    // JWT authentication gate
    this.io.use(socketAuthMiddleware);

    this.io.on('connection', (raw) => {
      const socket = raw as AuthenticatedSocket;
      const { userId } = socket.data;

      logger.info(
        { userId, socketId: socket.id },
        'Client connected via WebSocket',
      );

      this.registerSubscriptionHandlers(socket);

      socket.on('disconnect', (reason) => {
        logger.info(
          { userId, socketId: socket.id, reason },
          'Client disconnected',
        );
      });
    });

    logger.info('Socket.io server initialized');
  }

  // ── Emit helpers ────────────────────────────────────────────────

  emitToExecution(executionId: string, event: string, data: unknown): void {
    this.io?.to(executionRoom(executionId)).emit(event, data);
  }

  emitToProject(projectId: string, event: string, data: unknown): void {
    this.io?.to(projectRoom(projectId)).emit(event, data);
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    this.io?.to(userRoom(userId)).emit(event, data);
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  async shutdown(): Promise<void> {
    if (!this.io) return;
    await new Promise<void>((resolve) => {
      this.io!.close(() => resolve());
    });
    this.io = null;
    logger.info('Socket.io server closed');
  }

  getServer(): SocketServer | null {
    return this.io;
  }

  // ── Private ─────────────────────────────────────────────────────

  private registerSubscriptionHandlers(socket: AuthenticatedSocket): void {
    const { userId } = socket.data;

    // ── Execution subscribe ──
    socket.on(
      CLIENT_EVENTS.EXECUTION_SUBSCRIBE,
      async (payload: { executionId?: string }) => {
        const { executionId } = payload ?? {};
        if (!executionId) return;

        try {
          // Authorization: verify the user owns this execution
          await this.executionService.findByIdAndUser(executionId, userId);

          await socket.join(executionRoom(executionId));
          logger.debug(
            { userId, executionId, socketId: socket.id },
            'Joined execution room',
          );
        } catch {
          socket.emit(SERVER_EVENTS.AUTH_ERROR, {
            message: 'Cannot subscribe to this execution',
          });
        }
      },
    );

    // ── Execution unsubscribe ──
    socket.on(
      CLIENT_EVENTS.EXECUTION_UNSUBSCRIBE,
      async (payload: { executionId?: string }) => {
        const { executionId } = payload ?? {};
        if (!executionId) return;

        await socket.leave(executionRoom(executionId));
        logger.debug(
          { userId, executionId, socketId: socket.id },
          'Left execution room',
        );
      },
    );

    // ── Project subscribe ──
    socket.on(
      CLIENT_EVENTS.PROJECT_SUBSCRIBE,
      async (payload: { projectId?: string }) => {
        const { projectId } = payload ?? {};
        if (!projectId) return;

        // Projects are scoped at a higher level; the user is already
        // authenticated so we allow joining the project room directly.
        // Fine-grained project-member checks can be added later.
        await socket.join(projectRoom(projectId));
        logger.debug(
          { userId, projectId, socketId: socket.id },
          'Joined project room',
        );
      },
    );

    // ── Project unsubscribe ──
    socket.on(
      CLIENT_EVENTS.PROJECT_UNSUBSCRIBE,
      async (payload: { projectId?: string }) => {
        const { projectId } = payload ?? {};
        if (!projectId) return;

        await socket.leave(projectRoom(projectId));
        logger.debug(
          { userId, projectId, socketId: socket.id },
          'Left project room',
        );
      },
    );
  }
}

// ── Singleton ───────────────────────────────────────────────────────

export const socketManager = new SocketManager();
