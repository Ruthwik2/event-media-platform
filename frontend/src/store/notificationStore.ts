import { create } from 'zustand';
import { Notification } from '@/types';
import api from '@/lib/axios';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  markAsRead: (ids?: string[]) => Promise<void>;
  addNotification: (notification: Notification) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  fetchNotifications: async () => {
    try {
      const response = await api.get('/notifications');
      set({
        notifications: response.data.data,
        unreadCount: response.data.unreadCount,
      });
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  },

  markAsRead: async (ids) => {
    try {
      await api.put('/notifications/read', { notificationIds: ids });
      set((state) => ({
        notifications: state.notifications.map((n) =>
          !ids || ids.includes(n.id) ? { ...n, isRead: true } : n
        ),
        unreadCount: ids
          ? Math.max(
              0,
              state.unreadCount -
                state.notifications.filter((n) => ids.includes(n.id) && !n.isRead)
                  .length
            )
          : 0,
      }));
    } catch (error) {
      console.error('Failed to mark notifications:', error);
    }
  },

  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },
}));
