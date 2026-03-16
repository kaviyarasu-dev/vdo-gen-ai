import { queryOptions } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { ApiResponse, PaginatedResponse } from '@/types/api.types';
import type { WorkflowTemplate, TemplateListFilters } from '@/types/template.types';

export const templateKeys = {
  all: ['templates'] as const,
  lists: () => [...templateKeys.all, 'list'] as const,
  list: (filters: TemplateListFilters) => [...templateKeys.lists(), filters] as const,
  details: () => [...templateKeys.all, 'detail'] as const,
  detail: (id: string) => [...templateKeys.details(), id] as const,
};

export function templateListQuery(filters: TemplateListFilters = {}) {
  return queryOptions({
    queryKey: templateKeys.list(filters),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<WorkflowTemplate>>(
        ENDPOINTS.TEMPLATES.LIST,
        { params: filters },
      );
      return data;
    },
  });
}

export function templateDetailQuery(id: string) {
  return queryOptions({
    queryKey: templateKeys.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<WorkflowTemplate>>(
        ENDPOINTS.TEMPLATES.DETAIL(id),
      );
      return data.data;
    },
    enabled: !!id,
  });
}
