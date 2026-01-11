import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { NavHeader } from '@/components/nav-header';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Video Clip Library',
  description: 'Manage and organize video clips',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="relative flex min-h-screen flex-col">
          <NavHeader />
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
