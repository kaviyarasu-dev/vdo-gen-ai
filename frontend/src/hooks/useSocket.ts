import { useEffect, useRef } from 'react';
import {
  connectSocket,
  disconnectSocket,
  getSocket,
  subscribeToExecution,
} from '@/services/socketService';
import { useWorkflowStore } from '@/stores/useWorkflowStore';
import { useExecutionStore } from '@/stores/slices/executionSlice';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { queryClient } from '@/api/queryClient';
import { NodeExecutionStatus } from '@/types/node.types';
import type { TypedSocket } from '@/services/socketService';
import type { ProgressInfo } from '@/types/socket.types';
import type { MediaAsset } from '@/types/media.types';

export function useSocket() {
  const socketRef = useRef<TypedSocket | null>(null);

  const setNodeStatus = useWorkflowStore((s) => s.setNodeStatus);
  const setNodeProgress = useWorkflowStore((s) => s.setNodeProgress);
  const setNodeError = useWorkflowStore((s) => s.setNodeError);

  const executionId = useExecutionStore((s) => s.executionId);
  const setExecutionStatus = useExecutionStore((s) => s.setExecutionStatus);
  const setCurrentNode = useExecutionStore((s) => s.setCurrentNode);
  const markNodeCompleted = useExecutionStore((s) => s.markNodeCompleted);
  const markNodeFailed = useExecutionStore((s) => s.markNodeFailed);
  const setOverallProgress = useExecutionStore((s) => s.setOverallProgress);
  const addLog = useExecutionStore((s) => s.addLog);
  const setNodeOutput = useExecutionStore((s) => s.setNodeOutput);
  const setSocketStatus = useExecutionStore((s) => s.setSocketStatus);

  const addNotification = useNotificationStore((s) => s.addNotification);

  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketStatus('connected');

      // Re-subscribe to active execution on reconnect
      const currentExecution = useExecutionStore.getState().executionId;
      if (currentExecution) {
        subscribeToExecution(currentExecution);
      }
    });

    socket.on('disconnect', () => {
      setSocketStatus('disconnected');
    });

    socket.io.on('reconnect_attempt', () => {
      setSocketStatus('reconnecting');
    });

    // Execution lifecycle events
    socket.on(
      'execution:started',
      (payload: { workflowId: string; executionId: string }) => {
        addLog({
          nodeId: null,
          nodeLabel: null,
          message: `Execution ${payload.executionId} started`,
          level: 'info',
        });
      },
    );

    socket.on(
      'execution:progress',
      (payload: { executionId: string; progress: ProgressInfo }) => {
        setOverallProgress(payload.progress.percentage);
        if (payload.progress.currentNodeId) {
          setCurrentNode(payload.progress.currentNodeId);
        }
      },
    );

    socket.on('execution:completed', () => {
      setExecutionStatus('completed');
      addLog({
        nodeId: null,
        nodeLabel: null,
        message: 'Workflow execution completed successfully',
        level: 'success',
      });
      addNotification({
        type: 'success',
        title: 'Execution Complete',
        message: 'Your workflow has finished executing.',
      });
      queryClient.invalidateQueries({ queryKey: ['media'] });
    });

    socket.on(
      'execution:failed',
      (payload: { workflowId: string; error: string }) => {
        setExecutionStatus('failed');
        addLog({
          nodeId: null,
          nodeLabel: null,
          message: `Execution failed: ${payload.error}`,
          level: 'error',
        });
        addNotification({
          type: 'error',
          title: 'Execution Failed',
          message: payload.error,
        });
      },
    );

    socket.on('execution:paused', () => {
      setExecutionStatus('paused');
      addLog({
        nodeId: null,
        nodeLabel: null,
        message: 'Execution paused',
        level: 'info',
      });
    });

    socket.on('execution:cancelled', () => {
      setExecutionStatus('cancelled');
      addLog({
        nodeId: null,
        nodeLabel: null,
        message: 'Execution cancelled',
        level: 'warn',
      });
    });

    // Node lifecycle events
    socket.on('node:queued', (payload: { nodeId: string }) => {
      setNodeStatus(payload.nodeId, NodeExecutionStatus.PENDING);
      addLog({
        nodeId: payload.nodeId,
        nodeLabel: null,
        message: 'Node queued for execution',
        level: 'info',
      });
    });

    socket.on('node:started', (payload: { nodeId: string }) => {
      setNodeStatus(payload.nodeId, NodeExecutionStatus.PROCESSING);
      setNodeProgress(payload.nodeId, 0);
      setCurrentNode(payload.nodeId);
      addLog({
        nodeId: payload.nodeId,
        nodeLabel: null,
        message: 'Node execution started',
        level: 'info',
      });
    });

    socket.on(
      'node:progress',
      (payload: { nodeId: string; progress: number; message?: string }) => {
        setNodeProgress(payload.nodeId, payload.progress);
        if (payload.message) {
          addLog({
            nodeId: payload.nodeId,
            nodeLabel: null,
            message: payload.message,
            level: 'info',
          });
        }
      },
    );

    socket.on(
      'node:completed',
      (payload: { nodeId: string; nodeType: string; output?: Record<string, unknown> }) => {
        setNodeStatus(payload.nodeId, NodeExecutionStatus.COMPLETE);
        setNodeProgress(payload.nodeId, 100);
        markNodeCompleted(payload.nodeId);

        if (payload.output) {
          setNodeOutput(payload.nodeId, payload.output);
        }

        addLog({
          nodeId: payload.nodeId,
          nodeLabel: null,
          message: 'Node completed successfully',
          level: 'success',
          data: payload.output,
        });
        queryClient.invalidateQueries({ queryKey: ['media'] });
      },
    );

    socket.on(
      'node:failed',
      (payload: { nodeId: string; error: string }) => {
        setNodeError(payload.nodeId, payload.error);
        markNodeFailed(payload.nodeId);
        addLog({
          nodeId: payload.nodeId,
          nodeLabel: null,
          message: `Node failed: ${payload.error}`,
          level: 'error',
          data: { error: payload.error },
        });
        addNotification({
          type: 'error',
          title: 'Node Failed',
          message: payload.error,
        });
      },
    );

    socket.on(
      'node:retrying',
      (payload: {
        nodeId: string;
        attempt: number;
        maxAttempts: number;
      }) => {
        setNodeStatus(payload.nodeId, NodeExecutionStatus.PENDING);
        addLog({
          nodeId: payload.nodeId,
          nodeLabel: null,
          message: `Retrying node (attempt ${payload.attempt}/${payload.maxAttempts})`,
          level: 'warn',
        });
      },
    );

    // Asset events
    socket.on(
      'asset:generated',
      (payload: { nodeId: string; asset: MediaAsset }) => {
        addLog({
          nodeId: payload.nodeId,
          nodeLabel: null,
          message: `Asset generated: ${payload.asset.originalName}`,
          level: 'success',
        });
        queryClient.invalidateQueries({ queryKey: ['media'] });
      },
    );

    socket.on(
      'asset:uploaded',
      (payload: { nodeId: string; asset: MediaAsset }) => {
        addLog({
          nodeId: payload.nodeId,
          nodeLabel: null,
          message: `Asset uploaded: ${payload.asset.originalName}`,
          level: 'info',
        });
      },
    );

    // Server-pushed notifications
    socket.on(
      'notification',
      (payload: {
        type: 'info' | 'success' | 'warning' | 'error';
        title: string;
        message: string;
      }) => {
        addNotification({
          type: payload.type,
          title: payload.title,
          message: payload.message,
        });
      },
    );

    return () => {
      disconnectSocket();
      socketRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe/unsubscribe when executionId changes
  useEffect(() => {
    if (!executionId) return;

    const socket = getSocket();
    if (socket.connected) {
      subscribeToExecution(executionId);
    }

    return () => {
      const s = getSocket();
      if (s.connected) {
        s.emit('execution:unsubscribe', { executionId });
      }
    };
  }, [executionId]);

  return {
    socket: socketRef.current,
  };
}
