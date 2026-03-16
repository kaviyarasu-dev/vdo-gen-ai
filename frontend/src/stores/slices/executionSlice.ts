import { create } from 'zustand';
import type { ExecutionLogEntry, SocketStatus } from '@/types/socket.types';

type ExecutionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

type ExecutionState = {
  executionId: string | null;
  executionStatus: ExecutionStatus;
  currentNodeId: string | null;
  completedNodeIds: string[];
  failedNodeIds: string[];
  overallProgress: number;
  logs: ExecutionLogEntry[];
  socketStatus: SocketStatus;
  nodeOutputs: Record<string, Record<string, unknown>>;
};

type ExecutionActions = {
  startExecution: (executionId: string) => void;
  setExecutionStatus: (status: ExecutionStatus) => void;
  setCurrentNode: (nodeId: string | null) => void;
  markNodeCompleted: (nodeId: string) => void;
  markNodeFailed: (nodeId: string) => void;
  setOverallProgress: (progress: number) => void;
  addLog: (entry: Omit<ExecutionLogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  resetExecution: () => void;
  setNodeOutput: (nodeId: string, output: Record<string, unknown>) => void;
  setSocketStatus: (status: SocketStatus) => void;
};

const MAX_LOGS = 500;

export const useExecutionStore = create<ExecutionState & ExecutionActions>(
  (set) => ({
    executionId: null,
    executionStatus: 'idle',
    currentNodeId: null,
    completedNodeIds: [],
    failedNodeIds: [],
    overallProgress: 0,
    logs: [],
    socketStatus: 'disconnected',
    nodeOutputs: {},

    startExecution: (executionId) => {
      set({
        executionId,
        executionStatus: 'running',
        currentNodeId: null,
        completedNodeIds: [],
        failedNodeIds: [],
        overallProgress: 0,
        logs: [],
        nodeOutputs: {},
      });
    },

    setExecutionStatus: (status) => {
      set({ executionStatus: status });
    },

    setCurrentNode: (nodeId) => {
      set({ currentNodeId: nodeId });
    },

    markNodeCompleted: (nodeId) => {
      set((state) => ({
        completedNodeIds: state.completedNodeIds.includes(nodeId)
          ? state.completedNodeIds
          : [...state.completedNodeIds, nodeId],
      }));
    },

    markNodeFailed: (nodeId) => {
      set((state) => ({
        failedNodeIds: state.failedNodeIds.includes(nodeId)
          ? state.failedNodeIds
          : [...state.failedNodeIds, nodeId],
      }));
    },

    setOverallProgress: (progress) => {
      set({ overallProgress: progress });
    },

    addLog: (entry) => {
      const logEntry: ExecutionLogEntry = {
        ...entry,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };
      set((state) => ({
        logs: [...state.logs, logEntry].slice(-MAX_LOGS),
      }));
    },

    clearLogs: () => {
      set({ logs: [] });
    },

    resetExecution: () => {
      set({
        executionId: null,
        executionStatus: 'idle',
        currentNodeId: null,
        completedNodeIds: [],
        failedNodeIds: [],
        overallProgress: 0,
        nodeOutputs: {},
      });
    },

    setNodeOutput: (nodeId, output) => {
      set((state) => ({
        nodeOutputs: { ...state.nodeOutputs, [nodeId]: output },
      }));
    },

    setSocketStatus: (status) => {
      set({ socketStatus: status });
    },
  }),
);
