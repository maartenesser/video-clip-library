import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Video Clip Library',
  description: 'Manage and organize video clips',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <main id="main-content" className="flex-1" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
