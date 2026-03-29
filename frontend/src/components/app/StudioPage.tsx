"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, Plus, Sparkles, Send, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  api,
  pollJobUntilSettled,
  type Conversation,
  type Persona,
  type PersonaDraft,
} from "@/lib/api";

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


const renderMarkdown = (content: string) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      p: ({ children }) => <p className="mb-4 last:mb-0 leading-relaxed text-[var(--color-brand-text)]/80">{children}</p>,
      ul: ({ children }) => <ul className="mb-4 last:mb-0 list-disc pl-5 space-y-2 text-[var(--color-brand-text)]/80">{children}</ul>,
      ol: ({ children }) => <ol className="mb-4 last:mb-0 list-decimal pl-5 space-y-2 text-[var(--color-brand-text)]/80">{children}</ol>,
      li: ({ children }) => <li>{children}</li>,
      strong: ({ children }) => <strong className="font-semibold text-[var(--color-brand-text)]">{children}</strong>,
      h1: ({ children }) => <h1 className="mb-4 text-2xl font-semibold mt-6 text-[var(--color-brand-text)]">{children}</h1>,
      h2: ({ children }) => <h2 className="mb-4 text-xl font-semibold mt-6 text-[var(--color-brand-text)]">{children}</h2>,
      h3: ({ children }) => <h3 className="mb-3 text-lg font-medium mt-5 text-[var(--color-brand-text)]">{children}</h3>,
      blockquote: ({ children }) => <blockquote className="border-l-2 border-[var(--color-brand-accent)] pl-4 italic opacity-80 mb-4">{children}</blockquote>,
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      code({ inline, children, ...props }: any) {
        return inline ? (
          <code className="bg-black/20 text-[var(--color-brand-accent)] px-1.5 py-0.5 rounded text-[0.9em] font-mono border border-[var(--color-brand-text)]/10" {...props}>
            {children}
          </code>
        ) : (
          <pre className="bg-[#000000]/30 p-4 rounded-xl overflow-x-auto text-[0.9em] font-mono mb-4 border border-[var(--color-brand-text)]/10 shadow-inner text-[var(--color-brand-text)]">
            <code {...props}>{children}</code>
          </pre>
        );
      }
    }}
  >
    {content}
  </ReactMarkdown>
);

