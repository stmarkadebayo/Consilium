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
      {children}
    </AppAuthWrapper>
  );
}
