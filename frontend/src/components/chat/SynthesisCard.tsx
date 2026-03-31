"use client";

import ReactMarkdown from "react-markdown";
import { PersonaMessage, Synthesis } from "@/lib/api";

type Props = {
  synthesis?: Synthesis | null;
  personaResponses?: PersonaMessage[];
  pendingNames?: string[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: (() => void) | null;
};

export function SynthesisCard({
  synthesis,
  personaResponses = [],
  pendingNames = [],
  isLoading = false,
  error,
  onRetry,
}: Props) {
  const hasResponses = personaResponses.length > 0;
  const synthesisSummary =
    synthesis?.combined_recommendation || synthesis?.next_step || null;

  return (
    <div className="relative mt-4 w-full">
      <div className="w-full">
        <div className="space-y-8">
          {hasResponses
            ? personaResponses.map((response, index) => (
                <div
                  key={response.id}
                  className={index === 0 ? "" : "relative pt-8 before:absolute before:left-1/2 before:top-0 before:h-px before:w-[60%] before:-translate-x-1/2 before:bg-[var(--color-border-strong)]"}
                >
                  <div className="mb-4 flex items-center gap-3 text-white">
                    <h4 className="font-serif text-xl italic tracking-tight text-[var(--color-accent)]">
                      {response.persona_name}
                    </h4>
                    {response.latency_ms ? (
                      <span className="text-xs font-mono tracking-[0.2em] text-[var(--color-text-tertiary)]">
                        | {response.latency_ms}ms
                      </span>
                    ) : null}
                  </div>
                  <div className="prose prose-invert prose-sm max-w-none prose-p:my-0 prose-p:text-[0.925rem] prose-p:leading-relaxed prose-p:text-[var(--color-text-secondary)]">
                    <ReactMarkdown>
                      {response.status === "failed" || !response.content
                        ? "Unable to complete this advisor response."
                        : response.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ))
            : null}

          {isLoading
            ? pendingNames.map((name, index) => (
                <div
                  key={name}
                  className={index === 0 ? "" : "relative pt-8 before:absolute before:left-1/2 before:top-0 before:h-px before:w-[60%] before:-translate-x-1/2 before:bg-[var(--color-border-strong)]"}
                >
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h4 className="truncate font-serif text-xl italic tracking-tight text-[var(--color-accent)]">
                        {name}
                      </h4>
                    </div>
                    <div className="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-[var(--color-accent)]/40 border-t-[var(--color-accent)]" />
                  </div>
                  <div className="space-y-3">
                    <div className="h-3 w-full rounded-full bg-[var(--color-surface-hover)]" />
                    <div className="h-3 w-5/6 rounded-full bg-[var(--color-surface-hover)]" />
                    <div className="h-3 w-2/3 rounded-full bg-[var(--color-surface-hover)]" />
                  </div>
                </div>
              ))
            : null}

          {synthesis && (
            <div className={`${hasResponses ? "relative pt-8 before:absolute before:left-1/2 before:top-0 before:h-px before:w-[60%] before:-translate-x-1/2 before:bg-[var(--color-border-strong)]" : ""} space-y-6`}>
              {synthesisSummary ? (
                <p className="text-[0.925rem] leading-relaxed text-[var(--color-text-secondary)]">
                  <span className="font-serif text-xl italic tracking-tight text-[var(--color-success)]">
                    Synthesis:
                  </span>{" "}
                  {synthesisSummary}
                </p>
              ) : null}
            </div>
          )}

          {error ? (
            <div className="rounded-3xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/8 p-5 text-left">
              <p className="text-sm font-medium text-white">This consult did not complete.</p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{error}</p>
              {onRetry ? (
                <button
                  onClick={onRetry}
                  className="mt-4 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-white transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                >
                  Retry Consult
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
