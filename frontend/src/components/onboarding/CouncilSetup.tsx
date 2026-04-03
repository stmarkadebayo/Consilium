"use client";

import { useEffect, useState } from "react";
import { usePersonaPipeline } from "@/hooks/usePersonaPipeline";
import { COUNCIL_REFRESH_EVENT, useCouncil } from "@/hooks/useCouncil";
import { PersonaDraft } from "@/lib/api";
import { PersonaDraftReview } from "./PersonaDraftReview";

type Step = "input" | "generating" | "review";

export function CouncilSetup({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>("input");
  const [inputName, setInputName] = useState("");
  const [customBrief, setCustomBrief] = useState("");
  const {
    generateDraft,
    reviseDraft,
    updateDraft,
    fetchRevisions,
    restoreRevision,
    approveDraft,
    isGenerating,
    isRevising,
    isSavingDraft,
    isRestoringRevision,
    isLoadingHistory,
    revisions,
    error,
    setError,
  } = usePersonaPipeline();
  const { council, fetchCouncil } = useCouncil();
  const [draft, setDraft] = useState<PersonaDraft | null>(null);

  const memberCount = council?.members?.length || 0;

  useEffect(() => {
    fetchCouncil();
  }, [fetchCouncil]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputName.trim()) return;

    setStep("generating");
    const newDraft = await generateDraft(inputName, "real_person", customBrief);
    
    if (newDraft && newDraft.review_status === "ready") {
      setDraft(newDraft);
      await fetchRevisions(newDraft.id);
      setStep("review");
    } else {
      setStep("input"); // Go back on error
    }
  };

  const handleApprove = async () => {
    if (!draft) return;
    const res = await approveDraft(draft.id);
    if (res) {
      await fetchCouncil();
      window.dispatchEvent(new Event(COUNCIL_REFRESH_EVENT));
      setInputName("");
      setCustomBrief("");
      setDraft(null);
      setStep("input");
      onComplete();
    }
  };

  const handleRevise = async (instruction: string) => {
    if (!draft) return;
    const revisedDraft = await reviseDraft(draft.id, instruction);
    if (revisedDraft) {
      setDraft(revisedDraft);
    }
  };

  const handleManualUpdate = async (draftProfile: Record<string, unknown>) => {
    if (!draft) return;
    const updatedDraft = await updateDraft(draft.id, draftProfile);
    if (updatedDraft) {
      setDraft(updatedDraft);
    }
  };

  const handleRestoreRevision = async (revisionId: string) => {
    if (!draft) return;
    const restoredDraft = await restoreRevision(draft.id, revisionId);
    if (restoredDraft) {
      setDraft(restoredDraft);
    }
  };

  if (step === "generating" || isGenerating) {
    return (
      <div className="flex w-full max-w-lg flex-col items-center justify-center p-8 space-y-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border-strong)] border-t-[var(--color-accent)]" />
        <p className="font-mono text-sm text-[var(--color-accent)]">Synthesizing Advisor...</p>
        <p className="text-xs text-[var(--color-text-tertiary)] max-w-xs text-center">
          Ingesting evidence, mapping worldview, analyzing communication patterns...
        </p>
      </div>
    );
  }

  if (step === "review" && draft) {
    return (
      <PersonaDraftReview
        draft={draft}
        onRevise={handleRevise}
        onUpdateDraft={handleManualUpdate}
        onRestoreRevision={handleRestoreRevision}
        isRevising={isRevising}
        isSavingDraft={isSavingDraft}
        isLoadingHistory={isLoadingHistory}
        isRestoringRevision={isRestoringRevision}
        revisions={revisions}
        error={error}
        onApprove={handleApprove}
        onReject={() => { setDraft(null); setStep("input"); }}
      />
    );
  }

  const promptTitle = memberCount === 0 ? "Who is your first advisor?" : `Who is advisor #${memberCount + 1}?`;

  return (
    <div className="mx-auto w-full max-w-3xl animate-fade-in text-center">
      <div className="mb-6">
        <h2 className="font-serif text-3xl italic mb-3 text-white">{promptTitle}</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Provide a widely known public figure. We&apos;ll build their reasoning engine.
        </p>
      </div>

      <form onSubmit={handleGenerate} className="mx-auto flex w-full max-w-2xl flex-col space-y-4 text-center">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col space-y-2">
          <label htmlFor="name" className="text-center text-xs font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">
            Advisor Name
          </label>
          <input
            id="name"
            type="text"
            value={inputName}
            onChange={(e) => {
              setInputName(e.target.value);
              setError(null);
            }}
            placeholder="e.g. Marcus Aurelius, Naval Ravikant..."
            className="w-full rounded-xl border border-[var(--color-border-strong)] bg-black/50 px-4 py-3 text-center text-white placeholder-[var(--color-text-tertiary)] outline-none transition-colors focus:border-[var(--color-accent)] focus:bg-[var(--color-surface)]"
            required
            autoFocus
          />
        </div>

        <div className="flex flex-col space-y-2">
          <label htmlFor="brief" className="text-center text-xs font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">
            Custom Framing (Optional)
          </label>
          <textarea
            id="brief"
            value={customBrief}
            onChange={(e) => setCustomBrief(e.target.value)}
            placeholder="e.g. Focus exclusively on their writings about discipline and military strategy..."
            className="w-full min-h-[100px] resize-none rounded-xl border border-[var(--color-border-strong)] bg-black/50 px-4 py-3 text-center text-white placeholder-[var(--color-text-tertiary)] outline-none transition-colors focus:border-[var(--color-accent)]"
          />
        </div>

        <button
          type="submit"
          disabled={!inputName.trim() || isGenerating}
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[var(--color-accent)] px-6 py-4 font-medium text-black transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
        >
          Initialize Persona Pipeline
        </button>
      </form>
    </div>
  );
}
