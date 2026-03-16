import { useCallback } from 'react';
import { useMediaStore } from '@/stores/useMediaStore';
import { useUploadMedia } from '@/api/mutations/mediaMutations';
import {
  getMediaTypeFromMime,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  MAX_FILE_SIZE,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_AUDIO_TYPES,
  ALLOWED_SCRIPT_TYPES,
  type MediaType,
} from '@/types/media.types';

type UseMediaUploadOptions = {
  projectId: string;
  nodeId?: string;
  allowedTypes?: MediaType[];
  maxSize?: number;
  maxFiles?: number;
  onUploadComplete?: (assetId: string) => void;
};

function getAllowedMimeTypes(types?: MediaType[]): string[] {
  if (!types) {
    return [
      ...ALLOWED_IMAGE_TYPES,
      ...ALLOWED_VIDEO_TYPES,
      ...ALLOWED_AUDIO_TYPES,
      ...ALLOWED_SCRIPT_TYPES,
    ];
  }

  const mimes: string[] = [];
  for (const type of types) {
    if (type === 'image') mimes.push(...ALLOWED_IMAGE_TYPES);
    if (type === 'video') mimes.push(...ALLOWED_VIDEO_TYPES);
    if (type === 'audio') mimes.push(...ALLOWED_AUDIO_TYPES);
    if (type === 'script') mimes.push(...ALLOWED_SCRIPT_TYPES);
  }
  return mimes;
}

function getMaxSizeForMime(mimeType: string, customMax?: number): number {
  if (customMax) return customMax;
  const mediaType = getMediaTypeFromMime(mimeType);
  if (mediaType === 'image') return MAX_IMAGE_SIZE;
  if (mediaType === 'video') return MAX_VIDEO_SIZE;
  return MAX_FILE_SIZE;
}

function validateFile(
  file: File,
  allowedMimes: string[],
  customMaxSize?: number,
): string | null {
  if (!allowedMimes.includes(file.type)) {
    return `File type "${file.type || 'unknown'}" is not supported`;
  }
  const maxSize = getMaxSizeForMime(file.type, customMaxSize);
  if (file.size > maxSize) {
    const sizeMB = Math.round(maxSize / (1024 * 1024));
    return `File exceeds maximum size of ${sizeMB}MB`;
  }
  return null;
}

export function useMediaUpload({
  projectId,
  nodeId,
  allowedTypes,
  maxSize,
  maxFiles = 10,
  onUploadComplete,
}: UseMediaUploadOptions) {
  const uploadMutation = useUploadMedia();
  const { addUpload, updateUpload, removeUpload, uploads } = useMediaStore();

  const allowedMimes = getAllowedMimeTypes(allowedTypes);

  const acceptMap: Record<string, string[]> = {};
  for (const mime of allowedMimes) {
    acceptMap[mime] = [];
  }

  const uploadFile = useCallback(
    async (file: File) => {
      const fileId = crypto.randomUUID();

      const validationError = validateFile(file, allowedMimes, maxSize);
      if (validationError) {
        addUpload({
          fileId,
          filename: file.name,
          progress: 0,
          status: 'error',
          error: validationError,
        });
        return;
      }

      const abortController = new AbortController();

      addUpload({
        fileId,
        filename: file.name,
        progress: 0,
        status: 'uploading',
        cancelToken: abortController,
      });

      try {
        const asset = await uploadMutation.mutateAsync({
          projectId,
          file,
          nodeId,
          signal: abortController.signal,
          onProgress: (progress) => {
            updateUpload(fileId, { progress });
          },
        });

        updateUpload(fileId, { progress: 100, status: 'complete' });
        onUploadComplete?.(asset._id);
      } catch (error) {
        if (abortController.signal.aborted) {
          removeUpload(fileId);
          return;
        }
        updateUpload(fileId, {
          status: 'error',
          error:
            error instanceof Error ? error.message : 'Upload failed',
        });
      }
    },
    [
      projectId,
      nodeId,
      allowedMimes,
      maxSize,
      addUpload,
      updateUpload,
      removeUpload,
      uploadMutation,
      onUploadComplete,
    ],
  );

  const uploadFiles = useCallback(
    (files: File[]) => {
      const filesToUpload = files.slice(0, maxFiles);
      for (const file of filesToUpload) {
        uploadFile(file);
      }
    },
    [uploadFile, maxFiles],
  );

  const cancelUpload = useCallback(
    (fileId: string) => {
      const upload = uploads.find((u) => u.fileId === fileId);
      if (upload?.cancelToken) {
        upload.cancelToken.abort();
      }
      removeUpload(fileId);
    },
    [uploads, removeUpload],
  );

  return {
    uploadFiles,
    cancelUpload,
    uploads,
    isUploading: uploads.some((u) => u.status === 'uploading'),
    acceptMap,
  };
}
