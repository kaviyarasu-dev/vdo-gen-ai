import { CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Notification, NotificationType } from '@/stores/useNotificationStore';

type NotificationItemProps = {
  notification: Notification;
  onMarkRead: (id: string) => void;
};

const ICONS: Record<NotificationType, typeof Info> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const ICON_COLORS: Record<NotificationType, string> = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-500',
};

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const Icon = ICONS[notification.type];

  return (
    <button
      onClick={() => {
        if (!notification.isRead) onMarkRead(notification.id);
      }}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
        'hover:bg-gray-50 dark:hover:bg-gray-700/50',
        !notification.isRead && 'bg-blue-50/50 dark:bg-blue-900/10',
      )}
    >
      <Icon size={16} className={cn('mt-0.5 shrink-0', ICON_COLORS[notification.type])} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={cn(
              'truncate text-sm',
              notification.isRead
                ? 'text-gray-600 dark:text-gray-400'
                : 'font-medium text-gray-900 dark:text-white',
            )}
          >
            {notification.title}
          </p>
          <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
            {formatTimeAgo(notification.timestamp)}
          </span>
        </div>
        {notification.message && (
          <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
            {notification.message}
          </p>
        )}
      </div>
      {!notification.isRead && (
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
      )}
    </button>
  );
}
