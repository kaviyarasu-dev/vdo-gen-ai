import { Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { NodeExecutionStatus } from '@/types/node.types';

type NodeStatusIndicatorProps = {
  status: NodeExecutionStatus;
  className?: string;
};

const STATUS_CONFIG: Record<
  NodeExecutionStatus,
  { label: string; dotClass: string; textClass: string }
> = {
  [NodeExecutionStatus.IDLE]: {
    label: 'Idle',
    dotClass: 'bg-gray-400',
    textClass: 'text-gray-500 dark:text-gray-400',
  },
  [NodeExecutionStatus.PENDING]: {
    label: 'Pending',
    dotClass: 'bg-yellow-400 animate-pulse',
    textClass: 'text-yellow-600 dark:text-yellow-400',
  },
  [NodeExecutionStatus.PROCESSING]: {
    label: 'Processing',
    dotClass: 'bg-blue-500',
    textClass: 'text-blue-600 dark:text-blue-400',
  },
  [NodeExecutionStatus.COMPLETE]: {
    label: 'Complete',
    dotClass: 'bg-green-500',
    textClass: 'text-green-600 dark:text-green-400',
  },
  [NodeExecutionStatus.ERROR]: {
    label: 'Error',
    dotClass: 'bg-red-500',
    textClass: 'text-red-600 dark:text-red-400',
  },
};

function StatusIcon({ status }: { status: NodeExecutionStatus }) {
  if (status === NodeExecutionStatus.PROCESSING) {
    return (
      <Loader2 className="h-3 w-3 text-blue-500 node-spinner" />
    );
  }

  if (status === NodeExecutionStatus.COMPLETE) {
    return <Check className="h-3 w-3 text-green-500" />;
  }

  if (status === NodeExecutionStatus.ERROR) {
    return <X className="h-3 w-3 text-red-500" />;
  }

  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full',
        config.dotClass,
      )}
    />
  );
}

export function NodeStatusIndicator({
  status,
  className,
}: NodeStatusIndicatorProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div
      className={cn('flex items-center gap-1.5', className)}
    >
      <StatusIcon status={status} />
      <span
        className={cn(
          'text-[10px] font-medium',
          config.textClass,
        )}
      >
        {config.label}
      </span>
    </div>
  );
}
