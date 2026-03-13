"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoaderCircle } from "lucide-react";

import WorkspacePage from "@/components/app/WorkspacePage";
import { useSupabaseAuth } from "@/components/auth/SupabaseAuthProvider";

export default function ProtectedWorkspace() {
  const router = useRouter();
  const { user, isLoading, isConfigured } = useSupabaseAuth();

  useEffect(() => {
    if (!isLoading && isConfigured && !user) {
      router.replace("/auth");
    }
  }, [isConfigured, isLoading, router, user]);

  if (isLoading) {
    return (
      <main className="min-h-screen px-6 py-10 md:px-10">
        <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center rounded-[2rem] border border-white/10 bg-white/3">
          <div className="flex items-center gap-3 text-sm uppercase tracking-[0.25em] text-white/70">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Restoring your session...
          </div>
        </div>
      </main>
    );
  }

  if (isConfigured && !user) {
    return null;
  }

  return <WorkspacePage />;
}
