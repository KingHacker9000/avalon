import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Avalon — The Round Table',
  description:
    'An illustrated, multiplayer game of hidden loyalties. Gather 5–10 friends, embark on quests, and decide the fate of Camelot.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
