import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type SliderProps = {
  label?: string;
  showValue?: boolean;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({ label, showValue = true, className, value, min = 0, max = 100, id, ...props }, ref) => {
    const sliderId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        {(label || showValue) && (
          <div className="flex items-center justify-between">
            {label && (
              <label
                htmlFor={sliderId}
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {label}
              </label>
            )}
            {showValue && (
              <span className="text-sm text-gray-500 dark:text-gray-400">{value}</span>
            )}
          </div>
        )}
        <input
          ref={ref}
          id={sliderId}
          type="range"
          value={value}
          min={min}
          max={max}
          className={cn(
            'h-2 w-full cursor-pointer appearance-none rounded-lg',
            'bg-gray-200 dark:bg-gray-700',
            'accent-blue-600 dark:accent-blue-500',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
          {...props}
        />
      </div>
    );
  },
);

Slider.displayName = 'Slider';
