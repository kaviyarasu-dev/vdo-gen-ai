import { Link } from 'react-router-dom';
import { ROUTES } from '@/config/routes';

export function Component() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <h1 className="text-6xl font-bold text-gray-300 dark:text-gray-600">404</h1>
      <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">Page not found</p>
      <Link
        to={ROUTES.DASHBOARD}
        className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
