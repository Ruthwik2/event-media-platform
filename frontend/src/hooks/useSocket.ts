'use client';
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import toast from 'react-hot-toast';

let socket: Socket | null = null;

export const useSocket = () => {
  const { token, user } = useAuthStore();
  const { addNotification } = useNotificationStore();
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
      toast(notification.message, {
        icon: '🔔',
        duration: 4000,
      });
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
  }, [token, user]);

  return socket;
};

export const getSocket = () => socket;