import { memo } from 'react';
import { FileText, Upload } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { areNodePropsEqual } from './nodeComparator';
import type { VdoNodeProps } from '@/types/node.types';
import type { MediaAsset } from '@/types/media.types';

export const ScriptInputNode = memo(function ScriptInputNode({
  id,
  data,
  selected,
}: VdoNodeProps) {
  const content = data.config.content as string;
  const hasContent = content && content.length > 0;
  const uploadedAsset = (data.uploadedAsset as MediaAsset | undefined) ?? null;

  return (
    <BaseNode id={id} data={data} selected={selected}>
      <div className="space-y-1">
        {uploadedAsset ? (
          <div className="flex items-center gap-1.5 rounded bg-emerald-50 px-2 py-1 dark:bg-emerald-900/20">
            <FileText className="h-3 w-3 text-emerald-500" />
            <span className="truncate text-[10px] text-emerald-700 dark:text-emerald-400">
              {uploadedAsset.originalName}
            </span>
          </div>
        ) : hasContent ? (
          <p className="line-clamp-2 text-gray-500 dark:text-gray-400">
            {content.slice(0, 80)}
            {content.length > 80 ? '...' : ''}
          </p>
        ) : (
          <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
            <Upload className="h-3 w-3" />
            <span className="italic text-[10px]">Upload or enter script</span>
          </div>
        )}
        <p className="text-[10px] text-gray-400">
          Format: {String(data.config.format ?? 'plaintext')}
        </p>
      </div>
    </BaseNode>
  );
}, areNodePropsEqual);
