'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import Navbar from '@/components/layout/Navbar';
import { motion, AnimatePresence } from 'framer-motion';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    // Also check localStorage directly — Zustand's async persist hydration can
    // resolve with a null token briefly even when the token is in localStorage,
    // causing a false redirect loop right after login.
    const localToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token && !localToken) {
      router.replace('/login');
      return;
    }
    // Unapproved club members can only see the pending-approval page
    if (user && user.role === 'CLUB_MEMBER' && user.isApproved === false) {
      router.replace('/pending-approval');
    }
  }, [hydrated, token, user, router]);

  // Show minimal spinner during hydration — avoids blank null flash
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[#080d14] flex items-center justify-center">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-primary-500"
              style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
        <style>{`
          @keyframes bounce {
            0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
            40% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
          className="max-w-7xl mx-auto px-4 sm:px-6 py-8"
        >
          {children}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}