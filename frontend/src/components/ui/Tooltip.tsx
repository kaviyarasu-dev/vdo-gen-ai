import { useState, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type TooltipProps = {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
};

const POSITION_STYLES = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

export function Tooltip({ content, children, position = 'top', className }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showTooltip = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsVisible(true), 200);
  };

  const hideTooltip = () => {
    clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && (
        <div
          className={cn(
            'absolute z-50 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium',
            'bg-gray-900 text-white shadow-lg dark:bg-gray-100 dark:text-gray-900',
            'pointer-events-none',
            POSITION_STYLES[position],
            className,
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
