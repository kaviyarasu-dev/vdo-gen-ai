import { memo, useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Image,
  Film,
  FileText,
  Music,
  Grid3x3,
  List,
  Trash2,
  Download,
  Columns2,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { mediaListQuery } from '@/api/queries/mediaQueries';
import { useDeleteMedia } from '@/api/mutations/mediaMutations';
import { useMediaStore } from '@/stores/useMediaStore';
import { MediaPreview } from './MediaPreview';
import { FullscreenViewer } from './FullscreenViewer';
import { Spinner } from '@/components/ui/Spinner';
import type { MediaType, MediaAsset } from '@/types/media.types';

type MediaGalleryProps = {
  projectId: string;
  onSelectAsset?: (asset: MediaAsset) => void;
  onCompare?: (left: MediaAsset, right: MediaAsset) => void;
  className?: string;
};

type ViewMode = 'grid' | 'list';

const TYPE_FILTERS: { value: MediaType | 'all'; label: string; icon: typeof Image }[] = [
  { value: 'all', label: 'All', icon: Grid3x3 },
  { value: 'image', label: 'Images', icon: Image },
  { value: 'video', label: 'Videos', icon: Film },
  { value: 'audio', label: 'Audio', icon: Music },
  { value: 'script', label: 'Scripts', icon: FileText },
];

export const MediaGallery = memo(function MediaGallery({
  projectId,
  onSelectAsset,
  onCompare,
  className,
}: MediaGalleryProps) {
  const [typeFilter, setTypeFilter] = useState<MediaType | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const { selectedAssets, toggleAssetSelection, clearSelection } = useMediaStore();
  const deleteMutation = useDeleteMedia();

  const queryFilters = typeFilter === 'all' ? {} : { type: typeFilter };
  const { data, isLoading } = useQuery(mediaListQuery(projectId, queryFilters));

  const assets = useMemo(() => data?.data ?? [], [data]);
  const viewableAssets = useMemo(
    () => assets.filter((a) => a.type === 'image' || a.type === 'video'),
    [assets],
  );

  const handleAssetClick = useCallback(
    (asset: MediaAsset, index: number) => {
      if (selectedAssets.length > 0) {
        toggleAssetSelection(asset._id);
        return;
      }
      if (asset.type === 'image' || asset.type === 'video') {
        const viewableIndex = viewableAssets.findIndex(
          (a) => a._id === asset._id,
        );
        setViewerIndex(viewableIndex >= 0 ? viewableIndex : index);
        setViewerOpen(true);
      }
      onSelectAsset?.(asset);
    },
    [selectedAssets.length, toggleAssetSelection, viewableAssets, onSelectAsset],
  );

  const handleDelete = useCallback(async () => {
    for (const assetId of selectedAssets) {
      await deleteMutation.mutateAsync({ projectId, assetId });
    }
    clearSelection();
  }, [selectedAssets, projectId, deleteMutation, clearSelection]);

  const handleCompare = useCallback(() => {
    if (selectedAssets.length !== 2) return;
    const left = assets.find((a) => a._id === selectedAssets[0]);
    const right = assets.find((a) => a._id === selectedAssets[1]);
    if (left && right) {
      onCompare?.(left, right);
    }
  }, [selectedAssets, assets, onCompare]);

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2 dark:border-gray-700">
        {/* Type filters */}
        <div className="flex items-center gap-1">
          {TYPE_FILTERS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTypeFilter(value)}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
                typeFilter === value
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300',
              )}
            >
              <Icon className="h-3 w-3" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Selection actions */}
          {selectedAssets.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {selectedAssets.length} selected
              </span>
              {selectedAssets.length === 2 && onCompare && (
                <button
                  onClick={handleCompare}
                  className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700"
                  title="Compare"
                >
                  <Columns2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="rounded-md p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                title="Delete selected"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={clearSelection}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                Clear
              </button>
            </div>
          )}

          {/* View mode */}
          <div className="flex rounded-md border border-gray-200 dark:border-gray-600">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'rounded-l-md p-1 transition-colors',
                viewMode === 'grid'
                  ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
              )}
            >
              <Grid3x3 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'rounded-r-md p-1 transition-colors',
                viewMode === 'list'
                  ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
              )}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner size="md" />
          </div>
        ) : assets.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-center">
            <Image className="mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No assets yet
            </p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Generated assets will appear here
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {assets.map((asset, index) => (
              <div
                key={asset._id}
                className={cn(
                  'relative',
                  selectedAssets.includes(asset._id) &&
                    'ring-2 ring-blue-500 rounded-md',
                )}
                onContextMenu={(e) => {
                  e.preventDefault();
                  toggleAssetSelection(asset._id);
                }}
              >
                <MediaPreview
                  asset={asset}
                  onClick={() => handleAssetClick(asset, index)}
                  showMetadata
                  size="lg"
                />
                {selectedAssets.includes(asset._id) && (
                  <div className="absolute left-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                    {selectedAssets.indexOf(asset._id) + 1}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {assets.map((asset, index) => (
              <AssetListItem
                key={asset._id}
                asset={asset}
                isSelected={selectedAssets.includes(asset._id)}
                onClick={() => handleAssetClick(asset, index)}
                onSelect={() => toggleAssetSelection(asset._id)}
                onDelete={() =>
                  deleteMutation.mutate({ projectId, assetId: asset._id })
                }
                onDownload={() => {
                  const link = document.createElement('a');
                  link.href = asset.url;
                  link.download = asset.originalName;
                  link.click();
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen viewer */}
      <FullscreenViewer
        assets={viewableAssets}
        initialIndex={viewerIndex}
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  );
});

type AssetListItemProps = {
  asset: MediaAsset;
  isSelected: boolean;
  onClick: () => void;
  onSelect: () => void;
  onDelete: () => void;
  onDownload: () => void;
};

function AssetListItem({
  asset,
  isSelected,
  onClick,
  onSelect,
  onDelete,
  onDownload,
}: AssetListItemProps) {
  const TypeIcon =
    asset.type === 'image'
      ? Image
      : asset.type === 'video'
        ? Film
        : asset.type === 'audio'
          ? Music
          : FileText;

  return (
    <div
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800',
        isSelected && 'bg-blue-50 dark:bg-blue-900/20',
      )}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onSelect();
      }}
    >
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-gray-100 dark:bg-gray-700">
        <TypeIcon className="h-4 w-4 text-gray-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-300">
          {asset.originalName}
        </p>
        <div className="flex items-center gap-2 text-[10px] text-gray-400">
          <span>{asset.type}</span>
          <span>{new Date(asset.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
        >
          <Download className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
