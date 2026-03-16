import type { Node } from '@xyflow/react';

export const NodeCategory = {
  INPUT: 'input',
  PROCESSING: 'processing',
  GENERATION: 'generation',
  OUTPUT: 'output',
} as const;

export type NodeCategory = (typeof NodeCategory)[keyof typeof NodeCategory];

export const NodeExecutionStatus = {
  IDLE: 'idle',
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETE: 'complete',
  ERROR: 'error',
} as const;

export type NodeExecutionStatus =
  (typeof NodeExecutionStatus)[keyof typeof NodeExecutionStatus];

export const DataType = {
  SCRIPT: 'script',
  CHARACTERS: 'characters',
  SCENES: 'scenes',
  IMAGE: 'image',
  FRAME: 'frame',
  VIDEO: 'video',
  AUDIO: 'audio',
  ANY: 'any',
} as const;

export type DataType = (typeof DataType)[keyof typeof DataType];

export type HandleDefinition = {
  id: string;
  label: string;
  dataType: DataType;
  isRequired: boolean;
  maxConnections: number;
};

export type ConfigFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'toggle'
  | 'slider'
  | 'color';

export type ConfigField = {
  key: string;
  label: string;
  type: ConfigFieldType;
  defaultValue: string | number | boolean;
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
};

export type NodeDefinition = {
  type: string;
  label: string;
  category: NodeCategory;
  icon: string;
  description: string;
  defaultData: Partial<BaseNodeData>;
  inputs: HandleDefinition[];
  outputs: HandleDefinition[];
  configFields: ConfigField[];
  supportedProviders: string[];
};

export type BaseNodeData = {
  label: string;
  category: NodeCategory;
  nodeType: string;
  status: NodeExecutionStatus;
  progress: number;
  error: string | null;
  provider: string | null;
  model: string | null;
  config: Record<string, string | number | boolean>;
  [key: string]: unknown;
};

export type VdoNode = Node<BaseNodeData>;

/** Props passed to custom node components */
export type VdoNodeProps = {
  id: string;
  data: BaseNodeData;
  selected: boolean;
  type: string;
  dragging: boolean;
  isConnectable: boolean;
  zIndex: number;
  positionAbsoluteX: number;
  positionAbsoluteY: number;
};

export const CATEGORY_COLORS: Record<
  NodeCategory,
  { light: string; dark: string; bg: string; ring: string }
> = {
  [NodeCategory.INPUT]: {
    light: '#10b981',
    dark: '#059669',
    bg: 'bg-emerald-500',
    ring: 'ring-emerald-500/30',
  },
  [NodeCategory.PROCESSING]: {
    light: '#3b82f6',
    dark: '#2563eb',
    bg: 'bg-blue-500',
    ring: 'ring-blue-500/30',
  },
  [NodeCategory.GENERATION]: {
    light: '#8b5cf6',
    dark: '#7c3aed',
    bg: 'bg-violet-500',
    ring: 'ring-violet-500/30',
  },
  [NodeCategory.OUTPUT]: {
    light: '#f59e0b',
    dark: '#d97706',
    bg: 'bg-amber-500',
    ring: 'ring-amber-500/30',
  },
};

export const DATA_TYPE_COLORS: Record<DataType, string> = {
  [DataType.SCRIPT]: '#10b981',
  [DataType.CHARACTERS]: '#f59e0b',
  [DataType.SCENES]: '#3b82f6',
  [DataType.IMAGE]: '#8b5cf6',
  [DataType.FRAME]: '#ec4899',
  [DataType.VIDEO]: '#ef4444',
  [DataType.AUDIO]: '#06b6d4',
  [DataType.ANY]: '#6b7280',
};
