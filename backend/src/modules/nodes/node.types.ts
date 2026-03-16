export type NodeType =
  | 'script-input'
  | 'script-analyzer'
  | 'character-extractor'
  | 'scene-splitter'
  | 'image-generator'
  | 'frame-composer'
  | 'video-generator'
  | 'video-combiner'
  | 'output';

export const NODE_TYPES: readonly NodeType[] = [
  'script-input',
  'script-analyzer',
  'character-extractor',
  'scene-splitter',
  'image-generator',
  'frame-composer',
  'video-generator',
  'video-combiner',
  'output',
] as const;

export type PortDataType =
  | 'script'
  | 'text'
  | 'characters'
  | 'scenes'
  | 'image'
  | 'frame'
  | 'video';

export interface IPortDefinition {
  id: string;
  dataType: PortDataType;
  required?: boolean;
  maxConnections?: number;
}

export interface INodePortSchema {
  inputs: IPortDefinition[];
  outputs: IPortDefinition[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ExecutionContext {
  executionId: string;
  workflowId: string;
  projectId: string;
  userId: string;
  nodeId: string;
  providerConfig?: {
    provider: string;
    model?: string;
    params?: Record<string, unknown>;
  };
}
