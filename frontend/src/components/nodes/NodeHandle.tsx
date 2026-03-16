import { Handle, Position, type HandleProps } from '@xyflow/react';
import { cn } from '@/lib/cn';
import { DATA_TYPE_COLORS, type DataType } from '@/types/node.types';

type NodeHandleProps = Omit<HandleProps, 'position'> & {
  dataType: DataType;
  label: string;
  position?: Position;
  className?: string;
};

export function NodeHandle({
  dataType,
  label,
  position = Position.Left,
  className,
  ...handleProps
}: NodeHandleProps) {
  const color = DATA_TYPE_COLORS[dataType];
  const isLeft = position === Position.Left;

  return (
    <div
      className={cn(
        'relative flex items-center',
        isLeft ? 'flex-row' : 'flex-row-reverse',
        className,
      )}
    >
      <Handle
        position={position}
        className="!border-2 !border-white dark:!border-gray-800"
        style={{
          backgroundColor: color,
          width: 12,
          height: 12,
        }}
        {...handleProps}
      />
      <span
        className={cn(
          'text-[10px] text-gray-500 dark:text-gray-400',
          isLeft ? 'ml-3' : 'mr-3',
        )}
      >
        {label}
      </span>
    </div>
  );
}
