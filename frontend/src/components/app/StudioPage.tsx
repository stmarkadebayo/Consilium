"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LoaderCircle,
  LogOut,
  MessageSquareText,
  Plus,
  Sparkles,
  UserRoundPlus,
} from "lucide-react";

import {
  api,
  pollJobUntilSettled,
  type Conversation,
  type Council,
  type Persona,
  type PersonaDraft,
  type User,
} from "@/lib/api";
import { isSupabaseConfigured, signOutSupabase } from "@/lib/supabase";

type PersonaBuilderState = {
  personaType: "real_person" | "custom";
  inputName: string;
  customBrief: string;
};

const INITIAL_BUILDER_STATE: PersonaBuilderState = {
  personaType: "real_person",
  inputName: "",
  customBrief: "",
};

const SAMPLE_PROMPTS = [
  "Should I raise a seed round now, or stay profitable for another six months?",
  "How should I sequence product, distribution, and pricing over the next 90 days?",
  "What is the highest-leverage experiment I should run before committing more capital?",
];

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function StudioPage() {
  const [user, setUser] = useState<User | null>(null);
  const [council, setCouncil] = useState<Council | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [builder, setBuilder] = useState<PersonaBuilderState>(INITIAL_BUILDER_STATE);
  const [draft, setDraft] = useState<PersonaDraft | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isBooting, setIsBooting] = useState(true);
  const [isProfiling, setIsProfiling] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshCouncilAndPersonas = useCallback(async () => {
    const [nextCouncil, nextPersonas] = await Promise.all([api.getCouncil(), api.listPersonas()]);
    setCouncil(nextCouncil);
    setPersonas(nextPersonas);
    return { nextCouncil, nextPersonas };
  }, []);

  const loadLatestConversation = useCallback(async () => {
    const summaries = await api.listConversations();
    const latest = summaries[0];
    if (!latest) {
      setConversation(null);
      return null;
    }
    const nextConversation = await api.getConversation(latest.id);
    setConversation(nextConversation);
    return nextConversation;
  }, []);

  const loadApp = useCallback(async () => {
    setIsBooting(true);
    setErrorMessage(null);
    try {
      const nextUser = await api.getMe();
      setUser(nextUser);
      const { nextCouncil } = await refreshCouncilAndPersonas();
      const activeCount = nextCouncil.members.filter((member) => member.is_active).length;
      if (activeCount >= nextCouncil.min_personas) {
        await loadLatestConversation();
      } else {
        setConversation(null);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load the app.");
    } finally {
      setIsBooting(false);
    }
  }, [loadLatestConversation, refreshCouncilAndPersonas]);

  useEffect(() => {
    void loadApp();
  }, [loadApp]);

  const activePersonaIds = useMemo(
    () => new Set((council?.members ?? []).filter((member) => member.is_active).map((member) => member.persona_id)),
    [council],
  );
  const activePersonas = useMemo(
    () => personas.filter((persona) => activePersonaIds.has(persona.id) && persona.status === "active"),
    [activePersonaIds, personas],
  );
  const activePersonaCount = activePersonas.length;
  const minimumPersonas = council?.min_personas ?? 2;
  const maximumPersonas = council?.max_personas ?? 5;
  const readyToChat = activePersonaCount >= minimumPersonas;
  const canCreateMore = activePersonaCount < maximumPersonas;
  const personasStillNeeded = Math.max(minimumPersonas - activePersonaCount, 0);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.turns]);

  const handleBuilderChange = (field: keyof PersonaBuilderState, value: string) => {
    setBuilder((current) => ({ ...current, [field]: value }));
  };

  const handleProfilePersona = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!builder.inputName.trim() || isProfiling || !canCreateMore) {
      return;
    }

    setIsProfiling(true);
    setErrorMessage(null);
    setStatusMessage("Profiling persona...");
    setDraft(null);

    try {
      const createdDraft = await api.createPersonaDraft({
        input_name: builder.inputName.trim(),
        persona_type: builder.personaType,
        custom_brief: builder.customBrief.trim() || undefined,
      });

      let resolvedDraft = createdDraft;
      if (createdDraft.review_status === "generating" && createdDraft.job_id) {
        const job = await pollJobUntilSettled(createdDraft.job_id, 45000);
        resolvedDraft = await api.getPersonaDraft(createdDraft.id);
        if (job.status === "failed") {
          throw new Error(job.error_message || "Profiling failed");
        }
      }

      setDraft(resolvedDraft);
      setStatusMessage("Persona profile ready. Review and approve it.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to build the persona profile.");
      setStatusMessage(null);
    } finally {
      setIsProfiling(false);
    }
  };

  const handleApproveDraft = async () => {
    if (!draft || isApproving) {
      return;
    }

    setIsApproving(true);
    setErrorMessage(null);
    setStatusMessage("Adding persona to the council...");

    try {
      await api.approvePersonaDraft(draft.id);
      const { nextCouncil } = await refreshCouncilAndPersonas();
      setDraft(null);
      setBuilder(INITIAL_BUILDER_STATE);

      const nextActiveCount = nextCouncil.members.filter((member) => member.is_active).length;
      if (nextActiveCount >= nextCouncil.min_personas) {
        await loadLatestConversation();
        setStatusMessage("Council ready. Ask the first question.");
      } else {
        setStatusMessage("Persona added. Create the next one.");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to approve persona.");
      setStatusMessage(null);
    } finally {
      setIsApproving(false);
    }
  };

  const handleStartFreshConversation = () => {
    setConversation(null);
    setPrompt("");
    setStatusMessage("Fresh conversation ready.");
    setErrorMessage(null);
  };

  const handleSendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!readyToChat || !prompt.trim() || isSending) {
      return;
    }

    setIsSending(true);
    setErrorMessage(null);
    setStatusMessage("All personas are thinking...");

    try {
      let conversationId = conversation?.id;
      if (!conversationId) {
        const createdConversation = await api.createConversation(
          prompt.length > 54 ? `${prompt.slice(0, 54)}...` : prompt,
        );
        conversationId = createdConversation.id;
      }

      const submission = await api.submitMessage(conversationId, prompt.trim());
      await pollJobUntilSettled(submission.job_id, 45000);
      const nextConversation = await api.getConversation(conversationId);
      setConversation(nextConversation);
      setPrompt("");
      setStatusMessage("Council response complete.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to run the council query.");
      setStatusMessage(null);
    } finally {
      setIsSending(false);
    }
  };

  const handleSignOut = async () => {
    if (!isSupabaseConfigured()) {
      return;
    }
    setIsSigningOut(true);
    try {
      await signOutSupabase();
      window.location.href = "/";
    } finally {
      setIsSigningOut(false);
    }
  };

  if (isBooting) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--color-brand-primary)]">
        <div className="flex items-center gap-3 text-sm uppercase tracking-[0.24em] text-[var(--color-brand-text)]/65">
          <LoaderCircle className="h-4 w-4 animate-spin text-[var(--color-brand-accent)]" />
          Loading council...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-brand-primary)] text-[var(--color-brand-text)]">
      <div className="grid min-h-screen lg:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="border-r border-[var(--color-brand-text)]/8 bg-[color-mix(in_srgb,var(--color-brand-surface)_72%,var(--color-brand-primary))] px-6 py-6">
          <div className="flex h-full flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-mono uppercase tracking-[0.24em] text-[var(--color-brand-accent)]">
                  Consilium
                </p>
                <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight">
                  {readyToChat ? "Council chat" : "Create personas"}
                </h1>
                <p className="mt-2 text-sm leading-6 text-[var(--color-brand-text)]/62">
                  {readyToChat
                    ? "Your personas are ready. New prompts go to all active advisors at once."
                    : `Build ${minimumPersonas} personas minimum before the chat unlocks.`}
                </p>
              </div>
              {isSupabaseConfigured() && (
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  disabled={isSigningOut}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-primary)]/40 text-[var(--color-brand-text)]/70 transition hover:border-red-400/25 hover:text-red-300 disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="rounded-[2rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-primary)]/35 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-text)]/42">
                    Active personas
                  </p>
                  <p className="mt-2 text-3xl font-semibold">
                    {activePersonaCount}
                    <span className="ml-2 text-sm font-medium text-[var(--color-brand-text)]/38">
                      / {maximumPersonas}
                    </span>
                  </p>
                </div>
                <div className="rounded-full border border-[var(--color-brand-accent)]/20 bg-[var(--color-brand-accent)]/10 px-4 py-2 text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-accent)]">
                  {readyToChat ? "Chat live" : `${personasStillNeeded} to go`}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {activePersonas.length === 0 ? (
                <div className="rounded-[1.75rem] border border-dashed border-[var(--color-brand-text)]/14 px-5 py-8 text-center">
                  <UserRoundPlus className="mx-auto h-8 w-8 text-[var(--color-brand-text)]/28" />
                  <p className="mt-4 text-sm leading-6 text-[var(--color-brand-text)]/58">
                    No personas yet. Create the first one now.
                  </p>
                </div>
              ) : (
                activePersonas.map((persona) => (
                  <div
                    key={persona.id}
                    className="rounded-[1.5rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-primary)]/28 px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">{persona.display_name}</p>
                        <p className="mt-1 text-xs font-mono uppercase tracking-[0.18em] text-[var(--color-brand-text)]/40">
                          {persona.persona_type === "real_person" ? "Profiled persona" : "Custom advisor"}
                        </p>
                      </div>
                      <span className="rounded-full border border-[var(--color-brand-text)]/10 px-3 py-1 text-xs text-[var(--color-brand-accent)]">
                        {persona.source_count} sources
                      </span>
                    </div>
                    {persona.identity_summary && (
                      <p className="mt-3 text-sm leading-6 text-[var(--color-brand-text)]/62">
                        {persona.identity_summary}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="rounded-[2rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-primary)]/38 p-5">
              <div className="mb-4 flex items-center gap-3">
                <Plus className="h-4 w-4 text-[var(--color-brand-accent)]" />
                <h2 className="text-base font-semibold">Add persona</h2>
              </div>

              {!canCreateMore ? (
                <p className="text-sm leading-6 text-[var(--color-brand-text)]/58">
                  You have reached the current council cap of {maximumPersonas} personas.
                </p>
              ) : (
                <form className="space-y-4" onSubmit={handleProfilePersona}>
                  <div className="flex rounded-full border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-primary)]/45 p-1">
                    <button
                      type="button"
                      onClick={() => handleBuilderChange("personaType", "real_person")}
                      className={`flex-1 rounded-full px-3 py-2 text-xs font-mono uppercase tracking-[0.16em] transition ${
                        builder.personaType === "real_person"
                          ? "bg-[var(--color-brand-accent)] text-[var(--color-brand-primary)]"
                          : "text-[var(--color-brand-text)]/55"
                      }`}
                    >
                      Real person
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBuilderChange("personaType", "custom")}
                      className={`flex-1 rounded-full px-3 py-2 text-xs font-mono uppercase tracking-[0.16em] transition ${
                        builder.personaType === "custom"
                          ? "bg-[var(--color-brand-accent)] text-[var(--color-brand-primary)]"
                          : "text-[var(--color-brand-text)]/55"
                      }`}
                    >
                      Custom
                    </button>
                  </div>

                  <label className="grid gap-2">
                    <span className="text-xs font-mono uppercase tracking-[0.18em] text-[var(--color-brand-text)]/42">
                      {builder.personaType === "real_person" ? "Person name" : "Persona name"}
                    </span>
                    <input
                      value={builder.inputName}
                      onChange={(event) => handleBuilderChange("inputName", event.target.value)}
                      className="rounded-[1.25rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-primary)]/45 px-4 py-3 text-sm outline-none transition focus:border-[var(--color-brand-accent)]"
                      placeholder={builder.personaType === "real_person" ? "Naval Ravikant" : "The Skeptic"}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-mono uppercase tracking-[0.18em] text-[var(--color-brand-text)]/42">
                      Brief
                    </span>
                    <textarea
                      rows={4}
                      value={builder.customBrief}
                      onChange={(event) => handleBuilderChange("customBrief", event.target.value)}
                      className="resize-none rounded-[1.25rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-primary)]/45 px-4 py-3 text-sm leading-6 outline-none transition focus:border-[var(--color-brand-accent)]"
                      placeholder={
                        builder.personaType === "real_person"
                          ? "Optional note to bias the profile toward a specific domain or angle."
                          : "Describe the worldview, communication style, and what this advisor should optimize for."
                      }
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={isProfiling}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-brand-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-brand-primary)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isProfiling ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        Profiling...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Build persona
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {draft && (
              <div className="rounded-[2rem] border border-[var(--color-brand-accent)]/20 bg-[var(--color-brand-accent)]/8 p-5">
                <p className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-accent)]">
                  Draft ready
                </p>
                <h3 className="mt-3 text-lg font-semibold">
                  {draft.draft_profile.display_name || draft.input_name}
                </h3>
                {draft.draft_profile.identity_summary && (
                  <p className="mt-3 text-sm leading-6 text-[var(--color-brand-text)]/72">
                    {draft.draft_profile.identity_summary}
                  </p>
                )}

                {!!draft.draft_profile.worldview?.length && (
                  <div className="mt-4">
                    <p className="text-xs font-mono uppercase tracking-[0.18em] text-[var(--color-brand-text)]/42">
                      Worldview
                    </p>
                    <ul className="mt-2 space-y-2 text-sm leading-6 text-[var(--color-brand-text)]/72">
                      {draft.draft_profile.worldview.slice(0, 3).map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {!!draft.draft_profile.warnings?.length && (
                  <div className="mt-4 rounded-[1.25rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-primary)]/30 px-4 py-3 text-sm leading-6 text-[var(--color-brand-text)]/68">
                    {draft.draft_profile.warnings.join(" ")}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between gap-4 text-xs font-mono uppercase tracking-[0.16em] text-[var(--color-brand-text)]/42">
                  <span>{draft.sources.length} sources</span>
                  <span>{draft.review_status}</span>
                </div>

                <button
                  type="button"
                  onClick={() => void handleApproveDraft()}
                  disabled={isApproving}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--color-brand-accent)]/30 bg-[var(--color-brand-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-brand-primary)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isApproving ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Approve persona"
                  )}
                </button>
              </div>
            )}

            {user && (
              <p className="mt-auto text-xs font-mono uppercase tracking-[0.18em] text-[var(--color-brand-text)]/32">
                {user.email}
              </p>
            )}
          </div>
        </aside>

        <section className="flex min-h-screen flex-col">
          <header className="border-b border-[var(--color-brand-text)]/8 px-6 py-5 md:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-mono uppercase tracking-[0.22em] text-[var(--color-brand-text)]/38">
                  {readyToChat ? "Live council" : "Persona setup"}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  {readyToChat ? conversation?.title || "New council session" : "Build the council first"}
                </h2>
              </div>
              {readyToChat && (
                <button
                  type="button"
                  onClick={handleStartFreshConversation}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--color-brand-text)]/10 px-4 py-2.5 text-sm font-semibold text-[var(--color-brand-text)]/72 transition hover:border-[var(--color-brand-accent)]/25 hover:text-[var(--color-brand-text)]"
                >
                  <MessageSquareText className="h-4 w-4" />
                  New chat
                </button>
              )}
            </div>
          </header>

          <div className="flex-1 px-6 py-6 md:px-8">
            {(statusMessage || errorMessage) && (
              <div
                className={`mb-6 rounded-[1.5rem] border px-4 py-3 text-sm leading-6 ${
                  errorMessage
                    ? "border-red-500/25 bg-red-500/10 text-red-200"
                    : "border-[var(--color-brand-accent)]/20 bg-[var(--color-brand-accent)]/10 text-[var(--color-brand-text)]"
                }`}
              >
                {errorMessage ?? statusMessage}
              </div>
            )}

            {!readyToChat ? (
              <div className="flex h-full items-center justify-center">
                <div className="w-full max-w-3xl rounded-[2.5rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-surface)]/45 p-8 md:p-10">
                  <p className="text-xs font-mono uppercase tracking-[0.24em] text-[var(--color-brand-accent)]">
                    Step 1
                  </p>
                  <h3 className="mt-4 font-serif text-4xl font-semibold tracking-tight">
                    Create {minimumPersonas} personas to unlock the chat.
                  </h3>
                  <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--color-brand-text)]/64">
                    Each persona is created one by one. The profiling agent searches, collates the relevant material,
                    and builds the profile that powers the council response. Once you have at least {minimumPersonas},
                    the chat opens automatically.
                  </p>

                  <div className="mt-8 grid gap-4 md:grid-cols-3">
                    <div className="rounded-[1.75rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-primary)]/30 p-5">
                      <p className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-accent)]">
                        Profile
                      </p>
                      <p className="mt-3 text-sm leading-6 text-[var(--color-brand-text)]/66">
                        Add a real person or custom advisor and let the system draft the persona profile.
                      </p>
                    </div>
                    <div className="rounded-[1.75rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-primary)]/30 p-5">
                      <p className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-accent)]">
                        Approve
                      </p>
                      <p className="mt-3 text-sm leading-6 text-[var(--color-brand-text)]/66">
                        Review the generated persona and add it to the active council roster.
                      </p>
                    </div>
                    <div className="rounded-[1.75rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-primary)]/30 p-5">
                      <p className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-accent)]">
                        Ask
                      </p>
                      <p className="mt-3 text-sm leading-6 text-[var(--color-brand-text)]/66">
                        Once the minimum is met, every prompt fans out to all personas simultaneously.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col">
                <div className="flex-1 space-y-6 overflow-y-auto pr-1">
                  {(conversation?.turns.length ?? 0) === 0 ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="w-full max-w-3xl rounded-[2.5rem] border border-dashed border-[var(--color-brand-text)]/14 bg-[var(--color-brand-surface)]/40 p-8 text-center md:p-10">
                        <Sparkles className="mx-auto h-10 w-10 text-[var(--color-brand-accent)]/75" />
                        <h3 className="mt-5 text-2xl font-semibold">Ask the council.</h3>
                        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--color-brand-text)]/62">
                          The moment you send a prompt, every active persona starts responding in parallel and the
                          synthesis is generated after the full set arrives.
                        </p>
                        <div className="mt-8 grid gap-3 md:grid-cols-3">
                          {SAMPLE_PROMPTS.map((sample) => (
                            <button
                              key={sample}
                              type="button"
                              onClick={() => setPrompt(sample)}
                              className="rounded-[1.5rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-primary)]/30 px-4 py-4 text-left text-sm leading-6 text-[var(--color-brand-text)]/72 transition hover:border-[var(--color-brand-accent)]/25 hover:text-[var(--color-brand-text)]"
                            >
                              {sample}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    conversation?.turns.map((turn) => (
                      <article key={turn.user_message.id} className="space-y-4">
                        <div className="rounded-[1.6rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-text)] text-[var(--color-brand-primary)] px-5 py-4">
                          <p className="text-xs font-mono uppercase tracking-[0.2em] opacity-60">
                            You · {formatDate(turn.user_message.created_at)}
                          </p>
                          <p className="mt-3 text-sm leading-7 md:text-base">{turn.user_message.content}</p>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-2">
                          {turn.persona_responses.map((response) => (
                            <div
                              key={response.id}
                              className="rounded-[1.5rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-surface)]/55 px-5 py-4"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="font-semibold">{response.persona_name}</p>
                                  <p className="mt-1 text-xs font-mono uppercase tracking-[0.18em] text-[var(--color-brand-text)]/40">
                                    {response.response_type.replace("_", " ")}
                                  </p>
                                </div>
                                <span className="rounded-full border border-[var(--color-brand-text)]/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-[var(--color-brand-accent)]">
                                  {response.status}
                                </span>
                              </div>

                              <p className="mt-4 text-sm font-medium leading-6">
                                {response.verdict || "No verdict returned."}
                              </p>
                              <p className="mt-3 text-sm leading-6 text-[var(--color-brand-text)]/66">
                                {response.reasoning || "No reasoning returned."}
                              </p>

                              {response.recommended_action && (
                                <div className="mt-4 rounded-[1.25rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-primary)]/30 px-4 py-3 text-sm leading-6 text-[var(--color-brand-text)]/78">
                                  <span className="block text-xs font-mono uppercase tracking-[0.18em] text-[var(--color-brand-text)]/42">
                                    Recommended action
                                  </span>
                                  <span className="mt-2 block">{response.recommended_action}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {turn.synthesis && (
                          <div className="rounded-[1.8rem] border border-[var(--color-brand-accent)]/20 bg-[var(--color-brand-accent)]/8 px-5 py-5">
                            <p className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-accent)]">
                              Synthesis
                            </p>
                            <p className="mt-3 text-base leading-7">
                              {turn.synthesis.combined_recommendation || "No combined recommendation returned."}
                            </p>

                            <div className="mt-5 grid gap-4 xl:grid-cols-2">
                              <div className="rounded-[1.5rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-primary)]/30 px-4 py-4">
                                <p className="text-xs font-mono uppercase tracking-[0.18em] text-[var(--color-brand-text)]/42">
                                  Agreements
                                </p>
                                <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--color-brand-text)]/74">
                                  {turn.synthesis.agreements.map((agreement) => (
                                    <li key={agreement}>• {agreement}</li>
                                  ))}
                                </ul>
                              </div>
                              <div className="rounded-[1.5rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-primary)]/30 px-4 py-4">
                                <p className="text-xs font-mono uppercase tracking-[0.18em] text-[var(--color-brand-text)]/42">
                                  Disagreements
                                </p>
                                <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--color-brand-text)]/74">
                                  {turn.synthesis.disagreements.map((disagreement) => (
                                    <li key={disagreement}>• {disagreement}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            {turn.synthesis.next_step && (
                              <div className="mt-4 rounded-[1.5rem] border border-[var(--color-brand-accent)]/20 bg-[var(--color-brand-primary)]/30 px-4 py-4 text-sm leading-6 text-[var(--color-brand-text)]/84">
                                <span className="block text-xs font-mono uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                                  Next step
                                </span>
                                <span className="mt-2 block">{turn.synthesis.next_step}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    ))
                  )}

                  <div ref={scrollRef} />
                </div>

                <form onSubmit={handleSendMessage} className="mt-6 shrink-0">
                  <div className="rounded-[2rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-surface)]/48 p-4">
                    <textarea
                      rows={4}
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      className="w-full resize-none bg-transparent px-2 py-2 text-sm leading-7 outline-none"
                      placeholder="Ask the full council a single question..."
                    />
                    <div className="mt-3 flex items-center justify-between gap-4">
                      <p className="text-xs font-mono uppercase tracking-[0.18em] text-[var(--color-brand-text)]/34">
                        {activePersonaCount} personas will respond simultaneously
                      </p>
                      <button
                        type="submit"
                        disabled={isSending || !prompt.trim()}
                        className="inline-flex items-center gap-2 rounded-full bg-[var(--color-brand-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-brand-primary)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isSending ? (
                          <>
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                            Thinking...
                          </>
                        ) : (
                          "Send to council"
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
