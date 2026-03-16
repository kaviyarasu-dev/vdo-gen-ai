// ── Server → Client Events ──────────────────────────────────────────

export const SERVER_EVENTS = {
  // Execution lifecycle
  EXECUTION_STARTED: 'execution:started',
  EXECUTION_PROGRESS: 'execution:progress',
  EXECUTION_COMPLETED: 'execution:completed',
  EXECUTION_FAILED: 'execution:failed',
  EXECUTION_PAUSED: 'execution:paused',
  EXECUTION_CANCELLED: 'execution:cancelled',

  // Node lifecycle
  NODE_QUEUED: 'node:queued',
  NODE_STARTED: 'node:started',
  NODE_PROGRESS: 'node:progress',
  NODE_COMPLETED: 'node:completed',
  NODE_FAILED: 'node:failed',
  NODE_RETRYING: 'node:retrying',

  // Asset events
  ASSET_GENERATED: 'asset:generated',
  ASSET_UPLOADED: 'asset:uploaded',

  // Connection events
  AUTH_ERROR: 'auth:error',
} as const;

// ── Client → Server Events ──────────────────────────────────────────

export const CLIENT_EVENTS = {
  EXECUTION_SUBSCRIBE: 'execution:subscribe',
  EXECUTION_UNSUBSCRIBE: 'execution:unsubscribe',
  PROJECT_SUBSCRIBE: 'project:subscribe',
  PROJECT_UNSUBSCRIBE: 'project:unsubscribe',
} as const;

// ── Room Name Builders ──────────────────────────────────────────────

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function executionRoom(executionId: string): string {
  return `execution:${executionId}`;
}

export function projectRoom(projectId: string): string {
  return `project:${projectId}`;
}
