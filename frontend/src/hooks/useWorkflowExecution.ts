import { useCallback } from 'react';
import { useWorkflowStore } from '@/stores/useWorkflowStore';
import { useExecutionStore } from '@/stores/slices/executionSlice';
import {
  useStartExecution,
  useCancelExecution,
  usePauseExecution,
  useResumeExecution,
  useRetryExecution,
} from '@/api/mutations/executionMutations';
import { subscribeToExecution } from '@/services/socketService';
import { NodeExecutionStatus } from '@/types/node.types';
import { computeExecutionOrder } from '@/services/nodeExecutionService';

export function useWorkflowExecution() {
  const workflowId = useWorkflowStore((s) => s.workflowId);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const setNodeStatus = useWorkflowStore((s) => s.setNodeStatus);

  const executionId = useExecutionStore((s) => s.executionId);
  const executionStatus = useExecutionStore((s) => s.executionStatus);
  const overallProgress = useExecutionStore((s) => s.overallProgress);
  const startExecutionState = useExecutionStore((s) => s.startExecution);
  const setExecutionStatus = useExecutionStore((s) => s.setExecutionStatus);
  const resetExecution = useExecutionStore((s) => s.resetExecution);
  const addLog = useExecutionStore((s) => s.addLog);

  const startMutation = useStartExecution();
  const cancelMutation = useCancelExecution();
  const pauseMutation = usePauseExecution();
  const resumeMutation = useResumeExecution();
  const retryMutation = useRetryExecution();

  const isRunning = executionStatus === 'running';
  const isPaused = executionStatus === 'paused';
  const isCompleted = executionStatus === 'completed';
  const isFailed = executionStatus === 'failed';
  const isIdle = executionStatus === 'idle';

  const startExecution = useCallback(() => {
    if (!workflowId) return;

    // Reset all node statuses to pending
    const executionOrder = computeExecutionOrder(nodes, edges);
    for (const nodeId of executionOrder) {
      setNodeStatus(nodeId, NodeExecutionStatus.PENDING);
    }

    addLog({
      nodeId: null,
      nodeLabel: null,
      message: 'Starting workflow execution...',
      level: 'info',
    });

    startMutation.mutate(
      { workflowId },
      {
        onSuccess: (data) => {
          startExecutionState(data.executionId);
          subscribeToExecution(data.executionId);
        },
        onError: (error) => {
          // Reset nodes back to idle on failure
          for (const nodeId of executionOrder) {
            setNodeStatus(nodeId, NodeExecutionStatus.IDLE);
          }
          setExecutionStatus('failed');
          addLog({
            nodeId: null,
            nodeLabel: null,
            message: `Failed to start execution: ${error.message}`,
            level: 'error',
          });
        },
      },
    );
  }, [
    workflowId,
    nodes,
    edges,
    setNodeStatus,
    addLog,
    startMutation,
    startExecutionState,
    setExecutionStatus,
  ]);

  const stopExecution = useCallback(() => {
    if (!executionId) return;

    // Read latest status to avoid race with WebSocket updates
    const currentStatus = useExecutionStore.getState().executionStatus;
    if (currentStatus !== 'running' && currentStatus !== 'paused') return;

    addLog({
      nodeId: null,
      nodeLabel: null,
      message: 'Cancelling execution...',
      level: 'warn',
    });

    cancelMutation.mutate(executionId, {
      onSuccess: () => {
        // Reset all processing/pending nodes to idle
        for (const node of nodes) {
          if (
            node.data.status === NodeExecutionStatus.PROCESSING ||
            node.data.status === NodeExecutionStatus.PENDING
          ) {
            setNodeStatus(node.id, NodeExecutionStatus.IDLE);
          }
        }
      },
      onError: () => {
        // Execution likely transitioned to a terminal state (completed/cancelled)
        // before the cancel request arrived — the WebSocket handler will have already
        // updated the store.
        addLog({
          nodeId: null,
          nodeLabel: null,
          message: 'Execution already ended — cancel not needed',
          level: 'info',
        });
      },
    });
  }, [executionId, cancelMutation, nodes, setNodeStatus, addLog]);

  const pauseExecution = useCallback(() => {
    if (!executionId) return;
    pauseMutation.mutate(executionId);
  }, [executionId, pauseMutation]);

  const resumeExecution = useCallback(() => {
    if (!executionId) return;
    resumeMutation.mutate(executionId);
  }, [executionId, resumeMutation]);

  const retryExecution = useCallback(() => {
    if (!executionId) return;

    // Reset failed nodes
    for (const node of nodes) {
      if (node.data.status === NodeExecutionStatus.ERROR) {
        setNodeStatus(node.id, NodeExecutionStatus.PENDING);
      }
    }

    addLog({
      nodeId: null,
      nodeLabel: null,
      message: 'Retrying execution...',
      level: 'info',
    });

    retryMutation.mutate(executionId, {
      onSuccess: () => {
        setExecutionStatus('running');
      },
    });
  }, [executionId, retryMutation, nodes, setNodeStatus, addLog, setExecutionStatus]);

  const resetWorkflow = useCallback(() => {
    for (const node of nodes) {
      setNodeStatus(node.id, NodeExecutionStatus.IDLE);
    }
    resetExecution();
  }, [nodes, setNodeStatus, resetExecution]);

  return {
    executionId,
    executionStatus,
    overallProgress,
    isRunning,
    isPaused,
    isCompleted,
    isFailed,
    isIdle,
    isStarting: startMutation.isPending,
    isCancelling: cancelMutation.isPending,
    startExecution,
    stopExecution,
    pauseExecution,
    resumeExecution,
    retryExecution,
    resetWorkflow,
  };
}
