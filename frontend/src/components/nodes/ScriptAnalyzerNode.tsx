import { memo } from 'react';
import { BaseNode } from './BaseNode';
import { areNodePropsEqual } from './nodeComparator';
import type { VdoNodeProps } from '@/types/node.types';

export const ScriptAnalyzerNode = memo(function ScriptAnalyzerNode({
  id,
  data,
  selected,
}: VdoNodeProps) {
  return (
    <BaseNode id={id} data={data} selected={selected}>
      <div className="space-y-1">
        <p className="text-gray-500 dark:text-gray-400">
          Depth: {String(data.config.analysisDepth ?? 'standard')}
        </p>
        {data.config.extractDialogue && (
          <p className="text-[10px] text-gray-400">
            Dialogue extraction enabled
          </p>
        )}
      </div>
    </BaseNode>
  );
}, areNodePropsEqual);
