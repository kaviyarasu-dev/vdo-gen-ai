import { queryOptions } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { PaginatedResponse } from '@/types/api.types';
import type { Workflow } from '@/types/workflow.types';

export const workflowKeys = {
  all: ['workflows'] as const,
  lists: (projectId: string) => [...workflowKeys.all, 'list', projectId] as const,
  detail: (projectId: string, workflowId: string) =>
    [...workflowKeys.all, 'detail', projectId, workflowId] as const,
};

export function projectWorkflowsQuery(projectId: string) {
  return queryOptions({
    queryKey: workflowKeys.lists(projectId),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Workflow>>(
        ENDPOINTS.PROJECTS.WORKFLOWS(projectId),
        { params: { limit: 1 } },
      );
      return data;
    },
    enabled: !!projectId,
  });
}
