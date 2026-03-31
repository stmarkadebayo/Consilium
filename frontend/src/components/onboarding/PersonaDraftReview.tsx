"use client";

import { PersonaDraft } from "@/lib/api";

type Props = {
  draft: PersonaDraft;
  onApprove: () => void;
  onReject: () => void;
};

export function PersonaDraftReview({ draft, onApprove, onReject }: Props) {
  const profile = draft.draft_profile;
  const name = String(profile.display_name || draft.input_name);
  const identity = String(profile.identity_summary || "");
  const beliefs = Array.isArray(profile.core_beliefs) ? profile.core_beliefs.slice(0, 3) : [];
  const tone = (profile.communication_style as any)?.tone || "Unknown";

  return (
    <div className="w-full max-w-2xl animate-fade-in bg-[var(--color-surface)] p-8 rounded-3xl border border-[var(--color-border-strong)]">
      <div className="flex justify-between items-start mb-6 border-b border-[var(--color-border-strong)] pb-6">
        <div>
          <h2 className="font-serif text-3xl italic text-white mb-2">{name}</h2>
          <div className="flex space-x-3 text-xs font-mono uppercase tracking-wider text-[var(--color-accent)]">
            <span>Identity Synthesized</span>
            <span>•</span>
            <span>Draft Ready</span>
          </div>
        </div>
      </div>

      <div className="space-y-6 mb-10">
        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">Identity Summary</h3>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{identity}</p>
        </div>

        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">Core Beliefs</h3>
          <ul className="space-y-2">
            {beliefs.map((belief, i) => (
              <li key={i} className="text-sm text-[var(--color-text-secondary)] flex items-start">
                <span className="text-[var(--color-accent)] mr-2 mt-0.5">✦</span>
                <span className="leading-tight">{String(belief)}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">Communication Tone</h3>
          <p className="text-sm text-white font-medium">{String(tone)}</p>
        </div>
      </div>

      <div className="flex space-x-4">
        <button
          onClick={onApprove}
          className="flex-1 bg-white text-black py-3 rounded-xl font-medium transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          Approve & Add to Council
        </button>
        <button
          onClick={onReject}
          className="flex-none px-6 py-3 rounded-xl bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:text-white transition-colors"
        >
          Discard
        </button>
      </div>
    </div>
  );
}
