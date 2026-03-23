"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LoaderCircle,
  MessageSquareText,
  PauseCircle,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";

import {
  api,
  API_BASE_URL,
  type Conversation,
  type ConversationSummary,
  type Council,
  type Persona,
  type PersonaDraft,
  type PersonaSource,
  type User,
  pollJobUntilSettled,
} from "@/lib/api";
import { isSupabaseConfigured, signOutSupabase } from "@/lib/supabase";

type PersonaFormState = {
  displayName: string;
  personaType: "real_person" | "custom";
  identitySummary: string;
  worldview: string;
  values: string;
};

type DraftEditorState = {
  identitySummary: string;
  worldview: string;
  values: string;
};

type SourceFormState = {
  url: string;
  title: string;
  sourceType: string;
  publisher: string;
  qualityScore: string;
  content: string;
  isPrimary: boolean;
};

const INITIAL_PERSONA_FORM: PersonaFormState = {
  displayName: "",
  personaType: "custom",
  identitySummary: "",
  worldview: "",
  values: "",
};

const INITIAL_SOURCE_FORM: SourceFormState = {
  url: "",
  title: "",
  sourceType: "reference",
  publisher: "",
  qualityScore: "0.7",
  content: "",
  isPrimary: false,
};

const STARTER_PERSONAS = [
  {
    display_name: "The Strategist",
    persona_type: "custom" as const,
    identity_summary: "A long-horizon thinker who optimizes for leverage, timing, and asymmetric upside.",
    worldview: [
      "Play long-term games with long-term people.",
      "Prefer reversible experiments before irreversible bets.",
      "Separate signal from narrative before acting.",
    ],
    values: ["clarity", "asymmetry", "long-term compounding"],
  },
  {
    display_name: "The Operator",
    persona_type: "custom" as const,
    identity_summary: "An execution-first advisor who cares about sequencing, constraints, and practical delivery.",
    worldview: [
      "Execution reveals truth faster than theory.",
      "Reduce complexity before adding scale.",
      "Protect the team from unnecessary thrash.",
    ],
    values: ["throughput", "discipline", "consistency"],
  },
  {
    display_name: "The Skeptic",
    persona_type: "custom" as const,
    identity_summary: "A risk-sensitive advisor who hunts for hidden assumptions, downside exposure, and fragility.",
    worldview: [
      "Every plan hides assumptions worth testing.",
      "Downside matters more when recovery is slow.",
      "If the incentives are unclear, the risk is probably higher than it looks.",
    ],
    values: ["restraint", "risk control", "honesty"],
  },
];

const SAMPLE_PROMPTS = [
  "Should I raise a seed round now, or stay profitable for another six months?",
  "How should I sequence product, distribution, and pricing over the next 90 days?",
  "What is the highest-leverage experiment I should run before committing more capital?",
];

