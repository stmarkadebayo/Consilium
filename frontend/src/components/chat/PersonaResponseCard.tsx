"use client";

import { PersonaMessage } from "@/lib/api";
import ReactMarkdown from "react-markdown";

export function PersonaResponseCard({ message }: { message: PersonaMessage }) {
  if (message.status === "failed" || !message.content) {
     return (
        <div className="flex flex-col p-6 rounded-3xl bg-[var(--color-surface-hover)] border border-[var(--color-error)] opacity-80 h-full">
            <h3 className="font-serif italic text-lg text-white mb-4 line-through decoration-[var(--color-error)]">{message.persona_name}</h3>
            <p className="text-sm text-[var(--color-error)]">Failed to generate response due to insufficient grounding or system error.</p>
        </div>
     );
  }

  // Determine border/glow based on stance or answer_mode (MVP simplification)
  const isNoBasis = message.answer_mode === "no_basis";

  return (
    <div className={`flex flex-col h-full bg-[var(--color-surface)] rounded-3xl p-6 md:p-8 transition-colors ${isNoBasis ? "border border-[var(--color-border-strong)] opacity-60" : "border border-[var(--color-border)] shadow-xl glass hover:border-[var(--color-border-strong)]"}`}>
      <div className="flex justify-between items-start mb-6">
          <h3 className="font-serif italic text-2xl text-white tracking-tight leading-none truncate pr-4">
              {message.persona_name}
          </h3>
          {message.answer_mode && !isNoBasis && (
              <span className="shrink-0 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--color-accent)] bg-[var(--color-accent-muted)] border border-[var(--color-accent)]/20">
                  {message.answer_mode}
              </span>
          )}
      </div>
      
      {message.stance && !isNoBasis && (
          <div className="mb-4 text-xs font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">
              Stance:<span className="ml-2 text-[var(--color-text)] normal-case">{message.stance}</span>
          </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-[140px] prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-p:text-[var(--color-text-secondary)]">
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>

      <div className="mt-6 pt-4 border-t border-[var(--color-border-strong)] flex justify-between items-center text-xs font-mono text-[var(--color-text-tertiary)] uppercase tracking-wider">
        <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-tertiary)]" style={{ opacity: message.confidence || 0.5 }} />
            <span>CONF: {((message.confidence || 0) * 100).toFixed(0)}%</span>
        </div>
        {message.latency_ms && (
           <span>{message.latency_ms}ms</span>
        )}
      </div>
    </div>
  );
}
