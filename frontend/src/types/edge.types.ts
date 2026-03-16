import type { Edge } from '@xyflow/react';
import type { DataType } from './node.types';

export type EdgeStatus = 'idle' | 'active' | 'complete';

export type VdoEdgeData = {
  dataType: DataType;
  isAnimated: boolean;
  label?: string;
  status?: EdgeStatus;
  [key: string]: unknown;
};

export type VdoEdge = Edge<VdoEdgeData>;
