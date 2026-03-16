import { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { cn } from '@/lib/cn';

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const notifications = useNotificationStore((s) => s.notifications);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          'relative rounded-lg p-2 text-gray-500 transition-colors',
          'hover:bg-gray-100 hover:text-gray-700',
          'dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200',
        )}
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-xl border shadow-xl',
            'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
            'animate-in fade-in slide-in-from-top-2 duration-200',
          )}
        >
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell size={24} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No notifications yet
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {notifications.slice(0, 20).map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkRead={markAsRead}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
