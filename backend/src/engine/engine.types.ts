import type { NodeType, PortDataType } from '../modules/nodes/node.types.js';

export interface IWorkflowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  config: Record<string, unknown>;
  providerConfig?: {
    provider: string;
    model?: string;
    params?: Record<string, unknown>;
  };
  label?: string;
}

export interface IWorkflowEdge {
  id: string;
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetPort: string;
}

export interface ExecutionLayer {
  layer: number;
  nodeIds: string[];
}

export interface FlowJob {
  name: string;
  queueName: string;
  data: {
    executionId: string;
    nodeId: string;
    nodeType: NodeType;
  };
  children?: FlowJob[];
  opts?: {
    jobId?: string;
  };
}

export interface GraphValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface PortConnection {
  sourceNodeId: string;
  sourcePort: string;
  sourceDataType: PortDataType;
  targetNodeId: string;
  targetPort: string;
  targetDataType: PortDataType;
}
