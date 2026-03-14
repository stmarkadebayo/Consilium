"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LoaderCircle, Send, ArrowLeft, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { api, type Conversation, type ConversationTurn } from "@/lib/api";

const MOCK_TURNS: ConversationTurn[] = [
  {
    user_message: {
      id: "um1",
      content: "Should I raise a seed round now, or stay profitable for another six months?",
      created_at: new Date(Date.now() - 600000).toISOString(),
    },
    persona_responses: [],
    synthesis: null,
  },
];

export default function SessionPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const isNewSession = sessionId === "new";

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(!isNewSession);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNewSession) {
      setTurns(MOCK_TURNS);
      setConversation({ id: "new", title: "New Debate Session", turns: MOCK_TURNS });
      setIsLoading(false);
      return;
    }

    async function load() {
      try {
        const conv = await api.getConversation(sessionId);
        setConversation(conv);
        setTurns(conv.turns.length > 0 ? conv.turns : MOCK_TURNS);
      } catch {
        setError("Failed to load conversation.");
        setTurns(MOCK_TURNS);
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [sessionId, isNewSession]);

  if (isLoading) {
    return (
      <div className="w-full h-[80vh] flex items-center justify-center">
        <LoaderCircle className="w-8 h-8 animate-spin text-[var(--color-brand-accent)]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="shrink-0 px-4 md:px-8 lg:px-12 py-4 border-b border-[var(--color-brand-text)]/10 bg-[color-mix(in_srgb,var(--color-brand-primary)_90%,transparent)] backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/app"
              className="p-2 rounded-xl hover:bg-[var(--color-brand-text)]/5 text-[var(--color-brand-text)]/60 hover:text-[var(--color-brand-text)] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-[var(--color-brand-text)] truncate max-w-md">
                {conversation?.title || "Live Session"}
              </h1>
              <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-brand-text)]/40">
                {turns.length} {turns.length === 1 ? "Round" : "Rounds"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 lg:px-12 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
            </div>
          )}

          {turns.map((turn) => (
            <div key={turn.user_message.id} className="flex justify-end">
              <div className="max-w-[80%] bg-[var(--color-brand-text)] text-[var(--color-brand-primary)] px-6 py-4 rounded-[1.5rem] rounded-br-lg">
                <p className="text-sm md:text-base leading-relaxed font-medium">
                  {turn.user_message.content}
                </p>
                <p className="text-[10px] mt-2 opacity-50 text-right font-mono">
                  {new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(turn.user_message.created_at))}
                </p>
              </div>
            </div>
          ))}
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
