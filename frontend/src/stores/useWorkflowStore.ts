import { create } from 'zustand';
import { produce } from 'immer';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
} from '@xyflow/react';
import {
  NodeExecutionStatus,
  type BaseNodeData,
  type VdoNode,
} from '@/types/node.types';
import type { VdoEdge, VdoEdgeData } from '@/types/edge.types';
import { getNodeDefinition } from '@/config/nodeRegistry';

type HistoryEntry = {
  nodes: VdoNode[];
  edges: VdoEdge[];
};

type WorkflowState = {
  nodes: VdoNode[];
  edges: VdoEdge[];
  selectedNodeId: string | null;

  isExecuting: boolean;
  currentExecutingNodeId: string | null;

  past: HistoryEntry[];
  future: HistoryEntry[];

  workflowId: string | null;
  workflowName: string;
  isDirty: boolean;
};

type WorkflowActions = {
  onNodesChange: OnNodesChange<VdoNode>;
  onEdgesChange: OnEdgesChange<VdoEdge>;
  onConnect: OnConnect;

  addNode: (type: string, position: { x: number; y: number }) => void;
  removeNode: (nodeId: string) => void;
  duplicateNode: (nodeId: string) => void;
  updateNodeData: (
    nodeId: string,
    data: Partial<BaseNodeData>,
  ) => void;
  setSelectedNode: (nodeId: string | null) => void;

  setNodeStatus: (
    nodeId: string,
    status: NodeExecutionStatus,
  ) => void;
  setNodeProgress: (nodeId: string, progress: number) => void;
  setNodeError: (nodeId: string, error: string) => void;

  loadWorkflow: (
    nodes: VdoNode[],
    edges: VdoEdge[],
    meta: { id: string; name: string },
  ) => void;
  clearWorkflow: () => void;

  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
};

const MAX_HISTORY = 50;

let nodeCounter = 0;

function generateNodeId(type: string): string {
  nodeCounter += 1;
  return `${type}_${Date.now()}_${nodeCounter}`;
}

