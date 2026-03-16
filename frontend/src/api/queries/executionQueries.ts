import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { ApiResponse } from '@/types/api.types';

type NodeStateResponse = {
  nodeId: string;
  status: string;
  output: Record<string, unknown> | null;
};

export const executionKeys = {
  all: ['executions'] as const,
  nodeOutputs: () => [...executionKeys.all, 'nodeOutput'] as const,
  nodeOutput: (executionId: string, nodeId: string) =>
    [...executionKeys.nodeOutputs(), executionId, nodeId] as const,
};

export function useNodeOutput(executionId: string | null, nodeId: string | null) {
  return useQuery({
    queryKey: executionKeys.nodeOutput(executionId!, nodeId!),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<NodeStateResponse>>(
        ENDPOINTS.EXECUTIONS.NODE_STATE(executionId!, nodeId!),
      );
      return data.data;
    },
    enabled: !!executionId && !!nodeId,
    staleTime: 30_000,
  });
}
