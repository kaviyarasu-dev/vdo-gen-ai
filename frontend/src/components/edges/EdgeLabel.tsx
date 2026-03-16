import { cn } from '@/lib/cn';
import { DATA_TYPE_COLORS, type DataType } from '@/types/node.types';

type EdgeLabelProps = {
  label: string;
  dataType: DataType;
  className?: string;
};

export function EdgeLabel({ label, dataType, className }: EdgeLabelProps) {
  const color = DATA_TYPE_COLORS[dataType];

  return (
    <div
      className={cn(
        'pointer-events-none rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[9px] font-medium shadow-sm',
        'dark:border-gray-600 dark:bg-gray-800',
        className,
      )}
      style={{ color }}
    >
      {label}
    </div>
  );
}
