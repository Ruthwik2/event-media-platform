import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import Providers from '@/components/Providers';

export const metadata: Metadata = {
  title: 'EventMedia — Club & Event Media Platform',
  description: 'Centralized platform for managing club and event photos & videos',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#16706b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen antialiased">
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#ffffff',
                color: '#2a2724',
                border: '1px solid #e7e3dd',
                borderRadius: '12px',
                fontSize: '13px',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: '500',
                boxShadow: '0 8px 28px rgba(42,39,36,0.12)',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
