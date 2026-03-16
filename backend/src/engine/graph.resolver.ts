import type {
  IWorkflowNode,
  IWorkflowEdge,
  ExecutionLayer,
  FlowJob,
  GraphValidationResult,
} from './engine.types.js';
import { getNodeRegistry } from '../modules/nodes/node-registry.js';
import type { INodePortSchema } from '../modules/nodes/node.types.js';

const QUEUE_NAME = 'workflow-execution';

export class GraphResolver {
  validate(
    nodes: IWorkflowNode[],
    edges: IWorkflowEdge[],
  ): GraphValidationResult {
    const errors: string[] = [];

    if (nodes.length === 0) {
      return { isValid: false, errors: ['Workflow must have at least one node'] };
    }

    // Validate node IDs are unique
    const nodeIds = new Set(nodes.map((n) => n.id));
    if (nodeIds.size !== nodes.length) {
      errors.push('Duplicate node IDs found');
    }

    // Validate edge references
    for (const edge of edges) {
      if (!nodeIds.has(edge.sourceNodeId)) {
        errors.push(`Edge "${edge.id}" references non-existent source node "${edge.sourceNodeId}"`);
      }
      if (!nodeIds.has(edge.targetNodeId)) {
        errors.push(`Edge "${edge.id}" references non-existent target node "${edge.targetNodeId}"`);
      }
      if (edge.sourceNodeId === edge.targetNodeId) {
        errors.push(`Edge "${edge.id}" creates a self-loop on node "${edge.sourceNodeId}"`);
      }
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    // Validate port compatibility
    const portErrors = this.validatePortCompatibility(nodes, edges);
    errors.push(...portErrors);

    // Cycle detection
    const cycleErrors = this.detectCycles(nodes, edges);
    errors.push(...cycleErrors);

    // Validate all nodes reachable (weakly connected when treating as undirected)
    const reachabilityErrors = this.validateReachability(nodes, edges);
    errors.push(...reachabilityErrors);

    // Validate exactly one terminal node (output node or node with no outgoing edges)
    const terminalErrors = this.validateTerminalNodes(nodes, edges);
    errors.push(...terminalErrors);

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  getExecutionLayers(
    nodes: IWorkflowNode[],
    edges: IWorkflowEdge[],
  ): ExecutionLayer[] {
    const sorted = this.topologicalSort(nodes, edges);
    const nodeDepth = new Map<string, number>();

    // Build adjacency for incoming edges
    const incomingEdges = new Map<string, string[]>();
    for (const node of nodes) {
      incomingEdges.set(node.id, []);
    }
    for (const edge of edges) {
      incomingEdges.get(edge.targetNodeId)!.push(edge.sourceNodeId);
    }

    // Calculate depth for each node (max depth of predecessors + 1)
    for (const nodeId of sorted) {
      const predecessors = incomingEdges.get(nodeId) ?? [];
      if (predecessors.length === 0) {
        nodeDepth.set(nodeId, 0);
      } else {
        const maxPredDepth = Math.max(
          ...predecessors.map((p) => nodeDepth.get(p) ?? 0),
        );
        nodeDepth.set(nodeId, maxPredDepth + 1);
      }
    }

    // Group by depth into layers
    const layerMap = new Map<number, string[]>();
    for (const [nodeId, depth] of nodeDepth) {
      if (!layerMap.has(depth)) {
        layerMap.set(depth, []);
      }
      layerMap.get(depth)!.push(nodeId);
    }

    // Convert to sorted layers
    const layers: ExecutionLayer[] = [];
    const sortedDepths = Array.from(layerMap.keys()).sort((a, b) => a - b);
    for (const depth of sortedDepths) {
      layers.push({
        layer: depth,
        nodeIds: layerMap.get(depth)!,
      });
    }

    return layers;
  }

  toBullMQFlow(
    nodes: IWorkflowNode[],
    edges: IWorkflowEdge[],
    executionId: string,
  ): FlowJob {
    // BullMQ FlowProducer uses a reversed tree: root = output, leaves = inputs
    // Build adjacency list (target -> sources)
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const incomingEdges = new Map<string, string[]>();
    for (const node of nodes) {
      incomingEdges.set(node.id, []);
    }
    for (const edge of edges) {
      incomingEdges.get(edge.targetNodeId)!.push(edge.sourceNodeId);
    }

    // Find the terminal node (no outgoing edges)
    const outgoingCount = new Map<string, number>();
    for (const node of nodes) {
      outgoingCount.set(node.id, 0);
    }
    for (const edge of edges) {
      outgoingCount.set(
        edge.sourceNodeId,
        (outgoingCount.get(edge.sourceNodeId) ?? 0) + 1,
      );
    }

    const terminalNodes = nodes.filter(
      (n) => (outgoingCount.get(n.id) ?? 0) === 0,
    );
    const rootNodeId = terminalNodes[0]?.id;

    if (!rootNodeId) {
      throw new Error('No terminal node found in workflow');
    }

    // Recursively build the tree
    const visited = new Set<string>();

    const buildTree = (nodeId: string): FlowJob => {
      visited.add(nodeId);
      const node = nodeMap.get(nodeId)!;
      const sources = incomingEdges.get(nodeId) ?? [];

      const children: FlowJob[] = [];
      for (const sourceId of sources) {
        if (!visited.has(sourceId)) {
          children.push(buildTree(sourceId));
        }
      }

      const job: FlowJob = {
        name: `${node.type}:${nodeId}`,
        queueName: QUEUE_NAME,
        data: {
          executionId,
          nodeId,
          nodeType: node.type,
        },
        opts: {
          jobId: `${executionId}__${nodeId}`,
        },
      };

      if (children.length > 0) {
        job.children = children;
      }

      return job;
    };

    return buildTree(rootNodeId);
  }

  identifyFanOutNodes(
    nodes: IWorkflowNode[],
    _edges: IWorkflowEdge[],
  ): string[] {
    const registry = getNodeRegistry();
    return nodes
      .filter((node) => registry.isFanOut(node.type))
      .map((node) => node.id);
  }

  private validatePortCompatibility(
    nodes: IWorkflowNode[],
    edges: IWorkflowEdge[],
  ): string[] {
    const errors: string[] = [];
    const registry = getNodeRegistry();
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    for (const edge of edges) {
      const sourceNode = nodeMap.get(edge.sourceNodeId);
      const targetNode = nodeMap.get(edge.targetNodeId);
      if (!sourceNode || !targetNode) continue;

      let sourceSchema: INodePortSchema;
      let targetSchema: INodePortSchema;

      try {
        sourceSchema = registry.getPortSchema(sourceNode.type);
        targetSchema = registry.getPortSchema(targetNode.type);
      } catch {
        errors.push(
          `Unknown node type: "${sourceNode.type}" or "${targetNode.type}"`,
        );
        continue;
      }

      const sourcePort = sourceSchema.outputs.find(
        (p) => p.id === edge.sourcePort,
      );
      const targetPort = targetSchema.inputs.find(
        (p) => p.id === edge.targetPort,
      );

      if (!sourcePort) {
        errors.push(
          `Node "${sourceNode.id}" (${sourceNode.type}) has no output port "${edge.sourcePort}"`,
        );
        continue;
      }

      if (!targetPort) {
        errors.push(
          `Node "${targetNode.id}" (${targetNode.type}) has no input port "${edge.targetPort}"`,
        );
        continue;
      }

      if (sourcePort.dataType !== targetPort.dataType) {
        errors.push(
          `Port type mismatch on edge "${edge.id}": output "${edge.sourcePort}" (${sourcePort.dataType}) → input "${edge.targetPort}" (${targetPort.dataType})`,
        );
      }
    }

    return errors;
  }

  private detectCycles(
    nodes: IWorkflowNode[],
    edges: IWorkflowEdge[],
  ): string[] {
    // DFS-based cycle detection
    const adjacency = new Map<string, string[]>();
    for (const node of nodes) {
      adjacency.set(node.id, []);
    }
    for (const edge of edges) {
      adjacency.get(edge.sourceNodeId)?.push(edge.targetNodeId);
    }

    const WHITE = 0; // unvisited
    const GRAY = 1;  // in current DFS path
    const BLACK = 2; // fully processed

    const color = new Map<string, number>();
    for (const node of nodes) {
      color.set(node.id, WHITE);
    }

    const hasCycle = (nodeId: string): boolean => {
      color.set(nodeId, GRAY);

      for (const neighbor of adjacency.get(nodeId) ?? []) {
        if (color.get(neighbor) === GRAY) {
          return true;
        }
        if (color.get(neighbor) === WHITE && hasCycle(neighbor)) {
          return true;
        }
      }

      color.set(nodeId, BLACK);
      return false;
    };

    for (const node of nodes) {
      if (color.get(node.id) === WHITE) {
        if (hasCycle(node.id)) {
          return ['Workflow contains a cycle - DAG required'];
        }
      }
    }

    return [];
  }

  private validateReachability(
    nodes: IWorkflowNode[],
    edges: IWorkflowEdge[],
  ): string[] {
    if (nodes.length <= 1) return [];

    // Build undirected adjacency
    const adjacency = new Map<string, Set<string>>();
    for (const node of nodes) {
      adjacency.set(node.id, new Set());
    }
    for (const edge of edges) {
      adjacency.get(edge.sourceNodeId)?.add(edge.targetNodeId);
      adjacency.get(edge.targetNodeId)?.add(edge.sourceNodeId);
    }

    // BFS from first node
    const visited = new Set<string>();
    const queue = [nodes[0].id];
    visited.add(nodes[0].id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    if (visited.size !== nodes.length) {
      const unreachable = nodes
        .filter((n) => !visited.has(n.id))
        .map((n) => n.id);
      return [`Disconnected nodes found: ${unreachable.join(', ')}`];
    }

    return [];
  }

  private validateTerminalNodes(
    nodes: IWorkflowNode[],
    edges: IWorkflowEdge[],
  ): string[] {
    const outgoingCount = new Map<string, number>();
    for (const node of nodes) {
      outgoingCount.set(node.id, 0);
    }
    for (const edge of edges) {
      outgoingCount.set(
        edge.sourceNodeId,
        (outgoingCount.get(edge.sourceNodeId) ?? 0) + 1,
      );
    }

    const terminalNodes = nodes.filter(
      (n) => (outgoingCount.get(n.id) ?? 0) === 0,
    );

    if (terminalNodes.length === 0) {
      return ['Workflow must have at least one terminal node'];
    }

    if (terminalNodes.length > 1) {
      const ids = terminalNodes.map((n) => n.id).join(', ');
      return [`Workflow must have exactly one terminal node, found: ${ids}`];
    }

    return [];
  }

  private topologicalSort(
    nodes: IWorkflowNode[],
    edges: IWorkflowEdge[],
  ): string[] {
    // Kahn's algorithm
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const node of nodes) {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    }

    for (const edge of edges) {
      adjacency.get(edge.sourceNodeId)?.push(edge.targetNodeId);
      inDegree.set(
        edge.targetNodeId,
        (inDegree.get(edge.targetNodeId) ?? 0) + 1,
      );
    }

    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      for (const neighbor of adjacency.get(current) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    return sorted;
  }
}
