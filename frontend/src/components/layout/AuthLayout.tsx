import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { ROUTES } from '@/config/routes';
import { useTheme } from '@/hooks/useTheme';

export function AuthLayout() {
  useTheme();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-surface-dark">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            VDO Gen
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            AI Video Generation Workflow Platform
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
