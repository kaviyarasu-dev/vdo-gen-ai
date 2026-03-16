import { create } from 'zustand';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  timestamp: number;
  isRead: boolean;
  isPersistent: boolean;
};

type NotificationState = {
  notifications: Notification[];
  toasts: Notification[];
};

type NotificationActions = {
  addNotification: (
    notification: Pick<Notification, 'type' | 'title' | 'message'> & {
      isPersistent?: boolean;
    },
  ) => void;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  dismissToast: (id: string) => void;
};

const TOAST_DURATION = 5_000;

export const useNotificationStore = create<NotificationState & NotificationActions>(
  (set) => ({
    notifications: [],
    toasts: [],

    addNotification: ({ type, title, message, isPersistent = false }) => {
      const id = crypto.randomUUID();
      const notification: Notification = {
        id,
        type,
        title,
        message,
        timestamp: Date.now(),
        isRead: false,
        isPersistent,
      };

      set((state) => ({
        notifications: [notification, ...state.notifications].slice(0, 100),
        toasts: [...state.toasts, notification],
      }));

      // Auto-dismiss toast
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, TOAST_DURATION);
    },

    removeNotification: (id) => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }));
    },

    markAsRead: (id) => {
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n,
        ),
      }));
    },

    markAllAsRead: () => {
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      }));
    },

    clearNotifications: () => {
      set({ notifications: [] });
    },

    dismissToast: (id) => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    },
  }),
);
