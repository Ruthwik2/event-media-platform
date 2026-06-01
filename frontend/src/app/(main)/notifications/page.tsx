'use client';
import { useEffect } from 'react';
import { useNotificationStore } from '@/store/notificationStore';
import { Bell, Heart, MessageCircle, Tag, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';

export default function NotificationsPage() {
  const { notifications, fetchNotifications, markAsRead } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'LIKE': return <Heart className="w-4 h-4 text-red-400" />;
      case 'COMMENT': return <MessageCircle className="w-4 h-4 text-blue-400" />;
      case 'TAG': return <Tag className="w-4 h-4 text-green-400" />;
      default: return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-slate-400 text-sm">Stay updated on your activity</p>
        </div>
        <button onClick={() => markAsRead()} className="btn-secondary text-sm">
          <Check className="w-4 h-4" /> Mark all read
        </button>
      </div>

      <div className="space-y-2">
        {notifications.length > 0 ? (
          notifications.map((notification, i) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`card p-4 flex items-start gap-3 ${
                !notification.isRead ? 'border-primary-800 bg-primary-900/10' : ''
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0">
                {getIcon(notification.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">{notification.message}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                </p>
              </div>
              {!notification.isRead && (
                <div className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 mt-2" />
              )}
            </motion.div>
          ))
        ) : (
          <div className="text-center py-16 card">
            <Bell className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No notifications</h3>
            <p className="text-slate-400">You&apos;re all caught up!</p>
          </div>
        )}
      </div>
    </div>
  );
}