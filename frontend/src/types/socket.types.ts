import type { MediaAsset } from './media.types';

export type ProgressInfo = {
  completedNodes: number;
  totalNodes: number;
  percentage: number;
  currentNodeId: string | null;
};

export type ExecutionLogEntry = {
  id: string;
  timestamp: number;
  nodeId: string | null;
  nodeLabel: string | null;
  message: string;
  level: 'info' | 'warn' | 'error' | 'success';
  data?: Record<string, unknown>;
};

export type ServerToClientEvents = {
  'execution:started': (payload: {
    workflowId: string;
    executionId: string;
  }) => void;
  'execution:progress': (payload: {
    executionId: string;
    progress: ProgressInfo;
  }) => void;
  'execution:completed': (payload: {
    workflowId: string;
    executionId: string;
  }) => void;
  'execution:failed': (payload: {
    workflowId: string;
    error: string;
  }) => void;
  'execution:paused': (payload: {
    executionId: string;
  }) => void;
  'execution:cancelled': (payload: {
    executionId: string;
  }) => void;
  'node:queued': (payload: {
    nodeId: string;
  }) => void;
  'node:started': (payload: {
    nodeId: string;
  }) => void;
  'node:progress': (payload: {
    nodeId: string;
    progress: number;
    message?: string;
  }) => void;
  'node:completed': (payload: {
    nodeId: string;
    nodeType: string;
    output?: Record<string, unknown>;
  }) => void;
  'node:failed': (payload: {
    nodeId: string;
    error: string;
  }) => void;
  'node:retrying': (payload: {
    nodeId: string;
    attempt: number;
    maxAttempts: number;
  }) => void;
  'asset:generated': (payload: {
    nodeId: string;
    asset: MediaAsset;
  }) => void;
  'asset:uploaded': (payload: {
    nodeId: string;
    asset: MediaAsset;
  }) => void;
  notification: (payload: {
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
  }) => void;
};

export type ClientToServerEvents = {
  'execution:subscribe': (payload: { executionId: string }) => void;
  'execution:unsubscribe': (payload: { executionId: string }) => void;
  'project:subscribe': (payload: { projectId: string }) => void;
  'project:unsubscribe': (payload: { projectId: string }) => void;
};

export type SocketStatus = 'connected' | 'disconnected' | 'reconnecting';
