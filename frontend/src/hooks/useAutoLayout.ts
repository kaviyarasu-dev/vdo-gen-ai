import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import { useWorkflowStore } from '@/stores/useWorkflowStore';

const NODE_WIDTH = 240;
const NODE_HEIGHT = 160;

export function useAutoLayout() {
  const { fitView } = useReactFlow();
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const pushHistory = useWorkflowStore((s) => s.pushHistory);

  const applyLayout = useCallback(() => {
    if (nodes.length === 0) return;

    pushHistory();

    const graph = new dagre.graphlib.Graph();
    graph.setDefaultEdgeLabel(() => ({}));
    graph.setGraph({
      rankdir: 'LR',
      nodesep: 60,
      ranksep: 100,
      marginx: 40,
      marginy: 40,
    });

    for (const node of nodes) {
      graph.setNode(node.id, {
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      });
    }

    for (const edge of edges) {
      graph.setEdge(edge.source, edge.target);
    }

    dagre.layout(graph);

    const layoutedNodes = nodes.map((node) => {
      const nodeWithPosition = graph.node(node.id);
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - NODE_WIDTH / 2,
          y: nodeWithPosition.y - NODE_HEIGHT / 2,
        },
      };
    });

    useWorkflowStore.setState({ nodes: layoutedNodes, isDirty: true });

    requestAnimationFrame(() => {
      fitView({ padding: 0.2, duration: 300 });
    });
  }, [nodes, edges, fitView, pushHistory]);

  return { applyLayout };
}