export default function StudioPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [builder, setBuilder] = useState<PersonaBuilderState>(INITIAL_BUILDER_STATE);
  const [draft, setDraft] = useState<PersonaDraft | null>(null);
  const [prompt, setPrompt] = useState("");
  const [showBuilder, setShowBuilder] = useState(true);
  const [isBooting, setIsBooting] = useState(true);
  const [isProfiling, setIsProfiling] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadLatestConversation = useCallback(async () => {
    const summaries = await api.listConversations();
    const latest = summaries[0];
    if (!latest) {
      setConversation(null);
      return;
    }
    setConversation(await api.getConversation(latest.id));
  }, []);

  const loadApp = useCallback(async () => {
    setIsBooting(true);
    setErrorMessage(null);
    try {
      const [, nextCouncil, nextPersonas] = await Promise.all([
        api.getMe(),
        api.getCouncil(),
        api.listPersonas(),
      ]);

      const activeIds = new Set(
        nextCouncil.members.filter((member) => member.is_active).map((member) => member.persona_id),
      );
      const nextActivePersonas = nextPersonas.filter(
        (persona) => activeIds.has(persona.id) && persona.status === "active",
      );
      setPersonas(nextActivePersonas);

      if (nextActivePersonas.length >= (nextCouncil.min_personas ?? 2)) {
        setShowBuilder(false);
        await loadLatestConversation();
      } else {
        setShowBuilder(true);
        setConversation(null);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load the app.");
    } finally {
      setIsBooting(false);
    }
  }, [loadLatestConversation]);

  useEffect(() => {
    void loadApp();
  }, [loadApp]);

  const activePersonaCount = personas.length;
  const readyToChat = activePersonaCount >= 2;
  const canCreateMore = activePersonaCount < 5;

  useEffect(() => {
    if (!readyToChat && !isBooting) {
      setShowBuilder(true);
    }
  }, [readyToChat, isBooting]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [conversation?.turns, isSending]);

  const handleTextareaInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleBuilderChange = (field: keyof PersonaBuilderState, value: string) => {
    setBuilder((current) => ({ ...current, [field]: value }));
  };

  const handleProfilePersona = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!builder.inputName.trim() || isProfiling || !canCreateMore) return;

    setIsProfiling(true);
    setErrorMessage(null);
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
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to build the persona profile.");
    } finally {
      setIsProfiling(false);
    }
  };

  const handleApproveDraft = async () => {
    if (!draft || isApproving) return;

    setIsApproving(true);
    setErrorMessage(null);

    try {
      await api.approvePersonaDraft(draft.id);
      setDraft(null);
      setBuilder(INITIAL_BUILDER_STATE);
      await loadApp();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to approve persona.");
    } finally {
      setIsApproving(false);
    }
  };

  const submitPrompt = async () => {
    if (!readyToChat || !prompt.trim() || isSending) return;

    const content = prompt.trim();
    setPrompt("");
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; 
    }
    
    setIsSending(true);
    setErrorMessage(null);

    try {
      let conversationId = conversation?.id;
      if (!conversationId) {
        const createdConversation = await api.createConversation(
          content.length > 54 ? `${content.slice(0, 54)}...` : content,
        );
        conversationId = createdConversation.id;
      }

      const submission = await api.submitMessage(conversationId, content);
      await pollJobUntilSettled(submission.job_id, 45000);
      setConversation(await api.getConversation(conversationId));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to run the council query.");
      setPrompt(content);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitPrompt();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submitPrompt();
    }
  };

  const turns = conversation?.turns ?? [];

  if (isBooting) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--color-brand-primary)]">
        <LoaderCircle className="h-6 w-6 animate-spin text-[var(--color-brand-accent)]" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col relative bg-[var(--color-brand-primary)]">
      {/* HEADER */}
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-brand-text)]/5 bg-[var(--color-brand-primary)]/80 px-6 py-4 backdrop-blur-md z-10 hidden md:flex">
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-xl font-semibold text-[var(--color-brand-text)]">
            {conversation?.title || "New Session"}
          </h1>
          {readyToChat && !showBuilder && (
            <span className="rounded-full bg-[var(--color-brand-text)]/10 px-2.5 py-0.5 text-xs text-[var(--color-brand-text)]/60">
              {activePersonaCount} Personas Active
            </span>
          )}
        </div>
        
        {readyToChat && canCreateMore && !showBuilder && (
          <button
            onClick={() => setShowBuilder(true)}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-surface)]/30 px-3 py-1.5 text-xs text-[var(--color-brand-text)]/70 transition hover:border-[var(--color-brand-accent)]/30 hover:text-[var(--color-brand-text)]"
          >
            <Plus className="h-3 w-3" /> Add Persona
          </button>
        )}
      </header>

      {errorMessage && (
        <div className="absolute top-4 md:top-20 left-1/2 z-50 w-11/12 md:max-w-md -translate-x-1/2 rounded-2xl border border-red-500/20 bg-red-950/80 px-4 py-3 text-sm text-red-200 shadow-xl backdrop-blur-md">
          {errorMessage}
        </div>
      )}

      {/* CONTENT AREA */}
      <div className="flex-[1_1_0] overflow-y-auto overflow-x-hidden p-4 md:p-8 relative scroll-smooth will-change-scroll pb-32">
        <div className="mx-auto max-w-3xl lg:max-w-4xl pb-4">
          {showBuilder ? (
            <div className="mx-auto max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8">
              {readyToChat && (
                <button 
                  onClick={() => setShowBuilder(false)}
                  className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--color-brand-text)]/50 transition hover:text-[var(--color-brand-text)]"
                >
                   Cancel
                </button>
              )}
              
              <div className="mb-8 p-6 md:p-8 rounded-[2rem] border border-[var(--color-brand-text)]/5 bg-[var(--color-brand-surface)]/20 shadow-2xl">
                <div className="mb-6">
                  <h2 className="font-serif text-3xl font-semibold text-[var(--color-brand-text)]">
                    {readyToChat ? "Expand Council" : "Build Your Council"}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-brand-text)]/60">
                    {readyToChat
                      ? "Add specialized perspectives to deepen your group's analyses."
                      : "Add at least two distinct perspectives to generate a synthesized verdict. Profile individuals or define archetypes."}
                  </p>
                </div>

                <form className="space-y-5" onSubmit={handleProfilePersona}>
                  <div className="flex p-1 rounded-2xl border border-[var(--color-brand-text)]/10 bg-[#000000]/20">
                    {(["real_person", "custom"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleBuilderChange("personaType", type)}
                        className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                          builder.personaType === type
                            ? "bg-[var(--color-brand-surface)] text-[var(--color-brand-text)] shadow-sm border border-[var(--color-brand-text)]/10"
                            : "text-[var(--color-brand-text)]/50 hover:text-[var(--color-brand-text)]/80"
                        }`}
                      >
                        {type === "real_person" ? "Real Person" : "Custom"}
                      </button>
                    ))}
                  </div>

                  <input
                    value={builder.inputName}
                    onChange={(event) => handleBuilderChange("inputName", event.target.value)}
                    className="w-full rounded-2xl border border-[var(--color-brand-text)]/10 bg-[#000000]/20 px-5 py-3.5 text-sm outline-none text-[var(--color-brand-text)] transition focus:border-[var(--color-brand-accent)] focus:ring-1 focus:ring-[var(--color-brand-accent)]"
                    placeholder={builder.personaType === "real_person" ? "e.g., Steve Jobs, Naval Ravikant..." : "e.g., Cynical Risk Analyst..."}
                  />

                  <textarea
                    rows={3}
                    value={builder.customBrief}
                    onChange={(event) => handleBuilderChange("customBrief", event.target.value)}
                    className="w-full resize-none rounded-2xl border border-[var(--color-brand-text)]/10 bg-[#000000]/20 px-5 py-3.5 text-sm outline-none text-[var(--color-brand-text)] transition focus:border-[var(--color-brand-accent)] focus:ring-1 focus:ring-[var(--color-brand-accent)]"
                    placeholder={
                      builder.personaType === "real_person"
                        ? "Optional context to steer the profile focus."
                        : "Describe the archetype's values, approach, and background."
                    }
                  />

                  <button
                    type="submit"
                    disabled={isProfiling || !canCreateMore}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-brand-text)] px-5 py-3.5 text-sm font-semibold text-[#000000] transition hover:bg-[var(--color-brand-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isProfiling ? (
                      <><LoaderCircle className="h-4 w-4 animate-spin" /> Compiling Profiler...</>
                    ) : (
                      <><Sparkles className="h-4 w-4" /> Generate Profile</>
                    )}
                  </button>
                </form>

                {draft && (
                  <div className="mt-8 animate-in fade-in zoom-in-95 duration-300 rounded-2xl border border-[var(--color-brand-accent)]/20 bg-[var(--color-brand-accent)]/5 p-6 shadow-xl">
                    <h3 className="font-serif text-2xl font-semibold text-[var(--color-brand-text)]">
                      {draft.draft_profile.display_name || draft.input_name}
                    </h3>
                    {draft.draft_profile.identity_summary && (
                      <p className="mt-4 text-sm leading-relaxed text-[var(--color-brand-text)]/80">
                        {draft.draft_profile.identity_summary}
                      </p>
                    )}

                    {!!draft.draft_profile.worldview?.length && (
                      <div className="mt-5">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-brand-text)]/50">Core Tenets</span>
                        <ul className="mt-3 space-y-2 text-sm text-[var(--color-brand-text)]/70">
                          {draft.draft_profile.worldview.slice(0, 3).map((item, i) => (
                            <li key={i} className="flex gap-2">
                               <span className="text-[var(--color-brand-accent)]">•</span> {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => void handleApproveDraft()}
                      disabled={isApproving}
                      className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-accent)] px-5 py-3 text-sm font-semibold text-[#000000] transition hover:brightness-110 disabled:opacity-50"
                    >
                      {isApproving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Approve & Seat Persona"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-12">
              {turns.length === 0 && (
                <div className="flex flex-col items-center justify-center pt-24 text-center animate-in fade-in duration-700">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-brand-surface)]/30 ring-1 ring-[var(--color-brand-text)]/10 shadow-lg">
                    <Bot className="h-8 w-8 text-[var(--color-brand-text)]/60" />
                  </div>
                  <h3 className="font-serif text-3xl font-medium text-[var(--color-brand-text)]">The council is seated.</h3>
                  <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--color-brand-text)]/60">
                    Present your dilemma, decision, or query. The active personas will analyze it from their distinct worldviews and synthesize a coherent verdict.
                  </p>
                </div>
              )}

              {turns.map((turn) => {
                const visibleResponses = turn.persona_responses;

                return (
                  <article key={turn.user_message.id} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* User Message Bubble */}
                    <div className="flex justify-end pt-4">
                      <div className="max-w-[90%] md:max-w-[75%] rounded-[1.8rem] rounded-br-[0.4rem] bg-[#000000]/30 md:bg-[var(--color-brand-surface)]/80 px-6 py-4 border border-[var(--color-brand-text)]/10 shadow-sm backdrop-blur-sm">
                        <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed text-[var(--color-brand-text)]">
                          {turn.user_message.content}
                        </p>
                      </div>
                    </div>

                    {/* Council Responses */}
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-5">
                      {visibleResponses.length > 0 && (
                        <div className="hidden shrink-0 md:block mt-1">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-brand-accent)]/10 border border-[var(--color-brand-accent)]/20 shadow-inner">
                            <Bot className="h-5 w-5 text-[var(--color-brand-accent)]" />
                          </div>
                        </div>
                      )}

                      <div className="flex-1 space-y-6">
                        {visibleResponses.length > 0 && (
                          <div className="grid gap-4 xl:grid-cols-2">
                            {visibleResponses.map((response) => (
                              <div
                                key={response.id}
                                className={`group rounded-3xl border border-[var(--color-brand-text)]/5 ${response.status === 'failed' ? 'bg-red-950/20' : 'bg-[var(--color-brand-surface)]/30'} backdrop-blur-md p-6 shadow-sm transition-all hover:border-[var(--color-brand-text)]/10 hover:bg-[var(--color-brand-surface)]/50`}
                              >
                                <div className="mb-5 flex items-center justify-between border-b border-[var(--color-brand-text)]/5 pb-4">
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-brand-primary)] text-xs font-semibold text-[var(--color-brand-text)]/90 ring-1 ring-[var(--color-brand-text)]/10">
                                      {response.persona_name.charAt(0)}
                                    </div>
                                    <p className="font-serif font-medium tracking-wide text-[var(--color-brand-text)] text-lg opacity-90">{response.persona_name}</p>
                                  </div>
                                  {(response.status === 'failed' || response.response_type === 'no_basis') && (
                                     <span className="text-xs uppercase tracking-widest text-[var(--color-brand-accent)]/60 bg-[var(--color-brand-accent)]/5 px-2 py-1 rounded-md">
                                       {response.status === 'failed' ? 'Failed' : 'No Basis'}
                                     </span>
                                  )}
                                </div>
                                
                                <div className="space-y-4 text-[0.9rem] leading-relaxed">
                                  {response.verdict && (
                                    <div className="text-[var(--color-brand-text)]/90">
                                      {renderMarkdown(response.verdict)}
                                    </div>
                                  )}
                                  {response.reasoning && (
                                    <div className="text-[var(--color-brand-text)]/70">
                                      {renderMarkdown(response.reasoning)}
                                    </div>
                                  )}
                                  {response.recommended_action && (
                                    <div className="mt-5 rounded-2xl bg-[#000000]/20 border border-white/5 p-4">
                                      <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-brand-accent)] mb-3 block">Actionable</span>
                                      <div className="text-[var(--color-brand-text)]/90">
                                        {renderMarkdown(response.recommended_action)}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Synthesis Block */}
                        {turn.synthesis && (
                          <div className="mt-6 rounded-3xl border border-[var(--color-brand-accent)]/30 bg-[var(--color-brand-accent)]/5 px-6 md:px-8 py-6 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                              <Sparkles className="h-24 w-24 text-[var(--color-brand-accent)]" />
                            </div>
                            <h4 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[var(--color-brand-accent)]">
                              <Sparkles className="h-4 w-4" /> Final Synthesis
                            </h4>
                            <div className="text-[0.95rem] leading-relaxed text-[var(--color-brand-text)]/90 z-10 relative">
                              {renderMarkdown(turn.synthesis.combined_recommendation || "The council returned a synthesis.")}
                            </div>
                            
                            {turn.synthesis.next_step && turn.synthesis.next_step !== turn.synthesis.combined_recommendation && (
                              <div className="mt-5 pt-5 border-t border-[var(--color-brand-accent)]/20 z-10 relative">
                                <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-[var(--color-brand-text)]/50">Next Step</span>
                                <div className="text-[0.95rem] leading-relaxed text-[var(--color-brand-text)]/80">
                                   {renderMarkdown(turn.synthesis.next_step)}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}

              {isSending && (
                <div className="flex animate-pulse items-center gap-3 pt-4 pl-2 md:pl-16">
                  <div className="flex space-x-1 duration-1000">
                    <div className="h-2.5 w-2.5 rounded-full bg-[var(--color-brand-accent)]" style={{ animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '-0.32s' }} />
                    <div className="h-2.5 w-2.5 rounded-full bg-[var(--color-brand-accent)]" style={{ animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '-0.16s' }} />
                    <div className="h-2.5 w-2.5 rounded-full bg-[var(--color-brand-accent)]" style={{ animation: 'bounce 1.4s infinite ease-in-out both' }} />
                  </div>
                  <span className="text-sm font-mono tracking-widest uppercase text-[var(--color-brand-accent)]/60">Deliberating</span>
                </div>
              )}
              
              <div ref={scrollRef} className="h-10 w-full" />
            </div>
          )}
        </div>
      </div>

      {/* INPUT AREA */}
      {!showBuilder && readyToChat && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--color-brand-primary)] via-[var(--color-brand-primary)]/95 to-transparent pt-12 pb-6 md:pb-8 px-4 md:px-8 pointer-events-none z-20">
          <div className="mx-auto max-w-3xl lg:max-w-4xl pointer-events-auto">
            <form onSubmit={handleSendMessage} className="relative shadow-2xl rounded-[2rem] group border border-[var(--color-brand-text)]/10 bg-[#000000]/60 backdrop-blur-2xl transition-all focus-within:border-[var(--color-brand-accent)]/50 focus-within:bg-[#000000]/80">
              <textarea
                ref={textareaRef}
                rows={1}
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  handleTextareaInput();
                }}
                onKeyDown={handleKeyDown}
                className="w-full resize-none bg-transparent pl-6 pr-16 py-5 text-[1rem] leading-relaxed text-[var(--color-brand-text)] placeholder:text-[var(--color-brand-text)]/40 outline-none max-h-[250px] custom-scrollbar"
                placeholder="Message the council..."
                style={{ minHeight: '64px' }}
              />
              <div className="absolute bottom-2.5 right-2.5">
                <button
                  type="submit"
                  disabled={isSending || !prompt.trim()}
                  className="flex h-11 w-11 items-center justify-center rounded-[1.2rem] bg-[var(--color-brand-text)] text-[#000000] transition hover:bg-[var(--color-brand-accent)] disabled:cursor-not-allowed disabled:bg-[var(--color-brand-text)]/10 disabled:text-[var(--color-brand-text)]/40 hover:scale-[1.05] active:scale-[0.95]"
                >
                  {isSending ? (
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5 ml-1" />
                  )}
                </button>
              </div>
            </form>
            <div className="mt-3 text-center">
               <span className="text-[11px] tracking-wider text-[var(--color-brand-text)]/30 font-medium font-sans">
                 Consilium synthesizes distinct worldviews. Results may vary.
               </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
