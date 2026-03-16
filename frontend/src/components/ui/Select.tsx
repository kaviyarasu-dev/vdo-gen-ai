import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectProps = {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  wrapperClassName?: string;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      options,
      placeholder,
      className,
      wrapperClassName,
      id,
      ...props
    },
    ref,
  ) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'h-10 w-full appearance-none rounded-lg border bg-white px-3 pr-10 text-sm transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
              'dark:bg-gray-800 dark:text-gray-100',
              'dark:focus:ring-offset-gray-900',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error
                ? 'border-red-500 focus:ring-red-500 dark:border-red-400'
                : 'border-gray-300 dark:border-gray-600',
              className,
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
              >
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
        </div>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  },
);

Select.displayName = 'Select';
