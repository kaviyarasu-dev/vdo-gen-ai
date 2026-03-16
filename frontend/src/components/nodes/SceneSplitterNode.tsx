import { memo } from 'react';
import { BaseNode } from './BaseNode';
import { areNodePropsEqual } from './nodeComparator';
import type { VdoNodeProps } from '@/types/node.types';

export const SceneSplitterNode = memo(function SceneSplitterNode({
  id,
  data,
  selected,
}: VdoNodeProps) {
  return (
    <BaseNode id={id} data={data} selected={selected}>
      <div className="space-y-1">
        <p className="text-gray-500 dark:text-gray-400">
          Max scenes/chunk:{' '}
          {String(data.config.maxScenesPerChunk ?? 5)}
        </p>
        {data.config.preserveTransitions && (
          <p className="text-[10px] text-gray-400">
            Preserving transitions
          </p>
        )}
      </div>
    </BaseNode>
  );
}, areNodePropsEqual);
