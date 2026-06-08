'use client';
import { Suspense, useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import PageLoader from '@/components/PageLoader';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SocketProvider>
      {/* Suspense required because PageLoader uses useSearchParams (App Router) */}
      <Suspense fallback={null}>
        <PageLoader />
      </Suspense>
      {children}
    </SocketProvider>
  );
}

function SocketProvider({ children }: { children: React.ReactNode }) {
  useSocket();

  useEffect(() => {
    // The app is light-only. Pin the theme and clear any stale 'dark'/'system'
    // preference a user may have saved before the dark-mode option was removed.
    document.documentElement.dataset.theme = 'light';
    localStorage.removeItem('theme');
  }, []);

  return <>{children}</>;
}
