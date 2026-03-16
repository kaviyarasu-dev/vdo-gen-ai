import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { templateKeys } from '@/api/queries/templateQueries';
import type { ApiResponse } from '@/types/api.types';
import type {
  WorkflowTemplate,
  CreateTemplatePayload,
  UpdateTemplatePayload,
} from '@/types/template.types';

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateTemplatePayload) => {
      const { data } = await apiClient.post<ApiResponse<WorkflowTemplate>>(
        ENDPOINTS.TEMPLATES.LIST,
        payload,
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateTemplatePayload }) => {
      const { data } = await apiClient.patch<ApiResponse<WorkflowTemplate>>(
        ENDPOINTS.TEMPLATES.DETAIL(id),
        payload,
      );
      return data.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: templateKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(ENDPOINTS.TEMPLATES.DETAIL(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

export function useCloneTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<WorkflowTemplate>>(
        ENDPOINTS.TEMPLATES.CLONE(id),
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}
