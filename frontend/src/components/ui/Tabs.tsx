import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tab = {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
};

type TabsProps = {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  className?: string;
};

export function Tabs({ tabs, defaultTab, onChange, className }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id ?? '');

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const activeContent = tabs.find((t) => t.id === activeTab)?.content;

  return (
    <div className={cn('w-full', className)}>
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            disabled={tab.disabled}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors',
              'border-b-2 -mb-px',
              'disabled:cursor-not-allowed disabled:opacity-50',
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="pt-4">{activeContent}</div>
    </div>
  );
}
