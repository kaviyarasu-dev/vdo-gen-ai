import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { workflowKeys } from '@/api/queries/workflowQueries';
import type { ApiResponse } from '@/types/api.types';
import type { Workflow, SaveWorkflowPayload } from '@/types/workflow.types';

export function useSaveWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      workflowId,
      payload,
    }: {
      projectId: string;
      workflowId?: string;
      payload: SaveWorkflowPayload;
    }) => {
      if (workflowId) {
        const { data } = await apiClient.put<ApiResponse<Workflow>>(
          ENDPOINTS.PROJECTS.WORKFLOW(projectId, workflowId),
          payload,
        );
        return data.data;
      }
      const { data } = await apiClient.post<ApiResponse<Workflow>>(
        ENDPOINTS.PROJECTS.WORKFLOWS(projectId),
        payload,
      );
      return data.data;
    },
    onSuccess: (workflow, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: workflowKeys.lists(projectId),
      });
      queryClient.setQueryData(
        workflowKeys.detail(projectId, workflow._id),
        workflow,
      );
    },
  });
}

export function useLoadWorkflow(projectId: string, workflowId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Workflow>>(
        ENDPOINTS.PROJECTS.WORKFLOW(projectId, workflowId),
      );
      return data.data;
    },
    onSuccess: (workflow) => {
      queryClient.setQueryData(
        workflowKeys.detail(projectId, workflow._id),
        workflow,
      );
    },
  });
}
