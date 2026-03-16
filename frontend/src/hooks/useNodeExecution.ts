import { useCallback } from 'react';
import { useWorkflowStore } from '@/stores/useWorkflowStore';
import { useExecutionStore } from '@/stores/slices/executionSlice';
import { useRetryNode } from '@/api/mutations/executionMutations';
import { NodeExecutionStatus } from '@/types/node.types';

export function useNodeExecution() {
  const nodes = useWorkflowStore((s) => s.nodes);
  const setNodeStatus = useWorkflowStore((s) => s.setNodeStatus);
  const executionId = useExecutionStore((s) => s.executionId);
  const executionStatus = useExecutionStore((s) => s.executionStatus);
  const addLog = useExecutionStore((s) => s.addLog);

  const retryNodeMutation = useRetryNode();

  const retryNode = useCallback(
    (nodeId: string) => {
      if (!executionId) return;

      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      setNodeStatus(nodeId, NodeExecutionStatus.PENDING);
      addLog({
        nodeId,
        nodeLabel: node.data.label,
        message: `Retrying node "${node.data.label}"`,
        level: 'info',
      });

      retryNodeMutation.mutate({ executionId, nodeId });
    },
    [executionId, nodes, setNodeStatus, addLog, retryNodeMutation],
  );

  const getNodeStatus = useCallback(
    (nodeId: string): NodeExecutionStatus => {
      const node = nodes.find((n) => n.id === nodeId);
      return node?.data.status ?? NodeExecutionStatus.IDLE;
    },
    [nodes],
  );

  const isNodeRetryable = useCallback(
    (nodeId: string): boolean => {
      if (executionStatus !== 'failed' && executionStatus !== 'running') {
        return false;
      }
      const node = nodes.find((n) => n.id === nodeId);
      return node?.data.status === NodeExecutionStatus.ERROR;
    },
    [nodes, executionStatus],
  );

  return {
    retryNode,
    getNodeStatus,
    isNodeRetryable,
    isRetrying: retryNodeMutation.isPending,
  };
}
