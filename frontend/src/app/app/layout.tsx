import Sidebar from "@/components/app/Sidebar";
import AppAuthWrapper from "@/components/auth/AppAuthWrapper";

export const metadata = {
  title: 'Consilium App',
  description: 'Your private council of AI advisors.',
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppAuthWrapper>
      <div className="flex h-screen w-full bg-[var(--color-brand-primary)] overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto relative z-0 md:pt-0 pt-16">
          {children}
        </main>
      </div>
    </AppAuthWrapper>
  );
}
