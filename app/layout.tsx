import type { Metadata } from 'next';
import PlaybackToastHost from '@/components/player/PlaybackToastHost';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sonder — Your sound, all together',
  description: 'One home for the music you love.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<PlaybackToastHost /></body>
    </html>
  );
}
