import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import MobileKeyboardDismiss from '@/components/layout/MobileKeyboardDismiss';

export const metadata: Metadata = {
  title: 'Potatoes - Recipe Collection',
  description: 'Your personal recipe collection app',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Potatoes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-cream text-charcoal">
        <MobileKeyboardDismiss />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