export const useWorkflowStore = create<WorkflowState & WorkflowActions>(
  (set, get) => ({
    nodes: [],
    edges: [],
    selectedNodeId: null,

    isExecuting: false,
    currentExecutingNodeId: null,

    past: [],
    future: [],

    workflowId: null,
    workflowName: 'Untitled Workflow',
    isDirty: false,

    onNodesChange: (changes) => {
      set((state) => ({
        nodes: applyNodeChanges(changes, state.nodes),
        isDirty: true,
      }));
    },

    onEdgesChange: (changes) => {
      set((state) => ({
        edges: applyEdgeChanges(changes, state.edges),
        isDirty: true,
      }));
    },

    onConnect: (connection: Connection) => {
      const sourceNode = get().nodes.find((n) => n.id === connection.source);
      const targetNode = get().nodes.find((n) => n.id === connection.target);

      if (!sourceNode || !targetNode) return;

      const sourceRegistry = getNodeDefinition(sourceNode.data.nodeType);
      const targetRegistry = getNodeDefinition(targetNode.data.nodeType);

      if (!sourceRegistry || !targetRegistry) {
        // Fallback: create single edge if registry lookup fails
        const sourceHandle = sourceRegistry?.outputs.find(
          (o) => o.id === connection.sourceHandle,
        );

        const edgeData: VdoEdgeData = {
          dataType: sourceHandle?.dataType ?? 'any',
          isAnimated: false,
          label: sourceHandle?.label,
        };

        get().pushHistory();
        set((state) => ({
          edges: addEdge(
            { ...connection, type: 'dataFlow', data: edgeData },
            state.edges,
          ),
          isDirty: true,
        }));
        return;
      }

      // Find all compatible port pairs between source and target
      const connectionsToCreate: Connection[] = [];

      for (const outputPort of sourceRegistry.outputs) {
        const matchingInput = targetRegistry.inputs.find(
          (input) => input.dataType === outputPort.dataType,
        );

        if (matchingInput) {
          // Check if edge already exists
          const edgeExists = get().edges.some(
            (e) =>
              e.source === connection.source &&
              e.target === connection.target &&
              e.sourceHandle === outputPort.id &&
              e.targetHandle === matchingInput.id,
          );

          if (!edgeExists) {
            connectionsToCreate.push({
              source: connection.source!,
              sourceHandle: outputPort.id,
              target: connection.target!,
              targetHandle: matchingInput.id,
            });
          }
        }
      }

      if (connectionsToCreate.length === 0) return;

      get().pushHistory();

      // Add all compatible edges
      let newEdges = get().edges;
      for (const conn of connectionsToCreate) {
        const sourceHandle = sourceRegistry.outputs.find(
          (o) => o.id === conn.sourceHandle,
        );

        const edgeData: VdoEdgeData = {
          dataType: sourceHandle?.dataType ?? 'any',
          isAnimated: false,
          label: sourceHandle?.label,
        };

        newEdges = addEdge(
          { ...conn, type: 'dataFlow', data: edgeData },
          newEdges,
        );
      }

      set({ edges: newEdges, isDirty: true });
    },

    addNode: (type, position) => {
      const definition = getNodeDefinition(type);
      if (!definition) return;

      get().pushHistory();

      const defaultConfig: Record<string, string | number | boolean> =
        {};
      for (const field of definition.configFields) {
        defaultConfig[field.key] = field.defaultValue;
      }

      const nodeData: BaseNodeData = {
        label: definition.label,
        category: definition.category,
        nodeType: type,
        status: NodeExecutionStatus.IDLE,
        progress: 0,
        error: null,
        provider:
          definition.supportedProviders[0] ?? null,
        model: null,
        config: {
          ...defaultConfig,
          ...(definition.defaultData.config ?? {}),
        },
      };

      const newNode: VdoNode = {
        id: generateNodeId(type),
        type,
        position,
        data: nodeData,
      };

      set((state) => ({
        nodes: [...state.nodes, newNode],
        isDirty: true,
      }));
    },

    removeNode: (nodeId) => {
      get().pushHistory();
      set((state) => ({
        nodes: state.nodes.filter((n) => n.id !== nodeId),
        edges: state.edges.filter(
          (e) => e.source !== nodeId && e.target !== nodeId,
        ),
        selectedNodeId:
          state.selectedNodeId === nodeId
            ? null
            : state.selectedNodeId,
        isDirty: true,
      }));
    },

    duplicateNode: (nodeId) => {
      const node = get().nodes.find((n) => n.id === nodeId);
      if (!node) return;

      get().pushHistory();

      const newNode: VdoNode = {
        ...node,
        id: generateNodeId(node.data.nodeType),
        position: {
          x: node.position.x + 50,
          y: node.position.y + 50,
        },
        selected: false,
        data: { ...node.data },
      };

      set((state) => ({
        nodes: [...state.nodes, newNode],
        isDirty: true,
      }));
    },

    updateNodeData: (nodeId, data) => {
      set(
        produce((state: WorkflowState) => {
          const node = state.nodes.find(
            (n: VdoNode) => n.id === nodeId,
          );
          if (node) {
            Object.assign(node.data, data);
            state.isDirty = true;
          }
        }),
      );
    },

    setSelectedNode: (nodeId) => {
      set({ selectedNodeId: nodeId });
    },

    setNodeStatus: (nodeId, status) => {
      set(
        produce((state: WorkflowState) => {
          const node = state.nodes.find(
            (n: VdoNode) => n.id === nodeId,
          );
          if (node) {
            node.data.status = status;
            if (status === NodeExecutionStatus.IDLE) {
              node.data.progress = 0;
              node.data.error = null;
            }
          }
        }),
      );
    },

    setNodeProgress: (nodeId, progress) => {
      set(
        produce((state: WorkflowState) => {
          const node = state.nodes.find(
            (n: VdoNode) => n.id === nodeId,
          );
          if (node) {
            node.data.progress = progress;
          }
        }),
      );
    },

    setNodeError: (nodeId, error) => {
      set(
        produce((state: WorkflowState) => {
          const node = state.nodes.find(
            (n: VdoNode) => n.id === nodeId,
          );
          if (node) {
            node.data.status = NodeExecutionStatus.ERROR;
            node.data.error = error;
          }
        }),
      );
    },

    loadWorkflow: (nodes, edges, meta) => {
      set({
        nodes,
        edges,
        workflowId: meta.id,
        workflowName: meta.name,
        isDirty: false,
        past: [],
        future: [],
        selectedNodeId: null,
      });
    },

    clearWorkflow: () => {
      set({
        nodes: [],
        edges: [],
        selectedNodeId: null,
        isExecuting: false,
        currentExecutingNodeId: null,
        past: [],
        future: [],
        isDirty: false,
      });
    },

    pushHistory: () => {
      const { nodes, edges, past } = get();
      const entry: HistoryEntry = {
        nodes: structuredClone(nodes),
        edges: structuredClone(edges),
      };
      const newPast =
        past.length >= MAX_HISTORY
          ? [...past.slice(1), entry]
          : [...past, entry];
      set({ past: newPast, future: [] });
    },

    undo: () => {
      const { past, nodes, edges } = get();
      if (past.length === 0) return;

      const previous = past[past.length - 1]!;
      const newPast = past.slice(0, -1);

      set({
        nodes: previous.nodes,
        edges: previous.edges,
        past: newPast,
        future: [{ nodes, edges }, ...get().future],
        isDirty: true,
      });
    },

    redo: () => {
      const { future, nodes, edges } = get();
      if (future.length === 0) return;

      const next = future[0]!;
      const newFuture = future.slice(1);

      set({
        nodes: next.nodes,
        edges: next.edges,
        future: newFuture,
        past: [...get().past, { nodes, edges }],
        isDirty: true,
      });
    },
  }),
);
