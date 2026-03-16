import { useState, useCallback, createContext, useContext, type ReactNode } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type ToastContextType = {
  addToast: (message: string, variant?: ToastVariant, duration?: number) => void;
  removeToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: 'border-green-500 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  error: 'border-red-500 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  warning:
    'border-yellow-500 bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
  info: 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
};

const VARIANT_ICONS: Record<ToastVariant, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (message: string, variant: ToastVariant = 'info', duration = 5000) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => {
          const Icon = VARIANT_ICONS[toast.variant];
          return (
            <div
              key={toast.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border-l-4 px-4 py-3 shadow-lg',
                'min-w-[300px] max-w-[420px]',
                VARIANT_STYLES[toast.variant],
              )}
            >
              <Icon size={18} className="shrink-0" />
              <span className="flex-1 text-sm">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
