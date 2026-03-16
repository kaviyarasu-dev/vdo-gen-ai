import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useNotificationStore, type NotificationType } from '@/stores/useNotificationStore';
import { cn } from '@/lib/cn';

const VARIANT_STYLES: Record<NotificationType, string> = {
  success: 'border-green-500 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  error: 'border-red-500 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  warning:
    'border-yellow-500 bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
  info: 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
};

const VARIANT_ICONS: Record<NotificationType, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export function ToastContainer() {
  const toasts = useNotificationStore((s) => s.toasts);
  const dismissToast = useNotificationStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = VARIANT_ICONS[toast.type];
        return (
          <div
            key={toast.id}
            className={cn(
              'flex items-start gap-3 rounded-lg border-l-4 px-4 py-3 shadow-lg',
              'min-w-[300px] max-w-[420px]',
              'animate-in slide-in-from-right duration-300',
              VARIANT_STYLES[toast.type],
            )}
          >
            <Icon size={18} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{toast.title}</p>
              {toast.message && (
                <p className="mt-0.5 text-xs opacity-80">{toast.message}</p>
              )}
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
