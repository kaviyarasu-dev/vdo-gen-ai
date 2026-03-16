import { queryOptions } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { PaginatedResponse, ListQueryParams } from '@/types/api.types';
import type { MediaAsset, MediaFilter } from '@/types/media.types';

export const mediaKeys = {
  all: ['media'] as const,
  lists: () => [...mediaKeys.all, 'list'] as const,
  list: (projectId: string, filters: ListQueryParams & MediaFilter) =>
    [...mediaKeys.lists(), projectId, filters] as const,
  detail: (assetId: string) => [...mediaKeys.all, 'detail', assetId] as const,
  byNode: (projectId: string, nodeId: string) =>
    [...mediaKeys.all, 'node', projectId, nodeId] as const,
};

export function mediaListQuery(
  projectId: string,
  filters: ListQueryParams & MediaFilter = {},
) {
  return queryOptions({
    queryKey: mediaKeys.list(projectId, filters),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<MediaAsset>>(
        ENDPOINTS.PROJECTS.ASSETS(projectId),
        { params: filters },
      );
      return data;
    },
    enabled: !!projectId,
  });
}

export function mediaDetailQuery(assetId: string) {
  return queryOptions({
    queryKey: mediaKeys.detail(assetId),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: MediaAsset }>(
        `${ENDPOINTS.PROJECTS.LIST}/-/assets/${assetId}`,
      );
      return data.data;
    },
    enabled: !!assetId,
  });
}

export function mediaByNodeQuery(projectId: string, nodeId: string) {
  return queryOptions({
    queryKey: mediaKeys.byNode(projectId, nodeId),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<MediaAsset>>(
        ENDPOINTS.PROJECTS.ASSETS(projectId),
        { params: { nodeId, limit: 50 } },
      );
      return data;
    },
    enabled: !!projectId && !!nodeId,
  });
}
