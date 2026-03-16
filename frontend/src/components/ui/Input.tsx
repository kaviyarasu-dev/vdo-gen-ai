import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type InputProps = {
  label?: string;
  error?: string;
  className?: string;
  wrapperClassName?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, wrapperClassName, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-10 rounded-lg border bg-white px-3 text-sm transition-colors',
            'placeholder:text-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
            'dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500',
            'dark:focus:ring-offset-gray-900',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error
              ? 'border-red-500 focus:ring-red-500 dark:border-red-400'
              : 'border-gray-300 dark:border-gray-600',
            className,
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
