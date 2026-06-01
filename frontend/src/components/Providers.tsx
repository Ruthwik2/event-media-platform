'use client';
import { useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SocketProvider>
      {children}
    </SocketProvider>
  );
}

function SocketProvider({ children }: { children: React.ReactNode }) {
  useSocket();

  useEffect(() => {
    const applyTheme = (value: string) => {
      const root = document.documentElement;
      if (value === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.dataset.theme = prefersDark ? 'dark' : 'light';
      } else {
        root.dataset.theme = value;
      }
    };

    const storedTheme = localStorage.getItem('theme') || 'system';
    applyTheme(storedTheme);

    if (storedTheme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return <>{children}</>;
}
