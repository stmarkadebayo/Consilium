"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, Trash2, X } from "lucide-react";
import { api, Persona } from "@/lib/api";
import { COUNCIL_REFRESH_EVENT, useCouncil } from "@/hooks/useCouncil";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function CouncilManager() {
  const { council, isLoading, error, fetchCouncil, updateMember } = useCouncil();
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [isLoadingPersona, setIsLoadingPersona] = useState(false);
  const [isDeletingPersona, setIsDeletingPersona] = useState(false);
  const [personaError, setPersonaError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ personaId: string; displayName: string; memberId: string } | null>(null);

  useEffect(() => {
    fetchCouncil();
  }, [fetchCouncil]);

  const orderedMembers = useMemo(() => council?.members ?? [], [council?.members]);
  const selectedMember = orderedMembers.find((member) => member.id === expandedMemberId) ?? null;
  const displayedPersona = selectedPersona?.id === selectedMember?.persona_id ? selectedPersona : null;
  const activeCount = orderedMembers.filter((member) => member.is_active).length;

  useEffect(() => {
    const personaId = selectedMember?.persona_id;
    if (!personaId) return;

    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      setIsLoadingPersona(true);
      setPersonaError(null);

      try {
        const persona = await api.getPersona(personaId);
        if (!cancelled) {
          setSelectedPersona(persona);
        }
      } catch (fetchError: unknown) {
        if (!cancelled) {
          setSelectedPersona(null);
          setPersonaError(getErrorMessage(fetchError, "Failed to load advisor details."));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPersona(false);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedMember?.persona_id]);

  const moveMember = async (memberId: string, currentPosition: number, direction: -1 | 1) => {
    const targetPosition = currentPosition + direction;
    if (targetPosition < 0 || targetPosition >= orderedMembers.length) return;
    await updateMember(memberId, { position: targetPosition });
  };

  const confirmDeleteMember = async () => {
    if (!pendingDelete) return;
    const deleteTarget = pendingDelete;
    setIsDeletingPersona(true);
    setPersonaError(null);
    try {
      await api.deletePersona(deleteTarget.personaId);
      setPendingDelete(null);
      if (expandedMemberId === deleteTarget.memberId) {
        setExpandedMemberId(null);
        setSelectedPersona(null);
      }
      await fetchCouncil();
      window.dispatchEvent(new Event(COUNCIL_REFRESH_EVENT));
    } catch (deleteError: unknown) {
      setPersonaError(getErrorMessage(deleteError, "Failed to delete advisor."));
    } finally {
      setIsDeletingPersona(false);
    }
  };

  return (
    <section className="w-full max-w-3xl space-y-5 text-center">
      {orderedMembers.length > 0 ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {orderedMembers.length} advisors total · {activeCount} active
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="text-xs text-red-300/90">{error}</p>
      ) : null}

      <div className="mx-auto w-full max-w-2xl space-y-3">
        {orderedMembers.length === 0 ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-black/20 px-5 py-5">
            <p className="text-sm text-[var(--color-text-secondary)]">No advisors yet.</p>
          </div>
        ) : (
          orderedMembers.map((member) => {
            const isExpanded = expandedMemberId === member.id;
            const memberPersona = isExpanded ? displayedPersona : null;

            return (
              <div key={member.id} className="rounded-xl border border-[var(--color-border)] bg-black/20">
                <button
                  type="button"
                  onClick={() => {
                    setExpandedMemberId((current) => (current === member.id ? null : member.id));
                    setPersonaError(null);
                  }}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-center"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{member.display_name}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                      Slot {member.position + 1} · {member.persona_type.replace("_", " ")}
                    </p>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-[var(--color-text-tertiary)] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  />
                </button>

                {isExpanded ? (
                  <div className="space-y-4 border-t border-[var(--color-border)] px-4 py-4 text-center text-sm text-[var(--color-text-secondary)]">
                    {personaError ? (
                      <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-red-300">{personaError}</p>
                    ) : null}

                    {isLoadingPersona ? (
                      <p>Loading advisor details...</p>
                    ) : (
                      <>
                        <div>
                          <p className="mb-1 text-xs font-mono uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Identity</p>
                          <p>{memberPersona?.identity_summary || member.identity_summary || "No summary available."}</p>
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-mono uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Tone</p>
                          <p className="text-white">{memberPersona?.communication_style.tone || "Unknown"}</p>
                        </div>
                        {memberPersona ? (
                          <div>
                            <p className="mb-1 text-xs font-mono uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Core Beliefs</p>
                            <ul className="space-y-1">
                              {memberPersona.core_beliefs.slice(0, 3).map((belief) => (
                                <li key={belief}>{belief}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </>
                    )}

                    <div className="flex flex-wrap justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveMember(member.id, member.position, -1)}
                        disabled={member.position === 0}
                        className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border-strong)] px-3 py-2 text-xs text-white transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ArrowUp className="h-4 w-4" />
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => moveMember(member.id, member.position, 1)}
                        disabled={member.position === orderedMembers.length - 1}
                        className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border-strong)] px-3 py-2 text-xs text-white transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ArrowDown className="h-4 w-4" />
                        Down
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingDelete({
                            personaId: member.persona_id,
                            displayName: member.display_name,
                            memberId: member.id,
                          })
                        }
                        disabled={isDeletingPersona}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 px-3 py-2 text-xs text-red-300 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {isLoading ? <p className="text-xs text-[var(--color-text-tertiary)]">Refreshing council...</p> : null}

      {pendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,8,12,0.72)] p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.36)]">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 text-red-300">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">Delete advisor</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">This action cannot be undone.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="rounded-full p-1 text-[var(--color-text-tertiary)] transition-colors hover:bg-white/5 hover:text-white"
                aria-label="Close delete confirmation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-6 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              Remove <span className="font-medium text-white">{pendingDelete.displayName}</span> from the council?
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={isDeletingPersona}
                className="flex-1 rounded-xl border border-[var(--color-border-strong)] px-4 py-3 text-sm text-white transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteMember}
                disabled={isDeletingPersona}
                className="flex-1 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeletingPersona ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
