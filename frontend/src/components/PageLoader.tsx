'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function PageLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
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

  useEffect(() => {
    if (state === 'loading') {
      setState('done');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setState('idle'), 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (state === 'idle') return null;

  return (
    <>
      <style>{`
        @keyframes loader-indeterminate {
          0%   { left: -40%; width: 40%; }
          50%  { left: 20%;  width: 60%; }
          100% { left: 110%; width: 40%; }
        }
        @keyframes loader-complete {
          0%   { width: 75%; opacity: 1; }
          100% { width: 100%; opacity: 1; }
        }
        @keyframes loader-fade {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
        .page-loader-track {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          z-index: 10000;
          pointer-events: none;
          overflow: hidden;
        }
        .page-loader-bar {
          position: absolute;
          top: 0;
          height: 100%;
          background: linear-gradient(90deg, #16706b, #16706b, #3f9e97);
          border-radius: 0 2px 2px 0;
        }
        .page-loader-bar.loading {
          animation: loader-indeterminate 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        .page-loader-bar.done {
          left: 0 !important;
          animation:
            loader-complete 0.2s ease-out forwards,
            loader-fade 0.25s ease-in 0.2s forwards;
        }
        .page-loader-glow {
          position: absolute;
          top: 0;
          right: 0;
          width: 60px;
          height: 2px;
          background: radial-gradient(ellipse at right, rgba(56,189,248,0.8), transparent);
          filter: blur(3px);
        }
      `}</style>
      <div className="page-loader-track">
        <div className={`page-loader-bar ${state}`} />
        <div className="page-loader-glow" />
      </div>
    </>
  );
}
