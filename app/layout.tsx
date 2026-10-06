import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const font = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'AM Preset Player',
  description: 'Putar preset Alight Motion, ganti media, lalu ekspor menjadi video.'
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={font.className}>{children}</body>
    </html>
  );
}
