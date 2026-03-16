import { memo, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, AlertCircle, CheckCircle2, Loader2, FileText } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import type { MediaType } from '@/types/media.types';
import { ProgressBar } from '@/components/ui/ProgressBar';

type MediaUploaderProps = {
  projectId: string;
  nodeId?: string;
  allowedTypes?: MediaType[];
  maxSize?: number;
  maxFiles?: number;
  onUploadComplete?: (assetId: string) => void;
  compact?: boolean;
  className?: string;
};

export const MediaUploader = memo(function MediaUploader({
  projectId,
  nodeId,
  allowedTypes,
  maxSize,
  maxFiles = 10,
  onUploadComplete,
  compact = false,
  className,
}: MediaUploaderProps) {
  const {
    uploadFiles,
    cancelUpload,
    uploads,
    isUploading,
    acceptMap,
  } = useMediaUpload({
    projectId,
    nodeId,
    allowedTypes,
    maxSize,
    maxFiles,
    onUploadComplete,
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      uploadFiles(acceptedFiles);
    },
    [uploadFiles],
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      accept: acceptMap,
      maxFiles,
      noClick: isUploading,
      noDrag: isUploading,
    });

  const activeUploads = uploads.filter(
    (u) => u.status === 'uploading' || u.status === 'pending',
  );
  const completedUploads = uploads.filter((u) => u.status === 'complete');
  const errorUploads = uploads.filter((u) => u.status === 'error');

  if (compact) {
    return (
      <div className={cn('space-y-2', className)}>
        <div
          {...getRootProps()}
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 transition-colors',
            'border-gray-300 hover:border-blue-400 hover:bg-blue-50/50',
            'dark:border-gray-600 dark:hover:border-blue-500 dark:hover:bg-blue-900/20',
            isDragActive && 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30',
            isDragReject && 'border-red-500 bg-red-50 dark:border-red-400 dark:bg-red-900/20',
            isUploading && 'pointer-events-none opacity-60',
          )}
        >
          <input {...getInputProps()} />
          <Upload className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {isDragActive ? 'Drop here' : 'Upload file'}
          </span>
        </div>
        {uploads.length > 0 && (
          <UploadList
            uploads={uploads}
            onCancel={cancelUpload}
            compact
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 transition-colors',
          'border-gray-300 hover:border-blue-400 hover:bg-blue-50/50',
          'dark:border-gray-600 dark:hover:border-blue-500 dark:hover:bg-blue-900/20',
          isDragActive &&
            'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30',
          isDragReject &&
            'border-red-500 bg-red-50 dark:border-red-400 dark:bg-red-900/20',
          isUploading && 'pointer-events-none opacity-60',
        )}
      >
        <input {...getInputProps()} />

        <div
          className={cn(
            'mb-3 rounded-full p-3',
            isDragActive
              ? 'bg-blue-100 dark:bg-blue-800'
              : 'bg-gray-100 dark:bg-gray-700',
          )}
        >
          <Upload
            className={cn(
              'h-6 w-6',
              isDragActive
                ? 'text-blue-500'
                : 'text-gray-400 dark:text-gray-500',
            )}
          />
        </div>

        {isDragReject ? (
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            File type not supported
          </p>
        ) : isDragActive ? (
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
            Drop files here
          </p>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Drag & drop files here
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              or click to browse
            </p>
          </>
        )}

        {allowedTypes && (
          <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500">
            Accepts: {allowedTypes.join(', ')}
          </p>
        )}
      </div>

      {/* Upload status summary */}
      {uploads.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400">
            {activeUploads.length > 0 && (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {activeUploads.length} uploading
              </span>
            )}
            {completedUploads.length > 0 && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                {completedUploads.length} complete
              </span>
            )}
            {errorUploads.length > 0 && (
              <span className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-red-500" />
                {errorUploads.length} failed
              </span>
            )}
          </div>
        </div>
      )}

      {/* Upload list */}
      {uploads.length > 0 && (
        <UploadList uploads={uploads} onCancel={cancelUpload} />
      )}
    </div>
  );
});

type UploadListProps = {
  uploads: ReturnType<typeof useMediaUpload>['uploads'];
  onCancel: (fileId: string) => void;
  compact?: boolean;
};

function UploadList({ uploads, onCancel, compact = false }: UploadListProps) {
  return (
    <div className={cn('space-y-1.5', compact && 'space-y-1')}>
      {uploads.map((upload) => (
        <div
          key={upload.fileId}
          className={cn(
            'flex items-center gap-2 rounded-md border px-2 py-1.5',
            'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800',
            upload.status === 'error' &&
              'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20',
            upload.status === 'complete' &&
              'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20',
          )}
        >
          {/* Icon */}
          {upload.status === 'uploading' && (
            <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-blue-500" />
          )}
          {upload.status === 'complete' && (
            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-500" />
          )}
          {upload.status === 'error' && (
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-red-500" />
          )}
          {upload.status === 'pending' && (
            <FileText className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
          )}

          {/* Details */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-gray-700 dark:text-gray-300">
              {upload.filename}
            </p>
            {upload.status === 'uploading' && (
              <ProgressBar
                value={upload.progress}
                size="sm"
                className="mt-1"
              />
            )}
            {upload.status === 'error' && upload.error && (
              <p className="truncate text-[10px] text-red-600 dark:text-red-400">
                {upload.error}
              </p>
            )}
          </div>

          {/* Cancel button */}
          {(upload.status === 'uploading' || upload.status === 'pending') && (
            <button
              onClick={() => onCancel(upload.fileId)}
              className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
