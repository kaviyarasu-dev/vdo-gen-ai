import { cn } from '@/lib/cn';

type SkeletonProps = {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
};

export function Skeleton({ className, variant = 'text' }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-gray-200 dark:bg-gray-700',
        variant === 'text' && 'h-4 w-full rounded',
        variant === 'circular' && 'rounded-full',
        variant === 'rectangular' && 'rounded-lg',
        className,
      )}
    />
  );
}
