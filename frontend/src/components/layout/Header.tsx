import { useLocation } from 'react-router-dom';
import { Sun, Moon, Monitor, Menu } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/useUIStore';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { cn } from '@/lib/cn';
import { HEADER_HEIGHT } from '@/config/constants';

export function Header() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const location = useLocation();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  const pageTitle = getPageTitle(location.pathname);

  const cycleTheme = () => {
    const order: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const currentIndex = order.indexOf(theme);
    const nextTheme = order[(currentIndex + 1) % order.length];
    setTheme(nextTheme);
  };

  const ThemeIcon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <header
      className={cn(
        'fixed right-0 z-30 flex items-center justify-between border-b',
        'border-gray-200 bg-white px-6 dark:border-gray-700 dark:bg-surface-dark',
      )}
      style={{ height: HEADER_HEIGHT, left: 0 }}
      role="banner"
    >
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={toggleSidebar}
          aria-label="Toggle navigation menu"
          className={cn(
            'rounded-lg p-2 text-gray-500 transition-colors lg:hidden',
            'hover:bg-gray-100 hover:text-gray-700',
            'dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200',
          )}
        >
          <Menu size={20} />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-2">
        <NotificationCenter />
        <button
          onClick={cycleTheme}
          aria-label={`Switch theme (current: ${theme})`}
          className={cn(
            'rounded-lg p-2 text-gray-500 transition-colors',
            'hover:bg-gray-100 hover:text-gray-700',
            'dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200',
          )}
        >
          <ThemeIcon size={20} />
        </button>
      </div>
    </header>
  );
}

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/editor')) return 'Editor';
  if (pathname.startsWith('/settings/project')) return 'Project Settings';
  switch (pathname) {
    case '/dashboard':
      return 'Dashboard';
    case '/templates':
      return 'Templates';
    case '/n8n-generate':
      return 'n8n Video Generation';
    case '/settings':
      return 'Settings';
    default:
      return 'VDO Gen';
  }
}
