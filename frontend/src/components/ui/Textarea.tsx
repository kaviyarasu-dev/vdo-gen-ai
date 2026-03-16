import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type TextareaProps = {
  label?: string;
  error?: string;
  className?: string;
  wrapperClassName?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, wrapperClassName, id, ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
        {label && (
          <label
            htmlFor={textareaId}
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'min-h-[120px] rounded-lg border bg-white px-3 py-2 text-sm transition-colors',
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

Textarea.displayName = 'Textarea';
