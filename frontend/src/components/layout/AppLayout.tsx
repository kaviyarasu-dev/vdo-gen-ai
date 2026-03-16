import { Outlet } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useUIStore } from '@/stores/useUIStore';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/cn';
import { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH, HEADER_HEIGHT } from '@/config/constants';

export function AppLayout() {
  useTheme(); // Initialize theme on mount
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => useUIStore.getState().toggleSidebar()}
          aria-hidden="true"
        />
      )}

      <div
        className={cn('flex flex-1 flex-col transition-all duration-300')}
        style={{
          marginLeft: sidebarOpen ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED_WIDTH,
        }}
      >
        <Header />
        <main
          className="relative flex-1 overflow-auto bg-white dark:bg-gray-900"
          style={{ marginTop: HEADER_HEIGHT }}
          role="main"
        >
          <ErrorBoundary showHomeLink>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
