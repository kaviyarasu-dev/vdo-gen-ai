import type { Document, Types } from 'mongoose';
import type { IWorkflowNode, IWorkflowEdge } from '../../engine/engine.types.js';

export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type NodeExecutionStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface IWorkflow {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  description?: string;
  isTemplate: boolean;
  nodes: IWorkflowNode[];
  edges: IWorkflowEdge[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWorkflowDocument extends Omit<IWorkflow, '_id'>, Document {}

export interface INodeExecutionState {
  nodeId: string;
  status: NodeExecutionStatus;
  jobId?: string;
  startedAt?: Date;
  completedAt?: Date;
  attempts: number;
  error?: string;
  progress?: number;
}

export interface IWorkflowExecution {
  _id: Types.ObjectId;
  workflowId: Types.ObjectId;
  projectId: Types.ObjectId;
  userId: Types.ObjectId;
  status: ExecutionStatus;
  workflowSnapshot: {
    nodes: IWorkflowNode[];
    edges: IWorkflowEdge[];
  };
  nodeStates: Map<string, INodeExecutionState>;
  nodeOutputs: Map<string, Record<string, unknown>>;
  error?: {
    nodeId: string;
    message: string;
    retryCount: number;
  };
  progress: {
    totalNodes: number;
    completedNodes: number;
    currentNodeId?: string;
    percentage: number;
  };
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWorkflowExecutionDocument
  extends Omit<IWorkflowExecution, '_id'>,
    Document {}

export interface CreateWorkflowDto {
  name: string;
  description?: string;
  nodes: IWorkflowNode[];
  edges: IWorkflowEdge[];
}

export interface UpdateWorkflowDto {
  name?: string;
  description?: string;
  nodes?: IWorkflowNode[];
  edges?: IWorkflowEdge[];
}

export interface ListWorkflowsQuery {
  page: number;
  limit: number;
}

export interface CreateTemplateDto {
  workflowId: string;
  name: string;
  description?: string;
}

export interface CloneTemplateDto {
  projectId: string;
  name?: string;
}
