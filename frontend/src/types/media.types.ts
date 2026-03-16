export type MediaType = 'image' | 'video' | 'script' | 'audio';

export type MediaSource = 'upload' | 'generated';

export type UploadStatus = 'pending' | 'uploading' | 'complete' | 'error';

export type MediaAsset = {
  _id: string;
  type: MediaType;
  source: MediaSource;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  metadata: {
    width?: number;
    height?: number;
    duration?: number;
    generatedBy?: {
      provider: string;
      model: string;
      prompt?: string;
    };
  };
  nodeId?: string;
  createdAt: string;
};

export type UploadProgress = {
  fileId: string;
  filename: string;
  progress: number;
  status: UploadStatus;
  error?: string;
  cancelToken?: AbortController;
};

export type MediaFilter = {
  type?: MediaType;
  source?: MediaSource;
  nodeId?: string;
};

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const;

export const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
] as const;

export const ALLOWED_SCRIPT_TYPES = [
  'text/plain',
  'application/pdf',
] as const;

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
export const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB

export function getMediaTypeFromMime(mimeType: string): MediaType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'script';
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const size = bytes / Math.pow(1024, exponent);
  return `${size.toFixed(exponent > 0 ? 1 : 0)} ${units[exponent]}`;
}
