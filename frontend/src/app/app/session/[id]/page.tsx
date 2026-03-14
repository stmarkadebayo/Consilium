"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";

export default function SessionPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const [prompt, setPrompt] = useState("");

  return (
    <div className="flex flex-col h-full">
      <header className="shrink-0 px-4 md:px-8 lg:px-12 py-4 border-b border-[var(--color-brand-text)]/10 bg-[color-mix(in_srgb,var(--color-brand-primary)_90%,transparent)] backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link
            href="/app"
            className="p-2 rounded-xl hover:bg-[var(--color-brand-text)]/5 text-[var(--color-brand-text)]/60 hover:text-[var(--color-brand-text)] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-[var(--color-brand-text)] truncate max-w-md">
              Session {sessionId}
            </h1>
            <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-brand-text)]/40">
              Session workspace
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 lg:px-12 py-8">
        <div className="max-w-4xl mx-auto rounded-[2rem] border border-dashed border-[var(--color-brand-text)]/20 p-10 text-center text-[var(--color-brand-text)]/60">
          Live council messages will appear here.
        </div>
      </div>

      <div className="shrink-0 border-t border-[var(--color-brand-text)]/10 bg-[color-mix(in_srgb,var(--color-brand-primary)_90%,transparent)] backdrop-blur-md px-4 md:px-8 lg:px-12 py-4">
        <form className="max-w-4xl mx-auto flex items-center gap-3">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="flex-1 rounded-2xl border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-surface)] px-5 py-4 text-sm text-[var(--color-brand-text)] outline-none transition-all focus:border-[var(--color-brand-accent)] placeholder:text-[var(--color-brand-text)]/30"
            placeholder="Ask the council a decision-quality question..."
          />
          <button
            type="submit"
            className="shrink-0 w-12 h-12 rounded-full bg-[var(--color-brand-text)] text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-accent)] flex items-center justify-center transition-all duration-300"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
