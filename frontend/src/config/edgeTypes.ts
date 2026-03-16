import { DataFlowEdge } from '@/components/edges/DataFlowEdge';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const edgeTypes: Record<string, React.ComponentType<any>> = {
  dataFlow: DataFlowEdge,
};
