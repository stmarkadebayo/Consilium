"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { PersonaDraft, PersonaDraftRevision, PersonaProfile } from "@/lib/api";

type Props = {
  draft: PersonaDraft;
  revisions: PersonaDraftRevision[];
  onRevise: (instruction: string) => void | Promise<void>;
  onUpdateDraft: (draftProfile: PersonaProfile) => void | Promise<void>;
  onRestoreRevision: (revisionId: string) => void | Promise<void>;
  isRevising: boolean;
  isSavingDraft: boolean;
  isLoadingHistory: boolean;
  isRestoringRevision: boolean;
  error: string | null;
  onApprove: () => void;
  onReject: () => void;
};

type EditableProfile = {
  display_name: string;
  identity_summary: string;
  core_beliefs: string;
  priorities: string;
  tone: string;
};

function listToText(value: string[] | undefined) {
  return (value ?? []).join("\n");
}

function textToList(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildEditableProfile(profile: PersonaProfile): EditableProfile {
  return {
    display_name: String(profile.display_name ?? ""),
    identity_summary: String(profile.identity_summary ?? ""),
    core_beliefs: listToText(profile.core_beliefs),
    priorities: listToText(profile.priorities),
    tone: String(profile.communication_style?.tone ?? ""),
  };
}

function toDraftProfile(baseProfile: PersonaProfile, editable: EditableProfile): PersonaProfile {
  return {
    ...baseProfile,
    display_name: editable.display_name.trim(),
    identity_summary: editable.identity_summary.trim(),
    core_beliefs: textToList(editable.core_beliefs),
    priorities: textToList(editable.priorities),
    communication_style: {
      ...(baseProfile.communication_style ?? {}),
      tone: editable.tone.trim(),
    },
  };
}

function getRevisionLabel(kind: string) {
  switch (kind) {
    case "initial":
      return "Initial Draft";
    case "ai":
      return "AI Revision";
    case "manual":
      return "Manual Edit";
    case "restore":
      return "Restore";
    default:
      return kind;
  }
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function PersonaDraftReview({
  draft,
  revisions,
  onRevise,
  onUpdateDraft,
  onRestoreRevision,
  isRevising,
  isSavingDraft,
  isLoadingHistory,
  isRestoringRevision,
  error,
  onApprove,
  onReject,
}: Props) {
  const [revisionInstruction, setRevisionInstruction] = useState("");
  const [editableProfile, setEditableProfile] = useState<EditableProfile>(() => buildEditableProfile(draft.draft_profile));

  useEffect(() => {
    setEditableProfile(buildEditableProfile(draft.draft_profile));
  }, [draft]);

  const profile = draft.draft_profile;
  const history = useMemo(() => [...revisions].reverse(), [revisions]);

  const handleRevise = async () => {
    const instruction = revisionInstruction.trim();
    if (!instruction) return;
    await onRevise(instruction);
    setRevisionInstruction("");
  };

  const handleSaveManualEdits = async () => {
    await onUpdateDraft(toDraftProfile(profile, editableProfile));
  };

  return (
    <div className="w-full max-w-3xl animate-fade-in space-y-5">
      <div>
        <p className="mb-2 text-xs font-mono uppercase tracking-[0.22em] text-[var(--color-accent)]">
          Draft Review
        </p>
        <h2 className="font-serif text-3xl italic text-white">
          {editableProfile.display_name || draft.input_name}
        </h2>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <button
          onClick={onApprove}
          disabled={isRevising || isSavingDraft || isRestoringRevision}
          className="rounded-xl bg-white px-5 py-3 font-medium text-black transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Approve & Add
        </button>
        <button
          type="button"
          onClick={handleSaveManualEdits}
          disabled={isSavingDraft || isRevising || isRestoringRevision}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border-strong)] px-4 py-3 text-sm text-white transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {isSavingDraft ? "Saving..." : "Save"}
        </button>
        <button
          onClick={onReject}
          disabled={isRevising || isSavingDraft || isRestoringRevision}
          className="rounded-xl border border-[var(--color-border-strong)] px-4 py-3 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Discard
        </button>
      </div>

      <details open className="rounded-xl border border-[var(--color-border)] bg-black/20 px-4 py-3">
        <summary className="cursor-pointer list-none text-sm font-medium text-white">
          Edit draft
        </summary>
        <div className="mt-4 grid gap-4">
          <div>
            <label className="mb-2 block text-xs font-mono uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              Display Name
            </label>
            <input
              value={editableProfile.display_name}
              onChange={(event) => setEditableProfile((current) => ({ ...current, display_name: event.target.value }))}
              className="w-full rounded-xl border border-[var(--color-border-strong)] bg-black/30 px-4 py-3 text-white outline-none transition-colors focus:border-[var(--color-accent)]"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-mono uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              Identity Summary
            </label>
            <textarea
              value={editableProfile.identity_summary}
              onChange={(event) => setEditableProfile((current) => ({ ...current, identity_summary: event.target.value }))}
              className="min-h-[120px] w-full resize-none rounded-xl border border-[var(--color-border-strong)] bg-black/30 px-4 py-3 text-white outline-none transition-colors focus:border-[var(--color-accent)]"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-mono uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                Core Beliefs
              </label>
              <textarea
                value={editableProfile.core_beliefs}
                onChange={(event) => setEditableProfile((current) => ({ ...current, core_beliefs: event.target.value }))}
                className="min-h-[140px] w-full resize-none rounded-xl border border-[var(--color-border-strong)] bg-black/30 px-4 py-3 text-white outline-none transition-colors focus:border-[var(--color-accent)]"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-mono uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                Priorities
              </label>
              <textarea
                value={editableProfile.priorities}
                onChange={(event) => setEditableProfile((current) => ({ ...current, priorities: event.target.value }))}
                className="min-h-[140px] w-full resize-none rounded-xl border border-[var(--color-border-strong)] bg-black/30 px-4 py-3 text-white outline-none transition-colors focus:border-[var(--color-accent)]"
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-mono uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              Tone
            </label>
            <input
              value={editableProfile.tone}
              onChange={(event) => setEditableProfile((current) => ({ ...current, tone: event.target.value }))}
              className="w-full rounded-xl border border-[var(--color-border-strong)] bg-black/30 px-4 py-3 text-white outline-none transition-colors focus:border-[var(--color-accent)]"
            />
          </div>
        </div>
      </details>

      <details className="rounded-xl border border-[var(--color-border)] bg-black/20 px-4 py-3">
        <summary className="cursor-pointer list-none text-sm font-medium text-white">
          Refine with AI
        </summary>
        <div className="mt-4 space-y-3">
          <textarea
            value={revisionInstruction}
            onChange={(event) => setRevisionInstruction(event.target.value)}
            placeholder="e.g. Make the worldview sharper and reduce generic language."
            className="min-h-[110px] w-full resize-none rounded-xl border border-[var(--color-border-strong)] bg-black/30 px-4 py-3 text-white placeholder-[var(--color-text-tertiary)] outline-none transition-colors focus:border-[var(--color-accent)]"
          />
          <button
            type="button"
            onClick={handleRevise}
            disabled={isRevising || isSavingDraft || !revisionInstruction.trim()}
            className="rounded-xl border border-[var(--color-border-strong)] px-4 py-2 text-sm text-white transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRevising ? "Revising..." : "Run AI Revision"}
          </button>
        </div>
      </details>

      <details className="rounded-xl border border-[var(--color-border)] bg-black/20 px-4 py-3">
        <summary className="cursor-pointer list-none text-sm font-medium text-white">
          Revision history
        </summary>
        <div className="mt-4 space-y-3">
          {isLoadingHistory ? (
            <p className="text-sm text-[var(--color-text-secondary)]">Loading revision history...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)]">No revisions recorded yet.</p>
          ) : (
            history.map((revision, index) => {
              const isLatest = index === 0;
              return (
                <div key={revision.id} className="flex flex-col gap-2 rounded-xl border border-[var(--color-border)] px-3 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-white">{getRevisionLabel(revision.revision_kind)}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">{formatTimestamp(revision.created_at)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRestoreRevision(revision.id)}
                      disabled={isLatest || isRestoringRevision || isSavingDraft || isRevising}
                      className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border-strong)] px-3 py-2 text-xs text-white transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Restore
                    </button>
                  </div>
                  <p className="text-[var(--color-text-secondary)]">{revision.instruction || "No instruction recorded."}</p>
                </div>
              );
            })
          )}
        </div>
      </details>
    </div>
  );
}
