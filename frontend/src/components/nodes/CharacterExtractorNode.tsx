import { memo } from 'react';
import { BaseNode } from './BaseNode';
import { areNodePropsEqual } from './nodeComparator';
import type { VdoNodeProps } from '@/types/node.types';

export const CharacterExtractorNode = memo(
  function CharacterExtractorNode({
    id,
    data,
    selected,
  }: VdoNodeProps) {
    const features: string[] = [];
    if (data.config.includeAppearance) features.push('Appearance');
    if (data.config.includePersonality) features.push('Personality');

    return (
      <BaseNode id={id} data={data} selected={selected}>
        <div className="space-y-1">
          {features.length > 0 ? (
            <p className="text-gray-500 dark:text-gray-400">
              Extracting: {features.join(', ')}
            </p>
          ) : (
            <p className="italic text-gray-400">No features selected</p>
          )}
        </div>
      </BaseNode>
    );
  },
  areNodePropsEqual,
);
