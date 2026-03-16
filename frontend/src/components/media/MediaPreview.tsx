import { memo } from 'react';
import { Image, Film, FileText, Music, Expand } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatFileSize, type MediaAsset } from '@/types/media.types';

type MediaPreviewProps = {
  asset: MediaAsset;
  onClick?: () => void;
  showMetadata?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const SIZE_CLASSES = {
  sm: 'h-12 w-12',
  md: 'h-24 w-24',
  lg: 'h-40 w-full',
} as const;

export const MediaPreview = memo(function MediaPreview({
  asset,
  onClick,
  showMetadata = false,
  size = 'md',
  className,
}: MediaPreviewProps) {
  const isClickable = !!onClick;

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-md border border-gray-200 bg-gray-100',
        'dark:border-gray-700 dark:bg-gray-800',
        isClickable && 'cursor-pointer',
        className,
      )}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <div className={cn('relative', SIZE_CLASSES[size])}>
        {asset.type === 'image' && (
          <img
            src={asset.thumbnailUrl ?? asset.url}
            alt={asset.originalName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        )}

        {asset.type === 'video' && (
          <div className="flex h-full w-full items-center justify-center bg-gray-900">
            {asset.thumbnailUrl ? (
              <>
                <img
                  src={asset.thumbnailUrl}
                  alt={asset.originalName}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="rounded-full bg-black/60 p-2">
                    <Film className="h-4 w-4 text-white" />
                  </div>
                </div>
              </>
            ) : (
              <Film className="h-6 w-6 text-gray-500" />
            )}
          </div>
        )}

        {asset.type === 'audio' && (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/30 dark:to-cyan-800/30">
            <Music className="h-6 w-6 text-cyan-500" />
          </div>
        )}

        {asset.type === 'script' && (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700">
            <FileText className="h-6 w-6 text-gray-500" />
          </div>
        )}

        {/* Hover overlay */}
        {isClickable && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
            <Expand className="h-4 w-4 text-white opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        )}

        {/* Source badge */}
        {asset.source === 'generated' && (
          <span className="absolute right-1 top-1 rounded bg-violet-500/80 px-1 py-0.5 text-[8px] font-medium text-white">
            AI
          </span>
        )}
      </div>

      {/* Metadata */}
      {showMetadata && (
        <div className="px-2 py-1.5">
          <p className="truncate text-[10px] font-medium text-gray-700 dark:text-gray-300">
            {asset.originalName}
          </p>
          <div className="mt-0.5 flex items-center gap-2 text-[9px] text-gray-400">
            <span>{formatFileSize(asset.size)}</span>
            {asset.metadata.width && asset.metadata.height && (
              <span>
                {asset.metadata.width}x{asset.metadata.height}
              </span>
            )}
            {asset.metadata.duration != null && (
              <span>{asset.metadata.duration.toFixed(1)}s</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

/** Inline thumbnail for use inside node bodies */
type NodeMediaThumbnailProps = {
  asset: MediaAsset;
  onClick?: () => void;
  className?: string;
};

export const NodeMediaThumbnail = memo(function NodeMediaThumbnail({
  asset,
  onClick,
  className,
}: NodeMediaThumbnailProps) {
  return (
    <MediaPreview
      asset={asset}
      onClick={onClick}
      size="sm"
      className={cn('inline-block', className)}
    />
  );
});

/** Type-specific icon for media assets */
export function MediaTypeIcon({
  type,
  className,
}: {
  type: MediaAsset['type'];
  className?: string;
}) {
  const iconClass = cn('h-4 w-4', className);
  switch (type) {
    case 'image':
      return <Image className={iconClass} />;
    case 'video':
      return <Film className={iconClass} />;
    case 'audio':
      return <Music className={iconClass} />;
    case 'script':
      return <FileText className={iconClass} />;
  }
}
