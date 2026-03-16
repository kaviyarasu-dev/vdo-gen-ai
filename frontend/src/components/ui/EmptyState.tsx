import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border-2 border-dashed',
        'border-gray-300 px-6 py-16 text-center dark:border-gray-600',
        className,
      )}
    >
      <Icon
        size={48}
        className="mb-4 text-gray-300 dark:text-gray-600"
        aria-hidden="true"
      />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-6">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
