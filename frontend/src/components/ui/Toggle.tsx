import { cn } from '@/lib/cn';

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
};

export function Toggle({ checked, onChange, label, disabled = false, className }: ToggleProps) {
  return (
    <label
      className={cn(
        'inline-flex cursor-pointer items-center gap-3',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <button
        role="switch"
        type="button"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
          'dark:focus-visible:ring-offset-gray-900',
          checked ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-300 dark:bg-gray-600',
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
            'translate-y-0.5',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
      {label && (
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      )}
    </label>
  );
}