function parseList(value: string): string[] {
  return value
    .split("\n")
    .flatMap((line) => line.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

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

export default function WorkspacePage() {
  const [user, setUser] = useState<User | null>(null);
  const [council, setCouncil] = useState<Council | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [personaForm, setPersonaForm] = useState<PersonaFormState>(INITIAL_PERSONA_FORM);
  const [councilNameDraft, setCouncilNameDraft] = useState("");
  const [prompt, setPrompt] = useState("");
  const [isBooting, setIsBooting] = useState(true);
  const [isCreatingPersona, setIsCreatingPersona] = useState(false);
  const [isSavingCouncilName, setIsSavingCouncilName] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draftReview, setDraftReview] = useState<PersonaDraft | null>(null);
  const [draftEditor, setDraftEditor] = useState<DraftEditorState | null>(null);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isApprovingDraft, setIsApprovingDraft] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSeedingCouncil, setIsSeedingCouncil] = useState(false);
  const [personaActionId, setPersonaActionId] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [expandedPersonaId, setExpandedPersonaId] = useState<string | null>(null);
  const [personaSources, setPersonaSources] = useState<Record<string, PersonaSource[]>>({});
  const [sourceForms, setSourceForms] = useState<Record<string, SourceFormState>>({});
  const [sourceActionPersonaId, setSourceActionPersonaId] = useState<string | null>(null);
  const [draftSourceForm, setDraftSourceForm] = useState<SourceFormState>(INITIAL_SOURCE_FORM);
  const [isSavingDraftSource, setIsSavingDraftSource] = useState(false);
  const [isRetryingDraftJob, setIsRetryingDraftJob] = useState(false);

  const activeMemberCount = useMemo(
    () => council?.members.filter((member) => member.is_active).length ?? 0,
    [council],
  );
  const readyToQuery = activeMemberCount >= (council?.min_personas ?? 3);
  const activePersonaIds = useMemo(
    () => new Set((council?.members ?? []).filter((member) => member.is_active).map((member) => member.persona_id)),
    [council],
  );
  const activePersonas = useMemo(
    () => personas.filter((persona) => activePersonaIds.has(persona.id) && persona.status === "active"),
    [activePersonaIds, personas],
  );
  const onboardingStep = readyToQuery ? 3 : activeMemberCount > 0 ? 2 : 1;

  const refreshCouncilAndPersonas = useCallback(async () => {
    const [nextCouncil, nextPersonas] = await Promise.all([api.getCouncil(), api.listPersonas()]);
    setCouncil(nextCouncil);
    setCouncilNameDraft(nextCouncil.name);
    setPersonas(nextPersonas);
    return { nextCouncil, nextPersonas };
  }, []);

  const openDraftReview = useCallback((draft: PersonaDraft) => {
    setDraftReview(draft);
    setDraftEditor({
      identitySummary: draft.draft_profile.identity_summary ?? "",
      worldview: (draft.draft_profile.worldview ?? []).join("\n"),
      values: (draft.draft_profile.values ?? []).join("\n"),
    });
  }, []);

  const waitForDraft = useCallback(
    async (draft: PersonaDraft) => {
      if (!draft.job_id || draft.review_status !== "generating") {
        return draft;
      }
      const job = await pollJobUntilSettled(draft.job_id, 30000);
      const refreshedDraft = await api.getPersonaDraft(draft.id);
      openDraftReview(refreshedDraft);
      if (job.status === "failed") {
        setStatusMessage(null);
        setErrorMessage(job.error_message || "Draft generation failed");
      } else {
        setStatusMessage("Draft ready for review. Approve it to add the advisor.");
      }
      return refreshedDraft;
    },
    [openDraftReview],
  );

  const refreshConversations = useCallback(async (preferredConversationId?: string | null) => {
    const conversationRows = await api.listConversations();
    setConversations(conversationRows);

    const nextId = preferredConversationId ?? activeConversationId ?? conversationRows[0]?.id ?? null;
    if (!nextId) {
      setActiveConversationId(null);
      setActiveConversation(null);
      return;
    }

    const conversation = await api.getConversation(nextId);
    setActiveConversationId(nextId);
    setActiveConversation(conversation);
  }, [activeConversationId]);

  const loadWorkspace = useCallback(async () => {
    setErrorMessage(null);
    setIsBooting(true);

    try {
      const [nextUser] = await Promise.all([api.getMe()]);
      await refreshCouncilAndPersonas();

      setUser(nextUser);
      await refreshConversations();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load workspace");
    } finally {
      setIsBooting(false);
    }
  }, [refreshConversations, refreshCouncilAndPersonas]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const handlePersonaFieldChange = (field: keyof PersonaFormState, value: string) => {
    setPersonaForm((current) => ({ ...current, [field]: value }));
  };

  const handleCreatePersona = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setDraftReview(null);

    if (personaForm.personaType === "real_person") {
      setIsGeneratingDraft(true);
      setStatusMessage("Researching a real-person-inspired advisor draft...");

      try {
        const draft = await api.createPersonaDraft({
          input_name: personaForm.displayName,
          persona_type: "real_person",
          custom_brief: personaForm.identitySummary || undefined,
        });
        openDraftReview(draft);
        if (draft.review_status === "generating") {
          setStatusMessage("Draft created. Research is running in the background...");
          await waitForDraft(draft);
        } else {
          setStatusMessage("Draft ready for review. Approve it to add the advisor.");
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to create draft");
        setStatusMessage(null);
      } finally {
        setIsGeneratingDraft(false);
      }
      return;
    }

    setIsCreatingPersona(true);
    setStatusMessage("Adding advisor to your council...");

    try {
      await api.createPersona({
        display_name: personaForm.displayName,
        persona_type: "custom",
        identity_summary: personaForm.identitySummary || undefined,
        worldview: parseList(personaForm.worldview),
        values: parseList(personaForm.values),
        communication_style: ["concise", "structured"],
        decision_style: ["tradeoff-aware", "low-regret"],
        blind_spots: ["may underweight emotional nuance"],
        domain_confidence: { general_reasoning: 0.72 },
        source_count: 0,
        source_quality_score: 0.3,
        add_to_council: true,
      });

      await refreshCouncilAndPersonas();
      setPersonaForm(INITIAL_PERSONA_FORM);
      setStatusMessage("Advisor added. Your council is ready to grow.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create persona");
      setStatusMessage(null);
    } finally {
      setIsCreatingPersona(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!draftReview || !draftEditor) {
      return;
    }

    setIsSavingDraft(true);
    setErrorMessage(null);
    setStatusMessage("Saving draft edits...");

    try {
      const updatedDraft = await api.updatePersonaDraft(draftReview.id, {
        draft_profile: {
          identity_summary: draftEditor.identitySummary.trim() || undefined,
          worldview: parseList(draftEditor.worldview),
          values: parseList(draftEditor.values),
        },
      });
      openDraftReview(updatedDraft);
      setStatusMessage("Draft updated. Review it, then approve when ready.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save draft");
      setStatusMessage(null);
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleApproveDraft = async () => {
    if (!draftReview) {
      return;
    }
    if (draftReview.review_status !== "ready") {
      setErrorMessage("Wait for the draft to finish generating before approval.");
      return;
    }

    setIsApprovingDraft(true);
    setErrorMessage(null);
    setStatusMessage("Approving draft and adding advisor to the council...");

    try {
      await api.approvePersonaDraft(draftReview.id);
      await refreshCouncilAndPersonas();
      setDraftReview(null);
      setDraftEditor(null);
      setPersonaForm(INITIAL_PERSONA_FORM);
      setStatusMessage("Draft approved. Advisor added to your council.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to approve draft");
      setStatusMessage(null);
    } finally {
      setIsApprovingDraft(false);
    }
  };

  const handleRetryDraftDiscovery = async () => {
    if (!draftReview?.job_id) {
      return;
    }
    setIsRetryingDraftJob(true);
    setErrorMessage(null);
    setStatusMessage("Retrying draft discovery...");
    try {
      await api.retryJob(draftReview.job_id);
      const pendingDraft = await api.getPersonaDraft(draftReview.id);
      openDraftReview(pendingDraft);
      await waitForDraft(pendingDraft);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to retry draft discovery");
      setStatusMessage(null);
    } finally {
      setIsRetryingDraftJob(false);
    }
  };

  const handleAddDraftSource = async () => {
    if (!draftReview) {
      return;
    }
    if (!draftSourceForm.url.trim()) {
      setErrorMessage("Draft source URL is required.");
      return;
    }

    setIsSavingDraftSource(true);
    setErrorMessage(null);
    setStatusMessage("Attaching source to draft...");
    try {
      await api.addDraftSource(draftReview.id, {
        url: draftSourceForm.url.trim(),
        title: draftSourceForm.title.trim() || undefined,
        source_type: draftSourceForm.sourceType,
        publisher: draftSourceForm.publisher.trim() || undefined,
        quality_score: draftSourceForm.qualityScore ? Number(draftSourceForm.qualityScore) : undefined,
        content: draftSourceForm.content.trim() || undefined,
        is_primary: draftSourceForm.isPrimary,
      });
      const refreshedDraft = await api.getPersonaDraft(draftReview.id);
      openDraftReview(refreshedDraft);
      setDraftSourceForm(INITIAL_SOURCE_FORM);
      setStatusMessage("Draft source attached.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to attach draft source");
      setStatusMessage(null);
    } finally {
      setIsSavingDraftSource(false);
    }
  };

  const handleSeedCouncil = async () => {
    setIsSeedingCouncil(true);
    setErrorMessage(null);
    setStatusMessage("Assembling a starter council...");

    try {
      const existingNames = new Set(personas.map((persona) => persona.display_name.toLowerCase()));
      const maxPersonas = council?.max_personas ?? 5;
      const remainingSlots = Math.max(0, maxPersonas - activeMemberCount);
      const candidates = STARTER_PERSONAS.filter(
        (persona) => !existingNames.has(persona.display_name.toLowerCase()),
      ).slice(0, remainingSlots);

      if (candidates.length === 0) {
        setStatusMessage("Your council already has the starter advisors it needs.");
        return;
      }

      for (const persona of candidates) {
        await api.createPersona({
          ...persona,
          communication_style: ["concise", "structured"],
          decision_style: ["tradeoff-aware", "action-oriented"],
          blind_spots: ["may overweight their native lens"],
          domain_confidence: { general_reasoning: 0.74 },
          source_count: 0,
          source_quality_score: 0.3,
          add_to_council: true,
        });
      }

      await refreshCouncilAndPersonas();
      setStatusMessage("Starter council assembled. You can ask the first question now.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to seed starter council");
      setStatusMessage(null);
    } finally {
      setIsSeedingCouncil(false);
    }
  };

  const handleDeactivatePersona = async (personaId: string) => {
    setPersonaActionId(personaId);
    setErrorMessage(null);
    setStatusMessage("Updating council membership...");

    try {
      await api.deactivatePersona(personaId);
      await refreshCouncilAndPersonas();
      setStatusMessage("Advisor deactivated.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to deactivate persona");
      setStatusMessage(null);
    } finally {
      setPersonaActionId(null);
    }
  };

  const handleTogglePersonaSources = async (personaId: string) => {
    const nextExpanded = expandedPersonaId === personaId ? null : personaId;
    setExpandedPersonaId(nextExpanded);
    if (!nextExpanded || personaSources[personaId]) {
      return;
    }
    try {
      const sources = await api.listPersonaSources(personaId);
      setPersonaSources((current) => ({ ...current, [personaId]: sources }));
      setSourceForms((current) => ({ ...current, [personaId]: current[personaId] ?? INITIAL_SOURCE_FORM }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load persona sources");
    }
  };

  const handleSourceFieldChange = (
    personaId: string,
    field: keyof SourceFormState,
    value: string | boolean,
  ) => {
    setSourceForms((current) => ({
      ...current,
      [personaId]: {
        ...(current[personaId] ?? INITIAL_SOURCE_FORM),
        [field]: value,
      },
    }));
  };

  const handleAddPersonaSource = async (personaId: string) => {
    const form = sourceForms[personaId] ?? INITIAL_SOURCE_FORM;
    if (!form.url.trim()) {
      setErrorMessage("Source URL is required.");
      return;
    }

    setSourceActionPersonaId(personaId);
    setErrorMessage(null);
    setStatusMessage("Attaching source and rebuilding retrieval index...");
    try {
      await api.addPersonaSource(personaId, {
        url: form.url.trim(),
        title: form.title.trim() || undefined,
        source_type: form.sourceType,
        publisher: form.publisher.trim() || undefined,
        quality_score: form.qualityScore ? Number(form.qualityScore) : undefined,
        content: form.content.trim() || undefined,
        is_primary: form.isPrimary,
      });
      const [sources] = await Promise.all([api.listPersonaSources(personaId), refreshCouncilAndPersonas()]);
      setPersonaSources((current) => ({ ...current, [personaId]: sources }));
      setSourceForms((current) => ({ ...current, [personaId]: INITIAL_SOURCE_FORM }));
      setStatusMessage("Source added and indexed.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to add source");
      setStatusMessage(null);
    } finally {
      setSourceActionPersonaId(null);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOutSupabase();
      window.location.href = "/auth";
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleSaveCouncilName = async () => {
    if (!councilNameDraft.trim()) {
      return;
    }

    setIsSavingCouncilName(true);
    setErrorMessage(null);
    try {
      const nextCouncil = await api.updateCouncil(councilNameDraft.trim());
      setCouncil(nextCouncil);
      setStatusMessage("Council name updated.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update council");
    } finally {
      setIsSavingCouncilName(false);
    }
  };

  const handleSelectConversation = async (conversationId: string) => {
    setErrorMessage(null);
    try {
      const conversation = await api.getConversation(conversationId);
      setActiveConversationId(conversationId);
      setActiveConversation(conversation);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load conversation");
    }
  };

  const handleCreateConversation = async () => {
    setIsCreatingConversation(true);
    setErrorMessage(null);
    setStatusMessage("Starting a fresh thread...");

    try {
      const conversation = await api.createConversation(
        readyToQuery ? `${council?.name ?? "Council"} session` : "Setup conversation",
      );
      await refreshConversations(conversation.id);
      setStatusMessage("New conversation ready.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create conversation");
      setStatusMessage(null);
    } finally {
      setIsCreatingConversation(false);
    }
  };

  const handleSendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt.trim()) {
      return;
    }

    setIsSendingMessage(true);
    setErrorMessage(null);
    setStatusMessage("Consulting the council...");

    try {
      let conversationId = activeConversationId;
      if (!conversationId) {
        const createdConversation = await api.createConversation(
          prompt.length > 44 ? `${prompt.slice(0, 44)}…` : prompt,
        );
        conversationId = createdConversation.id;
      }

      const submission = await api.submitMessage(conversationId, prompt.trim());
      await pollJobUntilSettled(submission.job_id);
      await refreshConversations(conversationId);
      setPrompt("");
      setStatusMessage("The council has responded.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to send prompt");
      setStatusMessage(null);
    } finally {
      setIsSendingMessage(false);
    }
  };

  if (isBooting) {
    return (
      <main className="min-h-screen px-6 py-10 md:px-10">
        <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center rounded-[2rem] border border-white/10 bg-white/3">
          <div className="flex items-center gap-3 text-sm uppercase tracking-[0.25em] text-white/70">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Preparing your council...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(58,125,139,0.22),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent)] px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        {(statusMessage || errorMessage) && (
          <div
            className={`rounded-[1.5rem] border px-4 py-3 text-sm ${
              errorMessage
                ? "border-red-400/30 bg-red-500/10 text-red-100"
                : "border-[var(--color-brand-accent)]/20 bg-[var(--color-brand-accent)]/10 text-white/85"
            }`}
          >
            {errorMessage ?? statusMessage}
          </div>
        )}

        {!readyToQuery ? (
          <>
            <section className="rounded-[2rem] border border-white/10 bg-[rgba(255,255,255,0.04)] px-5 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.2)] backdrop-blur-xl md:px-8 md:py-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-xs uppercase tracking-[0.35em] text-[var(--color-brand-accent-amber)]">
                    Onboarding
                  </p>
                  <h1 className="mt-3 font-serif text-4xl italic tracking-tight text-white md:text-5xl">
                    Build your council first.
                  </h1>
                  <p className="mt-3 text-sm leading-7 text-white/70 md:text-base">
                    Setting up the council should feel like an onboarding flow, not a dashboard. Name the council,
                    add at least three advisors, review the bench, and the interface will collapse into a normal
                    chat workspace automatically.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { step: 1, title: "Name council" },
                    { step: 2, title: "Add advisors" },
                    { step: 3, title: "Unlock chat" },
                  ].map((item) => {
                    const isComplete = onboardingStep > item.step || (readyToQuery && item.step === 3);
                    const isCurrent = onboardingStep === item.step && !readyToQuery;
                    return (
                      <div
                        key={item.step}
                        className={`rounded-[1.5rem] border px-4 py-4 ${
                          isComplete
                            ? "border-[var(--color-brand-accent)]/30 bg-[var(--color-brand-accent)]/12"
                            : isCurrent
                              ? "border-[var(--color-brand-accent-amber)]/30 bg-[var(--color-brand-accent-amber)]/10"
                              : "border-white/10 bg-black/20"
                        }`}
                      >
                        <p className="text-[10px] uppercase tracking-[0.3em] text-white/45">Step {item.step}</p>
                        <p className="mt-2 text-sm font-semibold text-white">{item.title}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
              <div className="space-y-6">
                <section className="rounded-[2rem] border border-white/10 bg-[rgba(255,255,255,0.03)] p-5 backdrop-blur-xl md:p-6">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/45">Step 1</p>
                  <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h2 className="text-2xl font-semibold text-white">Give the council a point of view</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
                        The name becomes the frame for every session. Keep it short and functional.
                      </p>
                    </div>
                    <div className="w-full max-w-xl">
                      <label className="grid gap-2">
                        <span className="text-xs uppercase tracking-[0.25em] text-white/45">Council name</span>
                        <div className="flex gap-2">
                          <input
                            value={councilNameDraft}
                            onChange={(event) => setCouncilNameDraft(event.target.value)}
                            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-[var(--color-brand-accent)]"
                            placeholder="Founder Council"
                          />
                          <button
                            onClick={handleSaveCouncilName}
                            disabled={isSavingCouncilName}
                            className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[var(--color-brand-primary)] transition hover:bg-[var(--color-brand-accent-amber)] disabled:opacity-60"
                          >
                            {isSavingCouncilName ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </label>
                    </div>
                  </div>
                </section>

                <section className="rounded-[2rem] border border-white/10 bg-[rgba(255,255,255,0.03)] p-5 backdrop-blur-xl md:p-6">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/45">Step 2</p>
                  <div className="mt-2 flex flex-col gap-6">
                    <div>
                      <h2 className="text-2xl font-semibold text-white">Choose how to build the first bench</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
                        Start with a generated three-advisor council, or add custom and real-person-inspired
                        personas one by one.
                      </p>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                      <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-[0.25em] text-white/45">Fastest path</p>
                        <h3 className="mt-2 text-lg font-semibold text-white">Generate a starter council</h3>
                        <p className="mt-2 text-sm leading-6 text-white/60">
                          Strategist, Operator, and Skeptic. Enough contrast to start testing the core loop.
                        </p>
                        <button
                          onClick={handleSeedCouncil}
                          disabled={isSeedingCouncil || activeMemberCount >= (council?.max_personas ?? 5)}
                          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSeedingCouncil ? (
                            <>
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                              Building starter council
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Generate starter council
                            </>
                          )}
                        </button>
                      </div>

                      <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-[0.25em] text-white/45">Manual path</p>
                        <h3 className="mt-2 text-lg font-semibold text-white">Add one advisor</h3>
                        <form className="mt-4 grid gap-4" onSubmit={handleCreatePersona}>
                          <div className="grid gap-4 md:grid-cols-2">
                            <label className="grid gap-2">
                              <span className="text-xs uppercase tracking-[0.25em] text-white/45">Name</span>
                              <input
                                required
                                value={personaForm.displayName}
                                onChange={(event) => handlePersonaFieldChange("displayName", event.target.value)}
                                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-[var(--color-brand-accent)]"
                                placeholder="The Contrarian"
                              />
                            </label>

                            <label className="grid gap-2">
                              <span className="text-xs uppercase tracking-[0.25em] text-white/45">Type</span>
                              <select
                                value={personaForm.personaType}
                                onChange={(event) =>
                                  handlePersonaFieldChange(
                                    "personaType",
                                    event.target.value as PersonaFormState["personaType"],
                                  )
                                }
                                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-[var(--color-brand-accent)]"
                              >
                                <option value="custom">Custom advisor</option>
                                <option value="real_person">Real-person-inspired</option>
                              </select>
                            </label>
                          </div>

                          <label className="grid gap-2">
                            <span className="text-xs uppercase tracking-[0.25em] text-white/45">Identity summary</span>
                            <textarea
                              rows={3}
                              value={personaForm.identitySummary}
                              onChange={(event) => handlePersonaFieldChange("identitySummary", event.target.value)}
                              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-[var(--color-brand-accent)]"
                              placeholder="An advisor who optimizes for downside protection and hidden incentives."
                            />
                          </label>

                          {personaForm.personaType === "custom" && (
                            <>
                              <label className="grid gap-2">
                                <span className="text-xs uppercase tracking-[0.25em] text-white/45">Worldview</span>
                                <textarea
                                  rows={3}
                                  value={personaForm.worldview}
                                  onChange={(event) => handlePersonaFieldChange("worldview", event.target.value)}
                                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-[var(--color-brand-accent)]"
                                  placeholder="One belief per line, or comma separated."
                                />
                              </label>

                              <label className="grid gap-2">
                                <span className="text-xs uppercase tracking-[0.25em] text-white/45">Values</span>
                                <textarea
                                  rows={2}
                                  value={personaForm.values}
                                  onChange={(event) => handlePersonaFieldChange("values", event.target.value)}
                                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-[var(--color-brand-accent)]"
                                  placeholder="Clarity, discipline, low-regret action"
                                />
                              </label>
                            </>
                          )}

                          <button
                            type="submit"
                            disabled={isCreatingPersona || isGeneratingDraft}
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[var(--color-brand-primary)] transition hover:bg-[var(--color-brand-accent-amber)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isCreatingPersona || isGeneratingDraft ? (
                              <>
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                                {personaForm.personaType === "real_person" ? "Generating draft" : "Adding advisor"}
                              </>
                            ) : (
                              <>
                                <Plus className="h-4 w-4" />
                                {personaForm.personaType === "real_person" ? "Create review draft" : "Add advisor"}
                              </>
                            )}
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                </section>

                {draftReview && (
                  <section className="rounded-[2rem] border border-[var(--color-brand-accent)]/20 bg-[var(--color-brand-accent)]/8 p-5 backdrop-blur-xl md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-brand-accent-amber)]">
                          Draft review
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold text-white">
                          {draftReview.draft_profile.display_name}
                        </h2>
                      </div>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/60">
                        {draftReview.review_status}
                      </span>
                    </div>

                    {draftReview.review_status === "generating" && (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm leading-6 text-white/75">
                        Discovery is still running. Review signals and sources will appear here when the job completes.
                      </div>
                    )}

                    {(draftReview.draft_profile.warnings?.length ?? 0) > 0 && (
                      <div className="mt-4 rounded-2xl border border-[var(--color-brand-accent-amber)]/25 bg-[var(--color-brand-accent-amber)]/10 px-4 py-4">
                        <span className="text-xs uppercase tracking-[0.25em] text-[var(--color-brand-accent-amber)]">
                          Evidence warnings
                        </span>
                        <ul className="mt-3 space-y-2 text-sm leading-6 text-white/80">
                          {draftReview.draft_profile.warnings?.map((warning) => (
                            <li key={warning}>• {warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="grid gap-4">
                        <label className="grid gap-2">
                          <span className="text-xs uppercase tracking-[0.25em] text-white/45">Identity summary</span>
                          <textarea
                            rows={3}
                            value={draftEditor?.identitySummary ?? ""}
                            onChange={(event) =>
                              setDraftEditor((current) =>
                                current ? { ...current, identitySummary: event.target.value } : current,
                              )
                            }
                            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-[var(--color-brand-accent)]"
                          />
                        </label>

                        <label className="grid gap-2">
                          <span className="text-xs uppercase tracking-[0.25em] text-white/45">Worldview</span>
                          <textarea
                            rows={4}
                            value={draftEditor?.worldview ?? ""}
                            onChange={(event) =>
                              setDraftEditor((current) =>
                                current ? { ...current, worldview: event.target.value } : current,
                              )
                            }
                            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-[var(--color-brand-accent)]"
                          />
                        </label>

                        <label className="grid gap-2">
                          <span className="text-xs uppercase tracking-[0.25em] text-white/45">Values</span>
                          <textarea
                            rows={3}
                            value={draftEditor?.values ?? ""}
                            onChange={(event) =>
                              setDraftEditor((current) =>
                                current ? { ...current, values: event.target.value } : current,
                              )
                            }
                            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-[var(--color-brand-accent)]"
                          />
                        </label>
                      </div>

                      <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.25em] text-white/45">Draft sources</p>
                            <p className="mt-2 text-sm leading-6 text-white/60">
                              Attach real excerpts before approval if the profile needs stronger grounding.
                            </p>
                          </div>
                          <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/60">
                            {draftReview.sources.length}
                          </span>
                        </div>

                        <div className="mt-4 space-y-3">
                          {draftReview.sources.length === 0 ? (
                            <p className="text-sm leading-6 text-white/55">
                              No sources attached yet.
                            </p>
                          ) : (
                            draftReview.sources.map((source) => (
                              <div key={source.id} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm font-semibold text-white underline-offset-4 hover:underline"
                                >
                                  {source.title || source.url}
                                </a>
                                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/45">
                                  {source.source_type} · quality {source.quality_score !== null ? source.quality_score.toFixed(2) : "n/a"}
                                </p>
                                {source.notes_excerpt && (
                                  <p className="mt-2 text-sm leading-6 text-white/65">{source.notes_excerpt}</p>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                      <input
                        value={draftSourceForm.url}
                        onChange={(event) => setDraftSourceForm((current) => ({ ...current, url: event.target.value }))}
                        className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-[var(--color-brand-accent)]"
                        placeholder="https://example.com/interview"
                      />
                      <input
                        value={draftSourceForm.title}
                        onChange={(event) => setDraftSourceForm((current) => ({ ...current, title: event.target.value }))}
                        className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-[var(--color-brand-accent)]"
                        placeholder="Source title"
                      />
                      <textarea
                        rows={4}
                        value={draftSourceForm.content}
                        onChange={(event) => setDraftSourceForm((current) => ({ ...current, content: event.target.value }))}
                        className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 outline-none transition focus:border-[var(--color-brand-accent)]"
                        placeholder="Optional excerpt. Leave blank to fetch from the URL."
                      />
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={handleAddDraftSource}
                          disabled={isSavingDraftSource}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black/30 disabled:opacity-60"
                        >
                          {isSavingDraftSource ? (
                            <>
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                              Saving source
                            </>
                          ) : (
                            "Attach source"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveDraft}
                          disabled={isSavingDraft || draftReview.review_status === "generating"}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black/30 disabled:opacity-60"
                        >
                          {isSavingDraft ? "Saving..." : "Save edits"}
                        </button>
                        <button
                          type="button"
                          onClick={handleApproveDraft}
                          disabled={isApprovingDraft || draftReview.review_status !== "ready"}
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-[var(--color-brand-primary)] transition hover:bg-[var(--color-brand-accent-amber)] disabled:opacity-60"
                        >
                          {isApprovingDraft ? "Approving..." : "Approve and add to council"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDraftReview(null);
                            setDraftEditor(null);
                          }}
                          className="rounded-full border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black/30"
                        >
                          Clear draft
                        </button>
                        {draftReview.review_status === "failed" && draftReview.job_id && (
                          <button
                            type="button"
                            onClick={handleRetryDraftDiscovery}
                            disabled={isRetryingDraftJob}
                            className="rounded-full border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black/30 disabled:opacity-60"
                          >
                            {isRetryingDraftJob ? "Retrying..." : "Retry discovery"}
                          </button>
                        )}
                      </div>
                    </div>
                  </section>
                )}
              </div>

              <aside className="space-y-6">
                <section className="rounded-[2rem] border border-white/10 bg-[rgba(255,255,255,0.03)] p-5 backdrop-blur-xl">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/45">Step 3</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Unlock the chat loop</h2>
                  <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/70">Active advisors</span>
                      <span className="font-semibold text-white">
                        {activeMemberCount} / {council?.min_personas ?? 3}
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full bg-[var(--color-brand-accent)] transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            (activeMemberCount / Math.max(council?.min_personas ?? 3, 1)) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-white/60">
                      {activeMemberCount >= (council?.min_personas ?? 3)
                        ? "Setup complete. The workspace will switch to chat automatically."
                        : "Add at least three active personas. Once you cross the minimum, this page becomes the chat workspace."}
                    </p>
                  </div>
                </section>

                <section className="rounded-[2rem] border border-white/10 bg-[rgba(255,255,255,0.03)] p-5 backdrop-blur-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-white/45">Current bench</p>
                      <h2 className="mt-1 text-xl font-semibold text-white">Advisors in progress</h2>
                    </div>
                    <span className="text-sm text-white/50">{personas.length} total</span>
                  </div>

                  <div className="mt-5 space-y-3">
                    {personas.length === 0 && (
                      <div className="rounded-[1.5rem] border border-dashed border-white/10 px-4 py-6 text-sm leading-6 text-white/55">
                        No personas yet. Generate the starter council or add advisors manually.
                      </div>
                    )}

                    {personas.map((persona) => (
                      <div
                        key={persona.id}
                        className="rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-white">{persona.display_name}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.25em] text-white/45">
                              {persona.persona_type === "real_person" ? "Real-person-inspired" : "Custom advisor"}
                            </p>
                          </div>
                          <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/60">
                            {persona.status}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-white/65">
                          {persona.identity_summary || "No identity summary yet."}
                        </p>
                        <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/45">
                          <span>{persona.source_count} sources</span>
                          <button
                            type="button"
                            onClick={() => void handleDeactivatePersona(persona.id)}
                            disabled={
                              persona.status !== "active" ||
                              personaActionId === persona.id ||
                              activeMemberCount <= (council?.min_personas ?? 3)
                            }
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {personaActionId === persona.id ? (
                              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <PauseCircle className="h-3.5 w-3.5" />
                            )}
                            Deactivate
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </aside>
            </div>
          </>
        ) : (
          <>
            <section className="rounded-[2rem] border border-white/10 bg-[rgba(255,255,255,0.04)] px-5 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.2)] backdrop-blur-xl md:px-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-xs uppercase tracking-[0.35em] text-[var(--color-brand-accent-amber)]">
                    Council chat
                  </p>
                  <h1 className="mt-3 font-serif text-4xl italic tracking-tight text-white md:text-5xl">
                    {council?.name ?? "My Council"}
                  </h1>
                  <p className="mt-3 text-sm leading-7 text-white/70 md:text-base">
                    The onboarding layer is done. What remains is the actual product: a normal chat UI that lets
                    you ask one question and inspect the council&apos;s distinct responses.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-4 text-sm">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/45">Active advisors</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{activeMemberCount}</p>
                    <p className="mt-1 text-white/60">{user?.display_name ?? user?.email ?? "Demo user"}</p>
                  </div>
                  <div className="rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-4 text-sm">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/45">Backend</p>
                    <a
                      href={API_BASE_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block text-base font-semibold text-[var(--color-brand-accent)] underline-offset-4 hover:underline"
                    >
                      {API_BASE_URL}
                    </a>
                    {isSupabaseConfigured() && (
                      <button
                        onClick={handleSignOut}
                        disabled={isSigningOut}
                        className="mt-3 text-white/70 transition hover:text-white disabled:opacity-60"
                      >
                        {isSigningOut ? "Signing out..." : "Sign out"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
              <aside className="space-y-6">
                <section className="rounded-[2rem] border border-white/10 bg-[rgba(255,255,255,0.03)] p-5 backdrop-blur-xl">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-white/6 p-3 text-[var(--color-brand-accent)]">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-white/45">Council</p>
                      <h2 className="text-xl font-semibold text-white">Active bench</h2>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {activePersonas.map((persona) => (
                      <div key={persona.id} className="rounded-[1.25rem] border border-white/10 bg-black/20 px-4 py-3">
                        <p className="font-medium text-white">{persona.display_name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/45">
                          {persona.persona_type === "real_person" ? "Real-person-inspired" : "Custom advisor"}
                        </p>
                      </div>
                    ))}
                  </div>

                  <details className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-4">
                    <summary className="cursor-pointer list-none text-sm font-semibold text-white">
                      Manage council
                    </summary>

                    <div className="mt-4 grid gap-4">
                      <div className="grid gap-2">
                        <span className="text-xs uppercase tracking-[0.25em] text-white/45">Council name</span>
                        <div className="flex gap-2">
                          <input
                            value={councilNameDraft}
                            onChange={(event) => setCouncilNameDraft(event.target.value)}
                            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-[var(--color-brand-accent)]"
                          />
                          <button
                            onClick={handleSaveCouncilName}
                            disabled={isSavingCouncilName}
                            className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[var(--color-brand-primary)] transition hover:bg-[var(--color-brand-accent-amber)] disabled:opacity-60"
                          >
                            Save
                          </button>
                        </div>
                      </div>

                      <form className="grid gap-3" onSubmit={handleCreatePersona}>
                        <input
                          required
                          value={personaForm.displayName}
                          onChange={(event) => handlePersonaFieldChange("displayName", event.target.value)}
                          className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-[var(--color-brand-accent)]"
                          placeholder="Add another advisor"
                        />
                        <select
                          value={personaForm.personaType}
                          onChange={(event) =>
                            handlePersonaFieldChange(
                              "personaType",
                              event.target.value as PersonaFormState["personaType"],
                            )
                          }
                          className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-[var(--color-brand-accent)]"
                        >
                          <option value="custom">Custom advisor</option>
                          <option value="real_person">Real-person-inspired</option>
                        </select>
                        <textarea
                          rows={3}
                          value={personaForm.identitySummary}
                          onChange={(event) => handlePersonaFieldChange("identitySummary", event.target.value)}
                          className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-[var(--color-brand-accent)]"
                          placeholder="Short brief or research direction"
                        />
                        {personaForm.personaType === "custom" && (
                          <>
                            <textarea
                              rows={3}
                              value={personaForm.worldview}
                              onChange={(event) => handlePersonaFieldChange("worldview", event.target.value)}
                              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-[var(--color-brand-accent)]"
                              placeholder="Worldview"
                            />
                            <textarea
                              rows={2}
                              value={personaForm.values}
                              onChange={(event) => handlePersonaFieldChange("values", event.target.value)}
                              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-[var(--color-brand-accent)]"
                              placeholder="Values"
                            />
                          </>
                        )}
                        <button
                          type="submit"
                          disabled={isCreatingPersona || isGeneratingDraft}
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[var(--color-brand-primary)] transition hover:bg-[var(--color-brand-accent-amber)] disabled:opacity-60"
                        >
                          {isCreatingPersona || isGeneratingDraft ? "Working..." : "Add advisor"}
                        </button>
                      </form>

                      {personas.map((persona) => (
                        <div key={persona.id} className="rounded-[1.25rem] border border-white/10 bg-white/5 px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-white">{persona.display_name}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/45">
                                {persona.status} · {persona.source_count} sources
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void handleTogglePersonaSources(persona.id)}
                                className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70 transition hover:bg-black/30"
                              >
                                Sources
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeactivatePersona(persona.id)}
                                disabled={
                                  persona.status !== "active" ||
                                  personaActionId === persona.id ||
                                  activeMemberCount <= (council?.min_personas ?? 3)
                                }
                                className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70 transition hover:bg-black/30 disabled:opacity-50"
                              >
                                {personaActionId === persona.id ? "..." : "Deactivate"}
                              </button>
                            </div>
                          </div>

                          {expandedPersonaId === persona.id && (
                            <div className="mt-4 space-y-4 rounded-[1.25rem] border border-white/10 bg-black/25 p-4">
                              <div className="space-y-3">
                                {(personaSources[persona.id] ?? []).length === 0 ? (
                                  <p className="text-sm leading-6 text-white/55">
                                    No external sources attached yet.
                                  </p>
                                ) : (
                                  (personaSources[persona.id] ?? []).map((source) => (
                                    <div key={source.id} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <a
                                            href={source.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-sm font-semibold text-white underline-offset-4 hover:underline"
                                          >
                                            {source.title || source.url}
                                          </a>
                                          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/45">
                                            {source.source_type} · {source.chunk_count} chunks · quality{" "}
                                            {source.quality_score !== null ? source.quality_score.toFixed(2) : "n/a"}
                                          </p>
                                        </div>
                                        {source.is_primary && (
                                          <span className="rounded-full border border-[var(--color-brand-accent-amber)]/20 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-[var(--color-brand-accent-amber)]">
                                            Primary
                                          </span>
                                        )}
                                      </div>
                                      {source.notes_excerpt && (
                                        <p className="mt-2 text-sm leading-6 text-white/65">{source.notes_excerpt}</p>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>

                              <div className="grid gap-3">
                                <input
                                  value={sourceForms[persona.id]?.url ?? ""}
                                  onChange={(event) => handleSourceFieldChange(persona.id, "url", event.target.value)}
                                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-[var(--color-brand-accent)]"
                                  placeholder="https://example.com/interview"
                                />
                                <input
                                  value={sourceForms[persona.id]?.title ?? ""}
                                  onChange={(event) => handleSourceFieldChange(persona.id, "title", event.target.value)}
                                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-[var(--color-brand-accent)]"
                                  placeholder="Source title"
                                />
                                <textarea
                                  rows={4}
                                  value={sourceForms[persona.id]?.content ?? ""}
                                  onChange={(event) => handleSourceFieldChange(persona.id, "content", event.target.value)}
                                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 outline-none transition focus:border-[var(--color-brand-accent)]"
                                  placeholder="Optional excerpt. Leave blank to fetch from the URL."
                                />
                                <button
                                  type="button"
                                  onClick={() => void handleAddPersonaSource(persona.id)}
                                  disabled={sourceActionPersonaId === persona.id}
                                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
                                >
                                  {sourceActionPersonaId === persona.id ? "Saving..." : "Attach source"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                </section>

                <section className="rounded-[2rem] border border-white/10 bg-[rgba(255,255,255,0.03)] p-5 backdrop-blur-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-white/45">Threads</p>
                      <h2 className="mt-1 text-xl font-semibold text-white">Conversation history</h2>
                    </div>
                    <button
                      onClick={handleCreateConversation}
                      disabled={isCreatingConversation}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
                    >
                      {isCreatingConversation ? "Creating..." : "New"}
                    </button>
                  </div>

                  <div className="mt-5 space-y-3">
                    {conversations.length === 0 && (
                      <div className="rounded-[1.5rem] border border-dashed border-white/10 px-4 py-5 text-sm leading-6 text-white/55">
                        No threads yet. Start a conversation when you are ready.
                      </div>
                    )}

                    {conversations.map((conversation) => {
                      const isActive = conversation.id === activeConversationId;
                      return (
                        <button
                          key={conversation.id}
                          onClick={() => void handleSelectConversation(conversation.id)}
                          className={`w-full rounded-[1.5rem] border px-4 py-4 text-left transition ${
                            isActive
                              ? "border-[var(--color-brand-accent)]/60 bg-[var(--color-brand-accent)]/12"
                              : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/30"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium text-white">
                              {conversation.title || "Untitled conversation"}
                            </p>
                            <MessageSquareText className="h-4 w-4 text-white/45" />
                          </div>
                          <p className="mt-2 text-xs uppercase tracking-[0.25em] text-white/45">
                            {conversation.message_count} messages
                          </p>
                          <p className="mt-3 text-sm text-white/60">Updated {formatDate(conversation.updated_at)}</p>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </aside>

              <section className="flex min-h-[760px] flex-col rounded-[2rem] border border-white/10 bg-[rgba(255,255,255,0.03)] backdrop-blur-xl">
                <div className="border-b border-white/10 px-5 py-5 md:px-6">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/45">Active thread</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    {activeConversation?.title || "New council session"}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    Ask one concrete question. The system will fan it out across the active bench, then return a
                    synthesis underneath the responses.
                  </p>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 md:px-6">
                  {activeConversation?.turns.length === 0 && (
                    <div className="rounded-[1.5rem] border border-dashed border-white/10 px-4 py-5 text-sm leading-6 text-white/55">
                      This thread is empty. Start with a question like “Should I raise a seed round now?” or
                      “What is the highest-leverage experiment I should run this month?”
                    </div>
                  )}

                  {activeConversation?.turns.map((turn) => (
                    <article key={turn.user_message.id} className="space-y-4">
                      <div className="ml-auto max-w-3xl rounded-[1.5rem] border border-white/10 bg-white/6 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.25em] text-white/45">
                          You · {formatDate(turn.user_message.created_at)}
                        </p>
                        <p className="mt-3 text-base leading-7 text-white">{turn.user_message.content}</p>
                      </div>

                      <div className="space-y-4">
                        {turn.persona_responses.map((response) => (
                          <div
                            key={response.id}
                            className="max-w-4xl rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-white">{response.persona_name}</p>
                                <p className="mt-1 text-xs uppercase tracking-[0.25em] text-white/45">
                                  {response.response_type.replace("_", " ")}
                                </p>
                              </div>
                              <span
                                className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${
                                  response.status === "failed"
                                    ? "bg-red-500/12 text-red-200"
                                    : "bg-[var(--color-brand-accent)]/12 text-[var(--color-brand-accent-amber)]"
                                }`}
                              >
                                {response.status}
                              </span>
                            </div>

                            <p className="mt-4 text-sm font-medium leading-6 text-white/90">
                              {response.verdict || "No verdict returned."}
                            </p>
                            <p className="mt-3 text-sm leading-6 text-white/65">
                              {response.reasoning || "No reasoning provided."}
                            </p>

                            {response.recommended_action && (
                              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/80">
                                <span className="block text-xs uppercase tracking-[0.25em] text-white/45">
                                  Recommended action
                                </span>
                                <span className="mt-2 block leading-6">{response.recommended_action}</span>
                              </div>
                            )}

                            {response.evidence_snippets.length > 0 && (
                              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                                <span className="block text-xs uppercase tracking-[0.25em] text-white/45">
                                  Evidence used
                                </span>
                                <div className="mt-3 space-y-3">
                                  {response.evidence_snippets.map((snippet) => (
                                    <div key={`${response.id}-${snippet.source_id}-${snippet.score}`} className="text-sm leading-6 text-white/70">
                                      <a
                                        href={snippet.source_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="font-medium text-white underline-offset-4 hover:underline"
                                      >
                                        {snippet.source_title || snippet.source_url}
                                      </a>
                                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/45">
                                        {snippet.source_type} · score {snippet.score.toFixed(2)}
                                      </p>
                                      <p className="mt-2">{snippet.chunk_text}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {turn.synthesis && (
                        <div className="max-w-4xl rounded-[1.75rem] border border-[var(--color-brand-accent)]/20 bg-[linear-gradient(180deg,rgba(58,125,139,0.14),rgba(255,255,255,0.03))] px-5 py-5">
                          <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-brand-accent-amber)]">
                            Synthesis
                          </p>
                          <p className="mt-3 text-base leading-7 text-white/90">
                            {turn.synthesis.combined_recommendation || "No combined recommendation yet."}
                          </p>

                          <div className="mt-5 grid gap-4 lg:grid-cols-2">
                            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-4">
                              <p className="text-xs uppercase tracking-[0.25em] text-white/45">Agreements</p>
                              <ul className="mt-3 space-y-2 text-sm leading-6 text-white/75">
                                {turn.synthesis.agreements.map((agreement) => (
                                  <li key={agreement}>• {agreement}</li>
                                ))}
                              </ul>
                            </div>
                            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-4">
                              <p className="text-xs uppercase tracking-[0.25em] text-white/45">Disagreements</p>
                              <ul className="mt-3 space-y-2 text-sm leading-6 text-white/75">
                                {turn.synthesis.disagreements.map((disagreement) => (
                                  <li key={disagreement}>• {disagreement}</li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          {turn.synthesis.next_step && (
                            <div className="mt-4 rounded-[1.5rem] border border-[var(--color-brand-accent-amber)]/20 bg-[var(--color-brand-accent-amber)]/10 px-4 py-4 text-sm leading-6 text-white/85">
                              <span className="block text-xs uppercase tracking-[0.25em] text-[var(--color-brand-accent-amber)]">
                                Most actionable next step
                              </span>
                              <span className="mt-2 block">{turn.synthesis.next_step}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>

                <form onSubmit={handleSendMessage} className="border-t border-white/10 px-5 py-5 md:px-6">
                  <label className="grid gap-3">
                    <span className="text-xs uppercase tracking-[0.25em] text-white/45">
                      Message
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {SAMPLE_PROMPTS.map((samplePrompt) => (
                        <button
                          key={samplePrompt}
                          type="button"
                          onClick={() => setPrompt(samplePrompt)}
                          className="rounded-full border border-white/10 bg-white/6 px-3 py-2 text-left text-xs leading-5 text-white/70 transition hover:border-white/20 hover:bg-white/10"
                        >
                          {samplePrompt}
                        </button>
                      ))}
                    </div>
                    <textarea
                      rows={4}
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      placeholder="Should I raise a seed round now, or stay profitable for another six months?"
                      className="rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 outline-none transition focus:border-[var(--color-brand-accent)] disabled:opacity-60"
                      disabled={isSendingMessage}
                    />
                  </label>

                  <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <p className="text-sm leading-6 text-white/55">
                      Queries run as queued jobs and the thread refreshes when the council completes the turn.
                    </p>
                    <button
                      type="submit"
                      disabled={isSendingMessage || !prompt.trim()}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[var(--color-brand-primary)] transition hover:bg-[var(--color-brand-accent-amber)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSendingMessage ? (
                        <>
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                          Asking council
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Send
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
