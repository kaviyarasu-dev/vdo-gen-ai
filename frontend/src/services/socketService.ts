import { io, type Socket } from 'socket.io-client';
import { env } from '@/config/env';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from '@/types/socket.types';

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

// Pending subscription queues — flushed on connect/reconnect
const pendingExecutionSubscriptions = new Set<string>();
const pendingProjectSubscriptions = new Set<string>();

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

export function getSocket(): TypedSocket {
  if (socket) return socket;

  socket = io(env.WS_URL, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    auth: {
      token: getAuthToken(),
    },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
  });

  // Flush any pending subscriptions when socket connects/reconnects
  socket.on('connect', () => {
    for (const executionId of pendingExecutionSubscriptions) {
      socket!.emit('execution:subscribe', { executionId });
    }
    pendingExecutionSubscriptions.clear();

    for (const projectId of pendingProjectSubscriptions) {
      socket!.emit('project:subscribe', { projectId });
    }
    pendingProjectSubscriptions.clear();
  });

  return socket;
}

export function connectSocket(): TypedSocket {
  const s = getSocket();

  // Update auth token before connecting
  s.auth = { token: getAuthToken() };

  if (!s.connected) {
    s.connect();
  }

  return s;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  pendingExecutionSubscriptions.clear();
  pendingProjectSubscriptions.clear();
}

export function subscribeToExecution(executionId: string): void {
  const s = getSocket();
  if (s.connected) {
    s.emit('execution:subscribe', { executionId });
  } else {
    pendingExecutionSubscriptions.add(executionId);
  }
}

export function unsubscribeFromExecution(executionId: string): void {
  pendingExecutionSubscriptions.delete(executionId);
  const s = getSocket();
  if (s.connected) {
    s.emit('execution:unsubscribe', { executionId });
  }
}

export function subscribeToProject(projectId: string): void {
  const s = getSocket();
  if (s.connected) {
    s.emit('project:subscribe', { projectId });
  } else {
    pendingProjectSubscriptions.add(projectId);
  }
}

export function unsubscribeFromProject(projectId: string): void {
  pendingProjectSubscriptions.delete(projectId);
  const s = getSocket();
  if (s.connected) {
    s.emit('project:unsubscribe', { projectId });
  }
}
