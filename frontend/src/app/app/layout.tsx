import AppAuthWrapper from "@/components/auth/AppAuthWrapper";
import AppSidebar from "@/components/app/AppSidebar";

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
      <div className="flex h-screen w-full bg-[var(--color-brand-primary)] text-[var(--color-brand-text)] overflow-hidden">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {children}
        </main>
      </div>
    </AppAuthWrapper>
  );
}
