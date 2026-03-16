import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { mediaKeys } from '@/api/queries/mediaQueries';
import type { ApiResponse } from '@/types/api.types';
import type { MediaAsset } from '@/types/media.types';

type UploadOptions = {
  projectId: string;
  file: File;
  nodeId?: string;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
};

export function useUploadMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      file,
      nodeId,
      onProgress,
      signal,
    }: UploadOptions) => {
      const formData = new FormData();
      formData.append('file', file);
      if (nodeId) {
        formData.append('nodeId', nodeId);
      }

      const { data } = await apiClient.post<ApiResponse<MediaAsset>>(
        ENDPOINTS.PROJECTS.ASSETS(projectId),
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          signal,
          onUploadProgress: (event) => {
            if (event.total && onProgress) {
              onProgress(Math.round((event.loaded / event.total) * 100));
            }
          },
        },
      );
      return data.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: mediaKeys.lists(),
      });
      if (variables.nodeId) {
        queryClient.invalidateQueries({
          queryKey: mediaKeys.byNode(variables.projectId, variables.nodeId),
        });
      }
    },
  });
}

export function useDeleteMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      assetId,
    }: {
      projectId: string;
      assetId: string;
    }) => {
      await apiClient.delete(
        `${ENDPOINTS.PROJECTS.ASSETS(projectId)}/${assetId}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: mediaKeys.lists(),
      });
    },
  });
}
