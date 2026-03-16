import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';

type LoadingOverlayProps = {
  label?: string;
  className?: string;
};

export function LoadingOverlay({ label, className }: LoadingOverlayProps) {
  return (
    <div
      role="status"
      aria-label={label ?? 'Loading'}
      className={cn(
        'flex h-full min-h-[200px] flex-col items-center justify-center gap-3',
        className,
      )}
    >
      <Spinner size="lg" />
      {label && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      )}
    </div>
  );
}
