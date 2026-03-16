import { useState, useRef, useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type DropdownItem = {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  variant?: 'default' | 'danger';
};

type DropdownProps = {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
};

export function Dropdown({ trigger, items, align = 'left', className }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className={cn('relative inline-block', className)}>
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>

      {isOpen && (
        <div
          className={cn(
            'absolute z-50 mt-1 min-w-[160px] rounded-lg border bg-white py-1 shadow-lg',
            'dark:border-gray-700 dark:bg-gray-800',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => {
                item.onClick();
                setIsOpen(false);
              }}
              disabled={item.disabled}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-50',
                item.variant === 'danger'
                  ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700',
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
