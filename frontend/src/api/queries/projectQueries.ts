import { queryOptions } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { ApiResponse, PaginatedResponse, ListQueryParams } from '@/types/api.types';
import type { Project } from '@/types/workflow.types';

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters: ListQueryParams) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
};

export function projectListQuery(filters: ListQueryParams = {}) {
  return queryOptions({
    queryKey: projectKeys.list(filters),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Project>>(
        ENDPOINTS.PROJECTS.LIST,
        { params: filters },
      );
      return data;
    },
  });
}

export function projectDetailQuery(id: string) {
  return queryOptions({
    queryKey: projectKeys.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Project>>(
        ENDPOINTS.PROJECTS.DETAIL(id),
      );
      return data.data;
    },
    enabled: !!id,
  });
}
