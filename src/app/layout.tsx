import type { Metadata } from 'next';

import { Toaster } from "@/components/ui/toaster";
import { Header } from '@/components/layout/Header';
import { cn } from '@/lib/utils';
import { AuthProvider } from '@/components/auth/AuthProvider';
import Footer from '@/components/layout/Footer';
import './globals.css';
import GlobalCallUI from '@/components/chat/GlobalCallUI';
import PresenceWatcher from '@/components/presence/PresenceWatcher';

export const metadata: Metadata = {
  title: 'Manthan – Ignite Curiosity, Build Together',
  description: 'Manthan is a collaborative learning hub where students explore ideas, ask questions, share knowledge, and grow together.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
  <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#111827" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <link rel="alternate" type="application/rss+xml" title="Manthan RSS" href="/rss.xml" />
  <link rel="icon" href="/logo.svg?v=2" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Space+Grotesk:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={cn("min-h-screen bg-background font-body antialiased", "font-body")}>
        {/* Accessibility: Skip link */}
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 z-50 bg-primary text-primary-foreground px-3 py-2 rounded">Skip to content</a>
        <AuthProvider>
          <div className="relative flex min-h-screen flex-col">
            <Header />
            {/* Bottom mobile nav removed in favor of compact header with hamburger menu */}
            <main id="main" className="flex-1">{children}</main>
            <Footer />
            {/* Global full-screen incoming call UI */}
            <GlobalCallUI />
            {/* Presence heartbeat */}
            <PresenceWatcher />
          </div>
          <Toaster />
        </AuthProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                if (!('serviceWorker' in navigator)) return;
                const isProd = ${process.env.NODE_ENV === 'production' ? 'true' : 'false'};
                if (!isProd) {
                  // In dev, unregister any SW to avoid caching dev bundles
                  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
                  return;
                }
                // In prod, register and auto-activate updates
                window.addEventListener('load', () => {
                  const v = '4'; // bump to force re-fetch of sw.js when needed
                  navigator.serviceWorker.register('/sw.js?v=' + v).then(reg => {
                    if (reg.waiting) {
                      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                    }
                    reg.addEventListener('updatefound', () => {
                      const newSW = reg.installing;
                      if (!newSW) return;
                      newSW.addEventListener('statechange', () => {
                        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
                          newSW.postMessage({ type: 'SKIP_WAITING' });
                        }
                      });
                    });
                  }).catch(() => {});
                  navigator.serviceWorker.addEventListener('controllerchange', () => {
                    // Reload to pick up the fresh content and avoid hydration mismatch
                    window.location.reload();
                  });
                });
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}
