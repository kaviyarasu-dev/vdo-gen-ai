import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { useAuthStore } from '@/stores/useAuthStore';
import { ROUTES } from '@/config/routes';

function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return <Outlet />;
}

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: 'login', lazy: () => import('@/pages/LoginPage') },
      { path: 'register', lazy: () => import('@/pages/RegisterPage') },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', lazy: () => import('@/pages/DashboardPage') },
          { path: 'editor/:projectId', lazy: () => import('@/pages/EditorPage') },
          { path: 'templates', lazy: () => import('@/pages/TemplatesPage') },
          { path: 'n8n-generate', lazy: () => import('@/pages/N8nGeneratePage') },
          { path: 'settings', lazy: () => import('@/pages/SettingsPage') },
          { path: 'settings/project/:projectId', lazy: () => import('@/pages/ProjectSettingsPage') },
        ],
      },
    ],
  },
  { path: '*', lazy: () => import('@/pages/NotFoundPage') },
]);
