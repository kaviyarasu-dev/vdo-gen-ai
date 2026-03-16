import { memo, useState } from 'react';
import { Play } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { FullscreenViewer } from '@/components/media/FullscreenViewer';
import { areNodePropsEqual } from './nodeComparator';
import { NodeExecutionStatus, type VdoNodeProps } from '@/types/node.types';
import type { MediaAsset } from '@/types/media.types';

export const VideoGeneratorNode = memo(function VideoGeneratorNode({
  id,
  data,
  selected,
}: VdoNodeProps) {
  const [viewerOpen, setViewerOpen] = useState(false);

  const generatedAssets = (data.generatedAssets ?? []) as MediaAsset[];
  const isComplete = data.status === NodeExecutionStatus.COMPLETE;
  const videoAsset = generatedAssets[0];

  return (
    <BaseNode id={id} data={data} selected={selected}>
      <div className="space-y-1">
        <div className="flex gap-2 text-gray-500 dark:text-gray-400">
          <span>{String(data.config.duration ?? 4)}s</span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span>{String(data.config.resolution ?? '1080p')}</span>
        </div>
        <p className="text-[10px] text-gray-400">
          Motion: {String(data.config.motionStrength ?? 5)}/10
        </p>

        {/* Video thumbnail with play icon */}
        {isComplete && videoAsset && (
          <div
            className="group/vid relative mt-1 cursor-pointer overflow-hidden rounded-md"
            onClick={() => setViewerOpen(true)}
          >
            <div className="flex h-16 w-full items-center justify-center bg-gray-900">
              {videoAsset.thumbnailUrl ? (
                <img
                  src={videoAsset.thumbnailUrl}
                  alt="Generated video"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-gray-800 to-gray-900" />
              )}
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover/vid:bg-black/40">
              <div className="rounded-full bg-black/60 p-1.5">
                <Play className="h-3.5 w-3.5 text-white" fill="white" />
              </div>
            </div>
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
