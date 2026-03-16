import type { VdoNode } from '@/types/node.types';
import type { VdoEdge } from '@/types/edge.types';

/**
 * Computes topological execution order for workflow nodes using Kahn's algorithm.
 * Nodes with no dependencies execute first; downstream nodes execute after upstream completes.
 */
export function computeExecutionOrder(
  nodes: VdoNode[],
  edges: VdoEdge[],
): string[] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    adjacency.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);

    for (const neighbor of adjacency.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  return order;
}

/**
 * Returns upstream node IDs that feed directly into the given node.
 */
export function getUpstreamNodes(
  nodeId: string,
  edges: VdoEdge[],
): string[] {
  return edges
    .filter((e) => e.target === nodeId)
    .map((e) => e.source);
}

/**
 * Returns downstream node IDs that the given node feeds into.
 */
export function getDownstreamNodes(
  nodeId: string,
  edges: VdoEdge[],
): string[] {
  return edges
    .filter((e) => e.source === nodeId)
    .map((e) => e.target);
}
