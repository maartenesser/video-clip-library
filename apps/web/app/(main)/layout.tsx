import { NavHeader } from '@/components/nav-header';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <NavHeader />
      {children}
    </>
  );
}
