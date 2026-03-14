"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { LoaderCircle, Send, ArrowLeft, Sparkles, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { api, type Conversation, type ConversationTurn, type PersonaResponse, type Synthesis } from "@/lib/api";

/* ── Mock Data for Live Development ─────────────────────────────── */
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
        reasoning: "You have leverage when you don't need the money. Six more months of profitability gives you a significantly better negotiating position and more data on unit economics. The fundraising environment favors founders who can demonstrate capital efficiency.",
        recommended_action: "Track your burn multiple and revenue growth for 6 months, then approach investors from a position of strength.",
        confidence: 0.82,
        status: "completed",
        latency_ms: 1200,
        evidence_snippets: [],
      },
      {
        id: "pr2",
        persona_name: "The Operator",
        response_type: "answer",
        verdict: "Raise now if you have a clear use of funds",
        reasoning: "The question isn't timing — it's whether you have a specific, high-conviction use of capital that would meaningfully accelerate growth. If you can deploy the capital into a proven channel within 90 days, raise now. If you're raising 'just in case,' wait.",
        recommended_action: "Write your deployment plan first. If you can articulate exactly how $X turns into $3X within 12 months, proceed with fundraising.",
        confidence: 0.75,
        status: "completed",
        latency_ms: 1100,
        evidence_snippets: [],
      },
      {
        id: "pr3",
        persona_name: "The Skeptic",
        response_type: "answer",
        verdict: "Neither — reframe the question",
        reasoning: "The binary framing is a trap. Raising a seed round and staying profitable aren't mutually exclusive. The real question is: what specific risk are you trying to mitigate? If it's runway risk, you don't need it (you're profitable). If it's speed risk, quantify the opportunity cost of waiting.",
        recommended_action: "Identify the single biggest growth bottleneck. If it's solvable with capital, raise. If it's solvable with focus, don't.",
        confidence: 0.88,
        status: "completed",
        latency_ms: 950,
        evidence_snippets: [],
      },
    ],
    synthesis: {
      id: "s1",
      agreements: [
        "All three advisors agree that having a clear deployment plan is essential before raising.",
        "Capital efficiency is a strategic asset — don't dilute it without deliberate purpose.",
      ],
      disagreements: [
        "The Strategist emphasizes timing leverage, favoring delay. The Operator prioritizes speed-to-deployment, favoring raising now if there's a clear use case.",
        "The Skeptic challenges the binary framing entirely, suggesting the question itself needs restructuring.",
      ],
      next_step: "Write a 90-day capital deployment plan. If you can confidently articulate how raised capital creates 3x+ returns within 12 months, begin fundraising immediately. Otherwise, revisit in 3 months.",
      combined_recommendation: "Defer the raise by 3-6 months while building a precise deployment thesis, then approach investors from a position of demonstrated growth and clear capital allocation strategy.",
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
      // Use mock data for new sessions
      setTurns(MOCK_TURNS);
      setConversation({ id: "new", title: "New Debate Session", turns: MOCK_TURNS });
      return;
    }

    async function load() {
      try {
        const conv = await api.getConversation(sessionId);
        setConversation(conv);
        setTurns(conv.turns.length > 0 ? conv.turns : MOCK_TURNS);
      } catch (err) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isSending) return;

    const userMessage = prompt.trim();
    setPrompt("");
    setIsSending(true);

    // Add user message optimistically
    const newTurn: ConversationTurn = {
      user_message: {
        id: `um_${Date.now()}`,
        content: userMessage,
        created_at: new Date().toISOString(),
      },
      persona_responses: [],
      synthesis: null,
    };
    setTurns(prev => [...prev, newTurn]);

    // Simulate advisor responses arriving
    setTimeout(() => {
      setTurns(prev => {
        const updated = [...prev];
        const lastTurn = { ...updated[updated.length - 1] };
        lastTurn.persona_responses = [
          {
            id: `pr_${Date.now()}_1`,
            persona_name: "The Strategist",
            response_type: "answer",
            verdict: "Consider the second-order effects",
            reasoning: `Regarding "${userMessage.slice(0, 60)}..." — The key consideration here is the downstream impact on your strategic positioning. Every decision creates a new set of options and constraints.`,
            recommended_action: "Map out the decision tree before committing.",
            confidence: 0.78,
            status: "completed",
            latency_ms: 1100,
            evidence_snippets: [],
          },
          {
            id: `pr_${Date.now()}_2`,
            persona_name: "The Operator",
            response_type: "answer",
            verdict: "Focus on execution speed",
            reasoning: `For "${userMessage.slice(0, 60)}..." — Speed of execution often matters more than perfection of strategy. The fastest path to validated learning should be your priority.`,
            recommended_action: "Identify the minimum viable test and run it this week.",
            confidence: 0.81,
            status: "completed",
            latency_ms: 900,
            evidence_snippets: [],
          },
          {
            id: `pr_${Date.now()}_3`,
            persona_name: "The Skeptic",
            response_type: "answer",
            verdict: "Challenge your assumptions",
            reasoning: `On "${userMessage.slice(0, 60)}..." — Before proceeding, identify which of your assumptions carry the most risk if they turn out to be wrong. The highest-leverage action is often to stress-test your weakest assumption.`,
            recommended_action: "List your top 3 assumptions and design a cheap test for the riskiest one.",
            confidence: 0.85,
            status: "completed",
            latency_ms: 1050,
            evidence_snippets: [],
          },
        ];
        lastTurn.synthesis = {
          id: `s_${Date.now()}`,
          agreements: ["All advisors agree on the importance of validating before committing resources."],
          disagreements: ["Speed vs thoroughness remains the core tension between The Operator and The Skeptic."],
          next_step: "Design a lightweight validation experiment that can be completed within one week.",
          combined_recommendation: "Proceed with a time-boxed experiment to test your core assumption before making a larger commitment.",
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
      {/* Header */}
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
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-mono text-green-400/80">LIVE</span>
          </div>
        </div>
      </header>

      {/* Chat Body */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 lg:px-12 py-8">
        <div className="max-w-4xl mx-auto space-y-10">
          {error && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
            </div>
          )}

          {turns.map((turn, turnIndex) => (
            <div key={turn.user_message.id} className="space-y-6">
              {/* User Message */}
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

              {/* Unified Advisor Response Container */}
              {turn.persona_responses.length > 0 && (
                <div className="bg-[var(--color-brand-surface)] border border-[var(--color-brand-text)]/10 rounded-[2rem] overflow-hidden">
                  {/* Container Header */}
                  <div className="px-6 py-4 border-b border-[var(--color-brand-text)]/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-[var(--color-brand-accent)]" />
                      <span className="text-xs font-mono uppercase tracking-widest text-[var(--color-brand-text)]/50">
                        Council Response — Round {turnIndex + 1}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--color-brand-text)]/30">
                      {turn.persona_responses.length} advisors
                    </span>
                  </div>

                  {/* Individual Advisor Responses */}
                  <div className="divide-y divide-[var(--color-brand-text)]/5">
                    {turn.persona_responses.map((response) => (
                      <AdvisorResponse key={response.id} response={response} />
                    ))}
                  </div>
                </div>
              )}

              {/* Loading indicator while waiting for responses */}
              {turn.persona_responses.length === 0 && isSending && turnIndex === turns.length - 1 && (
                <div className="bg-[var(--color-brand-surface)] border border-[var(--color-brand-text)]/10 rounded-[2rem] p-8 flex items-center justify-center gap-4">
                  <LoaderCircle className="w-6 h-6 animate-spin text-[var(--color-brand-accent)]" />
                  <span className="text-sm font-mono text-[var(--color-brand-text)]/50 uppercase tracking-widest">
                    Consulting the council...
                  </span>
                </div>
              )}

              {/* Synthesis Block */}
              {turn.synthesis && (
                <SynthesisBlock synthesis={turn.synthesis} />
              )}
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Bar */}
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
            className="shrink-0 w-12 h-12 rounded-full bg-[var(--color-brand-text)] text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-accent)] flex items-center justify-center transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed transform hover:scale-[1.05]"
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

/* ── Advisor Response Sub-Component ─────────────────────────────── */
function AdvisorResponse({ response }: { response: PersonaResponse }) {
  const confidencePercent = Math.round((response.confidence ?? 0) * 100);
  
  return (
    <div className="px-6 py-6 hover:bg-[var(--color-brand-text)]/[0.02] transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--color-brand-accent)]/15 border border-[var(--color-brand-accent)]/30 flex items-center justify-center text-sm font-bold text-[var(--color-brand-accent)]">
            {response.persona_name.charAt(0)}
          </div>
          <div>
            <h4 className="font-bold text-[var(--color-brand-text)]">{response.persona_name}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="h-1.5 w-16 bg-[var(--color-brand-text)]/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--color-brand-accent)] rounded-full transition-all duration-500"
                  style={{ width: `${confidencePercent}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-[var(--color-brand-text)]/40">{confidencePercent}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Verdict */}
      {response.verdict && (
        <div className="mb-3 px-4 py-2.5 bg-[var(--color-brand-text)]/5 rounded-xl border-l-2 border-[var(--color-brand-accent)]">
          <p className="text-sm font-bold text-[var(--color-brand-text)]">{response.verdict}</p>
        </div>
      )}

      {/* Reasoning */}
      {response.reasoning && (
        <p className="text-sm text-[var(--color-brand-text)]/70 leading-relaxed mb-4">
          {response.reasoning}
        </p>
      )}

      {/* Recommended Action */}
      {response.recommended_action && (
        <div className="flex items-start gap-2 text-xs text-[var(--color-brand-accent)]/80">
          <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span className="leading-relaxed">{response.recommended_action}</span>
        </div>
      )}
    </div>
  );
}

/* ── Synthesis Block Sub-Component ──────────────────────────────── */
function SynthesisBlock({ synthesis }: { synthesis: Synthesis }) {
  return (
    <div className="bg-[var(--color-brand-accent)]/5 border border-[var(--color-brand-accent)]/20 rounded-[2rem] p-6 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="w-5 h-5 text-[var(--color-brand-accent)]" />
        <h3 className="text-sm font-mono uppercase tracking-widest text-[var(--color-brand-accent)] font-bold">
          Extracted Synthesis
        </h3>
      </div>

      {/* Agreements */}
      {synthesis.agreements.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-mono uppercase tracking-widest text-[var(--color-brand-text)]/40 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> Agreements
          </h4>
          <ul className="space-y-2">
            {synthesis.agreements.map((item, i) => (
              <li key={i} className="text-sm text-[var(--color-brand-text)]/70 leading-relaxed pl-4 border-l-2 border-green-500/30">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Disagreements */}
      {synthesis.disagreements.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-mono uppercase tracking-widest text-[var(--color-brand-text)]/40 flex items-center gap-2">
            <XCircle className="w-3.5 h-3.5 text-red-400/80" /> Disagreements
          </h4>
          <ul className="space-y-2">
            {synthesis.disagreements.map((item, i) => (
              <li key={i} className="text-sm text-[var(--color-brand-text)]/70 leading-relaxed pl-4 border-l-2 border-red-500/30">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Step */}
      {synthesis.next_step && (
        <div className="bg-[var(--color-brand-primary)] rounded-2xl p-5 border border-[var(--color-brand-text)]/10">
          <h4 className="text-xs font-mono uppercase tracking-widest text-[var(--color-brand-accent)] mb-2">Recommended Next Step</h4>
          <p className="text-sm text-[var(--color-brand-text)] leading-relaxed font-medium">
            {synthesis.next_step}
          </p>
        </div>
      )}

      {/* Combined Recommendation */}
      {synthesis.combined_recommendation && (
        <div className="pt-4 border-t border-[var(--color-brand-accent)]/20">
          <p className="text-sm text-[var(--color-brand-text)]/60 leading-relaxed italic">
            &ldquo;{synthesis.combined_recommendation}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
