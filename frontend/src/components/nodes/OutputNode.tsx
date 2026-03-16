import { memo, useState, useCallback } from 'react';
import { Download, Play } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { FullscreenViewer } from '@/components/media/FullscreenViewer';
import { areNodePropsEqual } from './nodeComparator';
import { NodeExecutionStatus, type VdoNodeProps } from '@/types/node.types';
import type { MediaAsset } from '@/types/media.types';

export const OutputNode = memo(function OutputNode({
  id,
  data,
  selected,
}: VdoNodeProps) {
  const [viewerOpen, setViewerOpen] = useState(false);

  const generatedAssets = (data.generatedAssets ?? []) as MediaAsset[];
  const isComplete = data.status === NodeExecutionStatus.COMPLETE;
  const outputAsset = generatedAssets[0];

  const handleDownload = useCallback(() => {
    if (!outputAsset) return;
    const link = document.createElement('a');
    link.href = outputAsset.url;
    link.download = outputAsset.originalName;
    link.click();
  }, [outputAsset]);

  return (
    <BaseNode id={id} data={data} selected={selected}>
      <div className="space-y-1">
        <div className="flex gap-2 text-gray-500 dark:text-gray-400">
          <span className="uppercase">
            {String(data.config.format ?? 'mp4')}
          </span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span>{String(data.config.quality ?? 'high')}</span>
        </div>
        {data.config.includeSubtitles && (
          <p className="text-[10px] text-gray-400">
            Subtitles enabled
          </p>
        )}

        {/* Final output preview + download */}
        {isComplete && outputAsset && (
          <div className="mt-1 space-y-1">
            <div
              className="group/vid relative cursor-pointer overflow-hidden rounded-md"
              onClick={() => setViewerOpen(true)}
            >
              <div className="flex h-16 w-full items-center justify-center bg-gray-900">
                {outputAsset.thumbnailUrl ? (
                  <img
                    src={outputAsset.thumbnailUrl}
                    alt="Final output"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-amber-800/50 to-amber-900/50" />
                )}
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover/vid:bg-black/40">
                <div className="rounded-full bg-black/60 p-1.5">
                  <Play className="h-3.5 w-3.5 text-white" fill="white" />
                </div>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
              className="flex w-full items-center justify-center gap-1 rounded-md bg-amber-500 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-amber-600"
            >
              <Download className="h-3 w-3" />
              Download
            </button>
          </div>
        )}
      </div>

      <FullscreenViewer
        assets={generatedAssets}
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </BaseNode>
  );
}, areNodePropsEqual);
