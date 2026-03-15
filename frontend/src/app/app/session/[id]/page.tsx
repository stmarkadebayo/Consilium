"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, LoaderCircle, Sparkles } from "lucide-react";

import { api, pollJobUntilSettled, type Conversation } from "@/lib/api";

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

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const requestedSessionId = params.id as string;
  const isDraftSession = requestedSessionId === "new";
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(!isDraftSession);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversationId = isDraftSession ? conversation?.id ?? null : requestedSessionId;

  useEffect(() => {
    if (isDraftSession) {
      setConversation(null);
      setIsLoading(false);
      return;
    }

    async function loadConversation() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const loadedConversation = await api.getConversation(requestedSessionId);
        setConversation(loadedConversation);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to load conversation.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadConversation();
  }, [isDraftSession, requestedSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.turns]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt.trim() || isSending) {
      return;
    }

    setIsSending(true);
    setErrorMessage(null);
    setStatusMessage("Consulting the council...");

    try {
      let nextConversationId = conversationId;
      if (!nextConversationId) {
        const createdConversation = await api.createConversation(
          prompt.length > 44 ? `${prompt.slice(0, 44)}...` : prompt,
        );
        nextConversationId = createdConversation.id;
        router.replace(`/app/session/${createdConversation.id}`);
      }

      const submission = await api.submitMessage(nextConversationId, prompt.trim());
      await pollJobUntilSettled(submission.job_id);
      const refreshedConversation = await api.getConversation(nextConversationId);
      setConversation(refreshedConversation);
      setPrompt("");
      setStatusMessage("The council has responded.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to run the council query.");
      setStatusMessage(null);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-[var(--color-brand-accent)]" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--color-brand-text)]/10 bg-[color-mix(in_srgb,var(--color-brand-primary)_90%,transparent)] px-4 py-4 backdrop-blur-md md:px-8 lg:px-12">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/app"
              className="rounded-xl p-2 text-[var(--color-brand-text)]/60 transition-colors hover:bg-[var(--color-brand-text)]/5 hover:text-[var(--color-brand-text)]"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="max-w-md truncate text-lg font-bold text-[var(--color-brand-text)]">
                {conversation?.title || "New debate session"}
              </h1>
              <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-brand-text)]/40">
                {conversation?.turns.length ?? 0} {(conversation?.turns.length ?? 0) === 1 ? "round" : "rounds"}
              </p>
            </div>
          </div>
          <div className="rounded-full border border-[var(--color-brand-accent)]/20 bg-[var(--color-brand-accent)]/10 px-3 py-1.5 text-xs font-mono uppercase tracking-widest text-[var(--color-brand-accent)]">
            queued jobs
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8 lg:px-12">
        <div className="mx-auto max-w-4xl space-y-6">
          {(statusMessage || errorMessage) && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                errorMessage
                  ? "border-red-500/20 bg-red-500/10 text-red-300"
                  : "border-[var(--color-brand-accent)]/20 bg-[var(--color-brand-accent)]/10 text-[var(--color-brand-text)]"
              }`}
            >
              {errorMessage ?? statusMessage}
            </div>
          )}

          {(conversation?.turns.length ?? 0) === 0 && (
            <div className="rounded-[2rem] border border-dashed border-[var(--color-brand-text)]/15 bg-[var(--color-brand-surface)] px-6 py-10 text-center">
              <Sparkles className="mx-auto h-10 w-10 text-[var(--color-brand-accent)]/70" />
              <h2 className="mt-4 text-xl font-semibold text-[var(--color-brand-text)]">Start the first round</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--color-brand-text)]/60">
                Ask a concrete question. The backend will dispatch it to each active advisor, store the
                responses, then add a synthesis once the job completes.
              </p>
            </div>
          )}

          {conversation?.turns.map((turn) => (
            <article key={turn.user_message.id} className="space-y-4">
              <div className="rounded-[1.5rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-text)] text-[var(--color-brand-primary)] px-5 py-4">
                <p className="text-xs font-mono uppercase tracking-[0.2em] opacity-60">
                  You · {formatDate(turn.user_message.created_at)}
                </p>
                <p className="mt-3 text-sm leading-7 md:text-base">{turn.user_message.content}</p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {turn.persona_responses.map((response) => (
                  <div
                    key={response.id}
                    className="rounded-[1.5rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-surface)] px-5 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-[var(--color-brand-text)]">{response.persona_name}</p>
                        <p className="mt-1 text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-text)]/40">
                          {response.response_type.replace("_", " ")}
                        </p>
                      </div>
                      <span className="rounded-full border border-[var(--color-brand-text)]/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-[var(--color-brand-accent)]">
                        {response.status}
                      </span>
                    </div>

                    <p className="mt-4 text-sm font-medium leading-6 text-[var(--color-brand-text)]">
                      {response.verdict || "No verdict returned."}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[var(--color-brand-text)]/65">
                      {response.reasoning || "No reasoning returned."}
                    </p>

                    {response.recommended_action && (
                      <div className="mt-4 rounded-2xl border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-text)]/5 px-4 py-3 text-sm leading-6 text-[var(--color-brand-text)]/80">
                        <span className="block text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-text)]/45">
                          Recommended action
                        </span>
                        <span className="mt-2 block">{response.recommended_action}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {turn.synthesis && (
                <div className="rounded-[1.75rem] border border-[var(--color-brand-accent)]/20 bg-[var(--color-brand-accent)]/8 px-5 py-5">
                  <p className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-accent)]">
                    Synthesis
                  </p>
                  <p className="mt-3 text-base leading-7 text-[var(--color-brand-text)]">
                    {turn.synthesis.combined_recommendation || "No combined recommendation yet."}
                  </p>

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[1.5rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-surface)] px-4 py-4">
                      <p className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-text)]/45">
                        Agreements
                      </p>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--color-brand-text)]/75">
                        {turn.synthesis.agreements.map((agreement) => (
                          <li key={agreement}>• {agreement}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-[1.5rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-surface)] px-4 py-4">
                      <p className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-text)]/45">
                        Disagreements
                      </p>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--color-brand-text)]/75">
                        {turn.synthesis.disagreements.map((disagreement) => (
                          <li key={disagreement}>• {disagreement}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {turn.synthesis.next_step && (
                    <div className="mt-4 rounded-[1.5rem] border border-[var(--color-brand-accent)]/20 bg-[var(--color-brand-text)]/5 px-4 py-4 text-sm leading-6 text-[var(--color-brand-text)]/85">
                      <span className="block text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-accent)]">
                        Most actionable next step
                      </span>
                      <span className="mt-2 block">{turn.synthesis.next_step}</span>
                    </div>
                  )}
                </div>
              )}
            </article>
          ))}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-[var(--color-brand-text)]/10 px-4 py-4 md:px-8 lg:px-12">
        <div className="mx-auto max-w-4xl">
          {errorMessage && (
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <label className="grid gap-3">
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-text)]/45">
              Ask the council
            </span>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_PROMPTS.map((samplePrompt) => (
                <button
                  key={samplePrompt}
                  type="button"
                  onClick={() => setPrompt(samplePrompt)}
                  className="rounded-full border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-text)]/5 px-3 py-2 text-left text-xs leading-5 text-[var(--color-brand-text)]/70 transition hover:border-[var(--color-brand-text)]/20 hover:bg-[var(--color-brand-text)]/10"
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
              className="rounded-[1.5rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-surface)] px-4 py-3 text-sm leading-6 outline-none transition focus:border-[var(--color-brand-accent)] disabled:opacity-60"
              disabled={isSending}
            />
          </label>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm leading-6 text-[var(--color-brand-text)]/55">
              Queries run as background jobs. If the council roster is incomplete, the backend will reject the run.
            </p>
            <button
              type="submit"
              disabled={isSending || !prompt.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-brand-text)] px-5 py-3 text-sm font-semibold text-[var(--color-brand-primary)] transition hover:bg-[var(--color-brand-accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSending ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Asking council
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Run council query
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
