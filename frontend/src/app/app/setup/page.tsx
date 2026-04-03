"use client";

import { Plus } from "lucide-react";
import { CouncilManager } from "@/components/onboarding/CouncilManager";
import { CouncilSetup } from "@/components/onboarding/CouncilSetup";
import { useCouncil } from "@/hooks/useCouncil";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function SetupPage() {
  const router = useRouter();
  const [isAddingAdvisor, setIsAddingAdvisor] = useState(false);
  const { council, fetchCouncil } = useCouncil();

  useEffect(() => {
    fetchCouncil();
  }, [fetchCouncil]);

  const activeCount = useMemo(
    () => (council?.members ?? []).filter((member) => member.is_active).length,
    [council?.members]
  );
  const canEnterCouncil = activeCount >= 3;

  return (
    <main className="min-h-screen bg-[var(--color-primary)] p-6">
      <div className="absolute inset-0 opacity-[0.02] mix-blend-soft-light pointer-events-none" 
           style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />
      
      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center gap-6 text-center">
        <div className="w-full">
          <p className="mb-2 text-xs font-mono uppercase tracking-[0.22em] text-[var(--color-accent)]">
            Setup
          </p>
          <h1 className="font-serif text-4xl italic text-white">Build the council quietly</h1>
        </div>

        <CouncilManager />

        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => setIsAddingAdvisor((current) => !current)}
            className="inline-flex items-center gap-3 rounded-full border border-[var(--color-border-strong)] bg-black/30 px-4 py-3 text-sm text-white transition-colors hover:bg-white/5"
            aria-label={isAddingAdvisor ? "Close add advisor" : "Add advisor"}
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-black/40">
              <Plus className={`h-4 w-4 transition-transform ${isAddingAdvisor ? "rotate-45" : ""}`} />
            </span>
            <span>{isAddingAdvisor ? "Close advisor form" : "Add advisor"}</span>
          </button>

          {isAddingAdvisor ? (
            <div className="w-full">
              <CouncilSetup
                onComplete={() => {
                  setIsAddingAdvisor(false);
                }}
              />
            </div>
          ) : null}
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={() => {
              if (canEnterCouncil) {
                router.push("/app/chat");
              }
            }}
            disabled={!canEnterCouncil}
            className="rounded-xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-black transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100"
          >
            Enter Council
          </button>
          {!canEnterCouncil ? (
            <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">
              Activate at least 3 advisors to enter the council.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
