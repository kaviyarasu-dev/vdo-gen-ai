import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Film,
  Settings,
  ChevronLeft,
  ChevronRight,
  Video,
  Wand2,
} from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/lib/cn';
import { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH, HEADER_HEIGHT } from '@/config/constants';
import { ROUTES } from '@/config/routes';

const NAV_ITEMS = [
  { to: ROUTES.DASHBOARD, icon: LayoutDashboard, label: 'Dashboard' },
  { to: ROUTES.TEMPLATES, icon: Film, label: 'Templates' },
  { to: ROUTES.N8N_GENERATE, icon: Wand2, label: 'n8n Generate' },
  { to: ROUTES.SETTINGS, icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  return (
    <aside
      aria-label="Main navigation"
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r',
        'border-gray-200 bg-white transition-all duration-300',
        'dark:border-gray-700 dark:bg-surface-dark',
        // On mobile, hide when collapsed
        !sidebarOpen && 'max-lg:-translate-x-full',
      )}
      style={{ width: sidebarOpen ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED_WIDTH }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 border-b border-gray-200 px-4 dark:border-gray-700"
        style={{ height: HEADER_HEIGHT }}
      >
        <Video className="h-7 w-7 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        {sidebarOpen && (
          <span className="text-lg font-bold text-gray-900 dark:text-white">VDO Gen</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3 scrollbar-thin" role="navigation">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            aria-label={label}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200',
              )
            }
          >
            <Icon size={20} className="shrink-0" aria-hidden="true" />
            {sidebarOpen && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-gray-200 p-3 dark:border-gray-700">
        <button
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          className={cn(
            'flex w-full items-center justify-center rounded-lg p-2 text-gray-500 transition-colors',
            'hover:bg-gray-100 hover:text-gray-700',
            'dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200',
          )}
        >
          {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>
    </aside>
  );
}
