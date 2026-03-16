import { memo, useState } from 'react';
import { Play } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { FullscreenViewer } from '@/components/media/FullscreenViewer';
import { areNodePropsEqual } from './nodeComparator';
import { NodeExecutionStatus, type VdoNodeProps } from '@/types/node.types';
import type { MediaAsset } from '@/types/media.types';

export const VideoCombinerNode = memo(function VideoCombinerNode({
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
        <p className="text-gray-500 dark:text-gray-400">
          Transition:{' '}
          {String(data.config.transitionDuration ?? 0.5)}s
        </p>
        {data.config.addAudio && (
          <p className="text-[10px] text-gray-400">
            Audio track enabled
          </p>
        )}

        {/* Combined video preview */}
        {isComplete && videoAsset && (
          <div
            className="group/vid relative mt-1 cursor-pointer overflow-hidden rounded-md"
            onClick={() => setViewerOpen(true)}
          >
            <div className="flex h-16 w-full items-center justify-center bg-gray-900">
              {videoAsset.thumbnailUrl ? (
                <img
                  src={videoAsset.thumbnailUrl}
                  alt="Combined video"
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
