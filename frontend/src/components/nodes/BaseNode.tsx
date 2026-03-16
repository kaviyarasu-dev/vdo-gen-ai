import { memo, type ReactNode } from 'react';
import { Position } from '@xyflow/react';
import {
  FileText,
  Search,
  Users,
  Scissors,
  Image,
  Layers,
  Film,
  Merge,
  Download,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { NodeHandle } from './NodeHandle';
import { NodeStatusIndicator } from './NodeStatusIndicator';
import {
  CATEGORY_COLORS,
  NodeExecutionStatus,
  type BaseNodeData,
} from '@/types/node.types';
import { getNodeDefinition } from '@/config/nodeRegistry';
import { PROVIDER_DISPLAY_NAMES } from '@/types/provider.types';
import { useWorkflowStore } from '@/stores/useWorkflowStore';

const ICON_MAP: Record<string, LucideIcon> = {
  FileText,
  Search,
  Users,
  Scissors,
  Image,
  Layers,
  Film,
  Merge,
  Download,
};

type BaseNodeProps = {
  id: string;
  data: BaseNodeData;
  selected: boolean;
  children?: ReactNode;
};

export const BaseNode = memo(function BaseNode({
  id,
  data,
  selected,
  children,
}: BaseNodeProps) {
  const removeNode = useWorkflowStore((state) => state.removeNode);
  const definition = getNodeDefinition(data.nodeType);
  if (!definition) return null;

  const categoryColor = CATEGORY_COLORS[data.category];
  const IconComponent = ICON_MAP[definition.icon];
  const isError = data.status === NodeExecutionStatus.ERROR;
  const isProcessing =
    data.status === NodeExecutionStatus.PROCESSING;
  const isComplete = data.status === NodeExecutionStatus.COMPLETE;
  const isPending = data.status === NodeExecutionStatus.PENDING;

  return (
    <div
      className={cn(
        'min-w-[200px] max-w-[260px] rounded-lg border bg-white shadow-md transition-shadow',
        'dark:bg-gray-800 dark:border-gray-700',
        selected && 'ring-2 ring-blue-500 shadow-lg',
        isError && 'border-red-500 dark:border-red-500',
        isComplete && 'border-green-500 dark:border-green-500',
        isProcessing && 'node-processing border-blue-500',
        isPending && 'border-dashed border-gray-400 dark:border-gray-500',
        !selected && !isError && !isComplete && !isProcessing && !isPending && 'border-gray-200',
      )}
    >
      {/* Header bar */}
      <div
        className={cn(
          'group flex items-center gap-2 rounded-t-lg px-3 py-2',
          categoryColor.bg,
        )}
      >
        {IconComponent && (
          <IconComponent className="h-4 w-4 text-white" />
        )}
        <span className="flex-1 truncate text-xs font-semibold text-white">
          {data.label}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            removeNode(id);
          }}
          className="rounded p-0.5 opacity-0 transition-opacity hover:bg-white/20 group-hover:opacity-100"
          title="Delete node"
        >
          <Trash2 className="h-3.5 w-3.5 text-white/80 hover:text-white" />
        </button>
        <NodeStatusIndicator
          status={data.status}
          className="[&_span]:text-white/80 [&_svg]:text-white/80 [&_span:first-child]:bg-white/50"
        />
      </div>

      {/* Provider badge */}
      {data.provider && (
        <div className="px-3 pt-2">
          <span className="inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {PROVIDER_DISPLAY_NAMES[data.provider] ?? data.provider}
            {data.model ? ` / ${data.model}` : ''}
          </span>
        </div>
      )}

      {/* Input handles */}
      {definition.inputs.length > 0 && (
        <div className="flex flex-col gap-1 py-2">
          {definition.inputs.map((input) => (
            <NodeHandle
              key={input.id}
              id={input.id}
              type="target"
              position={Position.Left}
              dataType={input.dataType}
              label={input.label}
            />
          ))}
        </div>
      )}

      {/* Node-specific content */}
      {children && (
        <div className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
          {children}
        </div>
      )}

      {/* Output handles */}
      {definition.outputs.length > 0 && (
        <div className="flex flex-col gap-1 py-2">
          {definition.outputs.map((output) => (
            <NodeHandle
              key={output.id}
              id={output.id}
              type="source"
              position={Position.Right}
              dataType={output.dataType}
              label={output.label}
            />
          ))}
        </div>
      )}

      {/* Progress bar */}
      {isProcessing && (
        <div className="px-3 pb-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                data.progress > 0
                  ? 'bg-blue-500'
                  : 'progress-bar-shimmer',
              )}
              style={{ width: `${Math.max(data.progress, 5)}%` }}
            />
          </div>
          {data.progress > 0 && (
            <span className="mt-0.5 block text-right text-[9px] text-blue-500 dark:text-blue-400">
              {Math.round(data.progress)}%
            </span>
          )}
        </div>
      )}

      {/* Error message */}
      {isError && data.error && (
        <div className="px-3 pb-2">
          <p className="truncate text-[10px] text-red-500" title={data.error}>
            {data.error}
          </p>
        </div>
      )}
    </div>
  );
});
