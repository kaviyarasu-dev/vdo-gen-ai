import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { projectKeys } from '@/api/queries/projectQueries';
import type { ApiResponse } from '@/types/api.types';
import type { Project, CreateProjectPayload, UpdateProjectPayload } from '@/types/workflow.types';

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateProjectPayload) => {
      const { data } = await apiClient.post<ApiResponse<Project>>(
        ENDPOINTS.PROJECTS.LIST,
        payload,
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateProjectPayload }) => {
      const { data } = await apiClient.patch<ApiResponse<Project>>(
        ENDPOINTS.PROJECTS.DETAIL(id),
        payload,
      );
      return data.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(ENDPOINTS.PROJECTS.DETAIL(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}
