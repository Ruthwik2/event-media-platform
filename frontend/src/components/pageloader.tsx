'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Thin top-of-page progress bar that fires on every route change.
 * No external dependencies — uses only Next.js built-in hooks.
 *
 * How it works:
 *  1. A mousedown listener on <a> tags starts the indeterminate animation.
 *  2. When usePathname/useSearchParams actually change (new page mounted),
 *     we mark the bar as "complete" → it fills to 100% then fades out.
 */
export default function PageLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start bar when any internal link is pressed
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      // Only fire for internal same-origin links
      if (
        href &&
        !href.startsWith('http') &&
        !href.startsWith('mailto') &&
        !href.startsWith('#')
      ) {
        setState('loading');
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // Complete bar when new route has rendered
  useEffect(() => {
    if (state === 'loading') {
      setState('done');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setState('idle'), 600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Cleanup on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (state === 'idle') return null;

  return (
    <>
      <style>{`
        @keyframes loader-indeterminate {
          0%   { left: -40%; width: 40%; }
          50%  { left: 20%;  width: 60%; }
          100% { left: 100%; width: 40%; }
        }
        @keyframes loader-complete {
          0%   { width: var(--start-w, 60%); opacity: 1; }
          100% { width: 100%; opacity: 1; }
        }
        @keyframes loader-fade {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
        .page-loader-bar {
          position: fixed;
          top: 0;
          left: 0;
          height: 3px;
          z-index: 9999;
          background: linear-gradient(90deg, #38bdf8, #818cf8);
          box-shadow: 0 0 8px #38bdf8aa;
          border-radius: 0 2px 2px 0;
          pointer-events: none;
        }
        .page-loader-bar.loading {
          animation: loader-indeterminate 1.2s ease-in-out infinite;
        }
        .page-loader-bar.done {
          left: 0 !important;
          animation:
            loader-complete 0.25s ease-out forwards,
            loader-fade 0.3s ease-in 0.25s forwards;
        }
      `}</style>
      <div className={`page-loader-bar ${state}`} />
    </>
  );
}
