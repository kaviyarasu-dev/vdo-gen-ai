import type { VdoNode, BaseNodeData, NodeCategory } from '@/types/node.types';
import type { VdoEdge } from '@/types/edge.types';
import { getNodeDefinition } from '@/config/nodeRegistry';

/** Maps camelCase frontend node types to kebab-case backend node types */
const NODE_TYPE_TO_BACKEND: Record<string, string> = {
  scriptInput: 'script-input',
  scriptAnalyzer: 'script-analyzer',
  characterExtractor: 'character-extractor',
  sceneSplitter: 'scene-splitter',
  imageGenerator: 'image-generator',
  frameComposer: 'frame-composer',
  videoGenerator: 'video-generator',
  videoCombiner: 'video-combiner',
  output: 'output',
};

/** Maps kebab-case backend node types to camelCase frontend node types */
const NODE_TYPE_FROM_BACKEND: Record<string, string> = Object.fromEntries(
  Object.entries(NODE_TYPE_TO_BACKEND).map(([k, v]) => [v, k]),
);

type BackendNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
  providerConfig?: {
    provider: string;
    model?: string;
    params?: Record<string, unknown>;
  };
  label?: string;
};

type BackendEdge = {
  id: string;
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetPort: string;
};

export type BackendSerializedWorkflow = {
  nodes: BackendNode[];
  edges: BackendEdge[];
  viewport?: { x: number; y: number; zoom: number };
};

function serializeNode(node: VdoNode): BackendNode {
  const backendType = NODE_TYPE_TO_BACKEND[node.type ?? ''] ?? node.type ?? '';
  const data = node.data;

  const result: BackendNode = {
    id: node.id,
    type: backendType,
    position: { x: node.position.x, y: node.position.y },
    config: data.config ?? {},
  };

  if (data.provider || data.model) {
    result.providerConfig = {
      provider: data.provider ?? '',
      ...(data.model ? { model: data.model } : {}),
    };
  }

  if (data.label) {
    result.label = data.label;
  }

  return result;
}

function serializeEdge(edge: VdoEdge): BackendEdge {
  return {
    id: edge.id,
    sourceNodeId: edge.source,
    sourcePort: edge.sourceHandle ?? '',
    targetNodeId: edge.target,
    targetPort: edge.targetHandle ?? '',
  };
}

/**
 * Serializes the current workflow state into the backend API format.
 * Transforms React Flow nodes/edges into the backend's expected shape:
 * - Node types: camelCase → kebab-case
 * - Node data → config/providerConfig/label
 * - Edge source/target → sourceNodeId/targetNodeId/sourcePort/targetPort
 */
export function serializeWorkflow(
  nodes: VdoNode[],
  edges: VdoEdge[],
  viewport?: { x: number; y: number; zoom: number },
): BackendSerializedWorkflow {
  return {
    nodes: nodes.map(serializeNode),
    edges: edges.map(serializeEdge),
    ...(viewport && { viewport }),
  };
}

function deserializeNode(node: BackendNode): VdoNode {
  const frontendType = NODE_TYPE_FROM_BACKEND[node.type] ?? node.type;
  const nodeDef = getNodeDefinition(frontendType);

  const data: BaseNodeData = {
    label: node.label ?? nodeDef?.label ?? frontendType,
    category: (nodeDef?.category ?? 'processing') as NodeCategory,
    nodeType: frontendType,
    status: 'idle',
    progress: 0,
    error: null,
    provider: node.providerConfig?.provider ?? null,
    model: node.providerConfig?.model ?? null,
    config: (node.config ?? {}) as Record<string, string | number | boolean>,
  };

  return {
    id: node.id,
    type: frontendType,
    position: { x: node.position.x, y: node.position.y },
    data,
  } as VdoNode;
}

function deserializeEdge(edge: BackendEdge): VdoEdge {
  return {
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    sourceHandle: edge.sourcePort,
    targetHandle: edge.targetPort,
  } as VdoEdge;
}

/**
 * Deserializes workflow definition from the backend API format back into
 * React Flow-compatible nodes and edges.
 * - Node types: kebab-case → camelCase
 * - config/providerConfig/label → node data
 * - sourceNodeId/targetNodeId → source/target
 */
export function deserializeWorkflow(definition: BackendSerializedWorkflow): {
  nodes: VdoNode[];
  edges: VdoEdge[];
  viewport?: { x: number; y: number; zoom: number };
} {
  return {
    nodes: (definition.nodes ?? []).map(deserializeNode),
    edges: (definition.edges ?? []).map(deserializeEdge),
    viewport: definition.viewport,
  };
}
