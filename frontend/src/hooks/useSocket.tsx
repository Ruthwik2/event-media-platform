'use client';
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { getNotificationHref } from '@/lib/notificationRoutes';
import toast from 'react-hot-toast';

let socket: Socket | null = null;

export const useSocket = () => {
  const { token, user } = useAuthStore();
  const { addNotification, markAsRead } = useNotificationStore();
  const router = useRouter();
  const initialized = useRef(false);

  useEffect(() => {
    if (!token || !user || initialized.current) return;

    initialized.current = true;

    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('Socket connected');
    });

    socket.on('notification', (notification) => {
      addNotification(notification);
      const href = getNotificationHref(notification, user);

      toast(
        (toastItem) => (
          <button
            type="button"
            onClick={() => {
              toast.dismiss(toastItem.id);
              if (href) {
                markAsRead([notification.id]);
                router.push(href);
              }
            }}
            className={`flex w-full items-start gap-3 text-left ${
              href ? 'cursor-pointer' : 'cursor-default'
            }`}
          >
            <span aria-hidden="true">🔔</span>
            <span className="text-sm leading-5">{notification.message}</span>
          </button>
        ),
        {
          duration: 4000,
        }
      );
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      initialized.current = false;
    });

    return () => {
      if (socket) {
        socket.disconnect();
        initialized.current = false;
      }
    };
  }, [token, user, addNotification, markAsRead, router]);

  return socket;
};

export const getSocket = () => socket;
