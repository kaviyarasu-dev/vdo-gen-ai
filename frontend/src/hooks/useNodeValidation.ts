import { useCallback } from 'react';
import type { Connection, Edge } from '@xyflow/react';
import { useWorkflowStore } from '@/stores/useWorkflowStore';
import { getNodeDefinition } from '@/config/nodeRegistry';

export function useNodeValidation() {
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);

  const isValidConnection = useCallback(
    (connection: Edge | Connection): boolean => {
      const source = connection.source;
      const target = connection.target;
      const sourceHandle = connection.sourceHandle ?? null;
      const targetHandle = connection.targetHandle ?? null;
      if (!source || !target || source === target) return false;

      const sourceNode = nodes.find((n) => n.id === source);
      const targetNode = nodes.find((n) => n.id === target);
      if (!sourceNode || !targetNode) return false;

      const sourceDef = getNodeDefinition(sourceNode.data.nodeType);
      const targetDef = getNodeDefinition(targetNode.data.nodeType);
      if (!sourceDef || !targetDef) return false;

      const sourceOutput = sourceDef.outputs.find(
        (o) => o.id === sourceHandle,
      );
      const targetInput = targetDef.inputs.find(
        (i) => i.id === targetHandle,
      );
      if (!sourceOutput || !targetInput) return false;

      // Check data type compatibility
      const isTypeCompatible =
        sourceOutput.dataType === targetInput.dataType ||
        sourceOutput.dataType === 'any' ||
        targetInput.dataType === 'any';
      if (!isTypeCompatible) return false;

      // Check max connections on target input
      const existingTargetConnections = edges.filter(
        (e) =>
          e.target === target && e.targetHandle === targetHandle,
      );
      if (
        existingTargetConnections.length >=
        targetInput.maxConnections
      ) {
        return false;
      }

      // Check for cycles using DFS
      if (wouldCreateCycle(source, target)) return false;

      return true;
    },
    [nodes, edges],
  );

  const wouldCreateCycle = useCallback(
    (source: string, target: string): boolean => {
      // If adding edge from source -> target, check if there's
      // already a path from target to source (which would create a cycle)
      const visited = new Set<string>();

      function dfs(current: string): boolean {
        if (current === source) return true;
        if (visited.has(current)) return false;
        visited.add(current);

        const outgoingEdges = edges.filter(
          (e) => e.source === current,
        );
        for (const edge of outgoingEdges) {
          if (dfs(edge.target)) return true;
        }
        return false;
      }

      return dfs(target);
    },
    [edges],
  );

  return { isValidConnection };
}
