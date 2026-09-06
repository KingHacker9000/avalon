import type { Metadata, Viewport } from 'next';
import { PwaInstall } from '@/components/pwa-install';
import { SessionRescue } from '@/components/session-rescue';
import './globals.css';
import './ux-overhaul.css';
import './gameplay-ux.css';
import './pwa.css';
import './mobile-fluidity.css';
import './mobile-polish.css';
import './final-polish.css';
import './mobile-lobby-fix.css';

export const metadata: Metadata = {
  title: 'Avalon — The Round Table',
  description:
    'An illustrated, multiplayer game of hidden loyalties. Gather 5–10 friends, embark on quests, and decide the fate of Camelot.',
  applicationName: 'Avalon',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      {
        url: '/icons/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: 'Avalon',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#0b1719',
  colorScheme: 'dark',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SessionRescue />
        {children}
        <PwaInstall />
      </body>
    </html>
  );
}
