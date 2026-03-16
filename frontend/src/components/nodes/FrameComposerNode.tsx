import { memo, useState } from 'react';
import { BaseNode } from './BaseNode';
import { NodeMediaThumbnail } from '@/components/media/MediaPreview';
import { FullscreenViewer } from '@/components/media/FullscreenViewer';
import { areNodePropsEqual } from './nodeComparator';
import { NodeExecutionStatus, type VdoNodeProps } from '@/types/node.types';
import type { MediaAsset } from '@/types/media.types';

export const FrameComposerNode = memo(function FrameComposerNode({
  id,
  data,
  selected,
}: VdoNodeProps) {
  const [viewerOpen, setViewerOpen] = useState(false);

  const generatedAssets = (data.generatedAssets ?? []) as MediaAsset[];
  const isComplete = data.status === NodeExecutionStatus.COMPLETE;

  return (
    <BaseNode id={id} data={data} selected={selected}>
      <div className="space-y-1">
        <p className="text-gray-500 dark:text-gray-400">
          Camera:{' '}
          {String(data.config.cameraMotion ?? 'pan')}
        </p>
        <div className="flex gap-2 text-[10px] text-gray-400">
          <span>
            Transition:{' '}
            {String(data.config.transitionType ?? 'dissolve')}
          </span>
          <span>
            {String(data.config.fps ?? 24)} fps
          </span>
        </div>

        {/* Generated frame previews */}
        {isComplete && generatedAssets.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {generatedAssets.slice(0, 3).map((asset) => (
              <NodeMediaThumbnail
                key={asset._id}
                asset={asset}
                onClick={() => setViewerOpen(true)}
              />
            ))}
            {generatedAssets.length > 3 && (
              <span className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-100 text-[10px] text-gray-500 dark:bg-gray-700">
                +{generatedAssets.length - 3}
              </span>
            )}
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
