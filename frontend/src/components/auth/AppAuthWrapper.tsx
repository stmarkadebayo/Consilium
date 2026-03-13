"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoaderCircle } from "lucide-react";
import { useSupabaseAuth } from "@/components/auth/SupabaseAuthProvider";

export default function AppAuthWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading, isConfigured } = useSupabaseAuth();

  useEffect(() => {
    if (!isLoading && isConfigured && !user) {
      router.replace("/auth");
    }
  }, [isConfigured, isLoading, router, user]);

  if (isLoading) {
    return (
      <main className="min-h-screen px-6 py-10 md:px-10 flex items-center justify-center bg-[var(--color-brand-primary)]">
        <div className="flex items-center gap-3 text-sm uppercase tracking-[0.25em] text-[var(--color-brand-text)]/70">
          <LoaderCircle className="h-4 w-4 animate-spin text-[var(--color-brand-accent)]" />
          Restoring your session...
        </div>
      </main>
    );
  }

  if (isConfigured && !user) {
    return null;
  }

  return <>{children}</>;
}
