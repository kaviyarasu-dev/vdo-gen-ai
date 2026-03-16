import type { VdoNode } from './node.types';
import type { VdoEdge } from './edge.types';
import type { BackendSerializedWorkflow } from '@/services/workflowSerializer';

export type ProjectStatus = 'draft' | 'active' | 'archived';

export type ProjectSettings = {
  outputResolution: string;
  outputFormat: string;
  frameRate: number;
};

export type Project = {
  _id: string;
  name: string;
  description?: string;
  settings: ProjectSettings;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectPayload = {
  name: string;
  description?: string;
  settings?: Partial<ProjectSettings>;
};

export type UpdateProjectPayload = Partial<
  Pick<Project, 'name' | 'description' | 'status'> & {
    settings: Partial<ProjectSettings>;
  }
>;

/** React Flow format (used internally in the editor) */
export type SerializedWorkflow = {
  nodes: VdoNode[];
  edges: VdoEdge[];
  viewport?: { x: number; y: number; zoom: number };
};

/** Workflow as returned from the backend API (definition uses backend format) */
export type Workflow = {
  _id: string;
  projectId: string;
  name: string;
  definition: BackendSerializedWorkflow;
  version: number;
  createdAt: string;
  updatedAt: string;
};

/** Payload sent to the backend API (definition uses backend format) */
export type SaveWorkflowPayload = {
  name?: string;
  definition: BackendSerializedWorkflow;
};
