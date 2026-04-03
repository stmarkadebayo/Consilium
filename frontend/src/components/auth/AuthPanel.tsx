"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AuthPanel() {
  const { user, isLoading, error, login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      if (user.onboarding_done) {
        router.push("/app/chat");
      } else {
        router.push("/app/setup");
      }
    }
  }, [user, router]);

  if (isLoading) {
    return (
      <div className="flex w-full flex-col items-center justify-center p-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border-strong)] border-t-[var(--color-accent)]" />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center justify-center">
      <button
        onClick={login}
        className="group relative inline-flex items-center justify-center overflow-hidden rounded-[2rem] bg-white px-8 py-3 font-medium text-black transition-transform hover:scale-[1.03]"
      >
        <span className="relative z-10">Enter Council</span>
        <div className="absolute inset-0 bg-[var(--color-accent)] opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
      {error ? (
        <p className="mt-4 max-w-xs text-center text-xs text-[var(--color-error)]" aria-live="polite">
          {error}
        </p>
      ) : null}
      <p className="mt-4 text-xs text-[var(--color-text-tertiary)]" aria-live="polite">
        System Operational • Dev Mode Active
      </p>
    </div>
  );
}
