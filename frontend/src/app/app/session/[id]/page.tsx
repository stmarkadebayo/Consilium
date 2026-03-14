"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { LoaderCircle, Send, ArrowLeft, Sparkles, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { api, type Conversation, type ConversationTurn } from "@/lib/api";

const MOCK_TURNS: ConversationTurn[] = [
  {
    user_message: {
      id: "um1",
      content: "Should I raise a seed round now, or stay profitable for another six months?",
      created_at: new Date(Date.now() - 600000).toISOString(),
    },
    persona_responses: [
      {
        id: "pr1",
        persona_name: "The Strategist",
        response_type: "answer",
        verdict: "Stay profitable for now",
        reasoning: "You have leverage when you don't need the money. Six more months of profitability gives you a better negotiating position.",
        recommended_action: "Track your burn multiple and revenue growth for 6 months.",
        confidence: 0.82,
        status: "completed",
        latency_ms: 1200,
        evidence_snippets: [],
      },
    ],
    synthesis: {
      id: "s1",
      agreements: ["A clear deployment plan matters before raising."],
      disagreements: [],
      next_step: "Write a 90-day capital deployment plan.",
      combined_recommendation: "Defer the raise until you can justify a concrete use of funds.",
      created_at: new Date(Date.now() - 300000).toISOString(),
    },
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
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isSending) return;

    const userMessage = prompt.trim();
    setPrompt("");
    setIsSending(true);

    const newTurn: ConversationTurn = {
      user_message: {
        id: `um_${Date.now()}`,
        content: userMessage,
        created_at: new Date().toISOString(),
      },
      persona_responses: [],
      synthesis: null,
    };

    setTurns((prev) => [...prev, newTurn]);

    window.setTimeout(() => {
      setTurns((prev) => {
        const updated = [...prev];
        const lastTurn = { ...updated[updated.length - 1] };
        lastTurn.persona_responses = [
          {
            id: `pr_${Date.now()}_1`,
            persona_name: "The Strategist",
            response_type: "answer",
            verdict: "Consider the second-order effects",
            reasoning: `Regarding "${userMessage.slice(0, 60)}..." the downstream impact matters most here.`,
            recommended_action: "Map out the decision tree before committing.",
            confidence: 0.78,
            status: "completed",
            latency_ms: 1100,
            evidence_snippets: [],
          },
        ];
        lastTurn.synthesis = {
          id: `s_${Date.now()}`,
          agreements: ["Validation should come before a larger commitment."],
          disagreements: [],
          next_step: "Design a lightweight validation experiment that can be completed within one week.",
          combined_recommendation: "Proceed with a time-boxed experiment before making a larger commitment.",
          created_at: new Date().toISOString(),
        };
        updated[updated.length - 1] = lastTurn;
        return updated;
      });
      setIsSending(false);
    }, 2500);
  };

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
        <div className="max-w-4xl mx-auto space-y-10">
          {error && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
            </div>
          )}

          {turns.map((turn, turnIndex) => (
            <div key={turn.user_message.id} className="space-y-6">
              <div className="flex justify-end">
                <div className="max-w-[80%] bg-[var(--color-brand-text)] text-[var(--color-brand-primary)] px-6 py-4 rounded-[1.5rem] rounded-br-lg">
                  <p className="text-sm md:text-base leading-relaxed font-medium">
                    {turn.user_message.content}
                  </p>
                  <p className="text-[10px] mt-2 opacity-50 text-right font-mono">
                    {new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(turn.user_message.created_at))}
                  </p>
                </div>
              </div>

              {turn.persona_responses.length > 0 && (
                <div className="bg-[var(--color-brand-surface)] border border-[var(--color-brand-text)]/10 rounded-[2rem] overflow-hidden">
                  <div className="px-6 py-4 border-b border-[var(--color-brand-text)]/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-[var(--color-brand-accent)]" />
                      <span className="text-xs font-mono uppercase tracking-widest text-[var(--color-brand-text)]/50">
                        Council Response Round {turnIndex + 1}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--color-brand-text)]/30">
                      {turn.persona_responses.length} advisors
                    </span>
                  </div>
                  <div className="divide-y divide-[var(--color-brand-text)]/5">
                    {turn.persona_responses.map((response) => (
                      <div key={response.id} className="px-6 py-6 space-y-3">
                        <h4 className="font-bold text-[var(--color-brand-text)]">{response.persona_name}</h4>
                        {response.verdict && (
                          <p className="text-sm font-bold text-[var(--color-brand-text)]">{response.verdict}</p>
                        )}
                        {response.reasoning && (
                          <p className="text-sm text-[var(--color-brand-text)]/70 leading-relaxed">{response.reasoning}</p>
                        )}
                        {response.recommended_action && (
                          <div className="flex items-start gap-2 text-xs text-[var(--color-brand-accent)]/80">
                            <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span className="leading-relaxed">{response.recommended_action}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {turn.persona_responses.length === 0 && isSending && turnIndex === turns.length - 1 && (
                <div className="bg-[var(--color-brand-surface)] border border-[var(--color-brand-text)]/10 rounded-[2rem] p-8 flex items-center justify-center gap-4">
                  <LoaderCircle className="w-6 h-6 animate-spin text-[var(--color-brand-accent)]" />
                  <span className="text-sm font-mono text-[var(--color-brand-text)]/50 uppercase tracking-widest">
                    Consulting the council...
                  </span>
                </div>
              )}

              {turn.synthesis && (
                <div className="bg-[var(--color-brand-accent)]/5 border border-[var(--color-brand-accent)]/20 rounded-[2rem] p-6 md:p-8 space-y-4">
                  <h3 className="text-sm font-mono uppercase tracking-widest text-[var(--color-brand-accent)] font-bold">
                    Extracted Synthesis
                  </h3>
                  {turn.synthesis.next_step && (
                    <p className="text-sm text-[var(--color-brand-text)] leading-relaxed font-medium">
                      {turn.synthesis.next_step}
                    </p>
                  )}
                  {turn.synthesis.combined_recommendation && (
                    <p className="text-sm text-[var(--color-brand-text)]/60 leading-relaxed italic">
                      &ldquo;{turn.synthesis.combined_recommendation}&rdquo;
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-[var(--color-brand-text)]/10 bg-[color-mix(in_srgb,var(--color-brand-primary)_90%,transparent)] backdrop-blur-md px-4 md:px-8 lg:px-12 py-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex items-center gap-3">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isSending}
            className="flex-1 rounded-2xl border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-surface)] px-5 py-4 text-sm text-[var(--color-brand-text)] outline-none transition-all focus:border-[var(--color-brand-accent)] placeholder:text-[var(--color-brand-text)]/30 disabled:opacity-50"
            placeholder="Ask the council a decision-quality question..."
          />
          <button
            type="submit"
            disabled={isSending || !prompt.trim()}
            className="shrink-0 w-12 h-12 rounded-full bg-[var(--color-brand-text)] text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-accent)] flex items-center justify-center transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <LoaderCircle className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
