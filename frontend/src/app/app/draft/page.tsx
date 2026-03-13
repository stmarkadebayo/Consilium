"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Check, Users, Sparkles, AlertCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { api, type Persona, type Council } from "@/lib/api";

export default function DraftCouncilPage() {
  const router = useRouter();
  const [council, setCouncil] = useState<Council | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [draftingCustom, setDraftingCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customSummary, setCustomSummary] = useState("");
  const [customWorldview, setCustomWorldview] = useState("");
  const [customValues, setCustomValues] = useState("");
  const [isSavingCustom, setIsSavingCustom] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const [c, p] = await Promise.all([api.getCouncil(), api.listPersonas()]);
        setCouncil(c);
        setPersonas(p);
      } catch (err) {
        setError("Failed to load council state.");
      } finally {
        setIsLoading(false);
      }
    }
    void init();
  }, []);

  const activeCount = council?.members.filter(m => m.is_active).length ?? 0;
  const isReady = activeCount >= (council?.min_personas ?? 3);

  const togglePersonaAction = async (personaId: string) => {
    setError(null);
    try {
      await api.deactivatePersona(personaId);
      const [c, p] = await Promise.all([api.getCouncil(), api.listPersonas()]);
      setCouncil(c);
      setPersonas(p);
    } catch (err) {
      setError("Failed to update council roster.");
    }
  };

  const seedStarterMinds = async () => {
    setIsSeeding(true);
    setError(null);
    try {
      const STARTERS = [
        {
          display_name: "The Strategist",
          persona_type: "custom" as const,
          identity_summary: "A long-horizon thinker who optimizes for leverage, timing, and asymmetric upside.",
          worldview: ["Play long-term games.", "Separate signal from narrative."],
          values: ["clarity", "asymmetry"],
          communication_style: ["concise"], decision_style: ["low-regret"], blind_spots: [""], domain_confidence: {}, source_count: 0, source_quality_score: 0, add_to_council: true
        },
        {
          display_name: "The Operator",
          persona_type: "custom" as const,
          identity_summary: "An execution-first advisor who cares about sequencing, constraints, and practical delivery.",
          worldview: ["Execution reveals truth faster than theory."],
          values: ["throughput", "discipline"],
          communication_style: ["concise"], decision_style: ["actionable"], blind_spots: [""], domain_confidence: {}, source_count: 0, source_quality_score: 0, add_to_council: true
        },
        {
          display_name: "The Skeptic",
          persona_type: "custom" as const,
          identity_summary: "A risk-sensitive advisor who hunts for hidden assumptions, downside exposure, and fragility.",
          worldview: ["Every plan hides assumptions worth testing."],
          values: ["restraint", "risk control"],
          communication_style: ["structured"], decision_style: ["tradeoff-aware"], blind_spots: [""], domain_confidence: {}, source_count: 0, source_quality_score: 0, add_to_council: true
        }
      ];

      for (const starter of STARTERS) {
        if (!personas.some(p => p.display_name === starter.display_name)) {
          await api.createPersona(starter);
        }
      }
      const [c, p] = await Promise.all([api.getCouncil(), api.listPersonas()]);
      setCouncil(c);
      setPersonas(p);
    } catch (err) {
      setError("Failed to draft historical minds.");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSaveCustomPersona = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    setIsSavingCustom(true);
    try {
      await api.createPersona({
        display_name: customName,
        persona_type: "custom",
        identity_summary: customSummary,
        worldview: customWorldview.split('\n').filter(Boolean),
        values: customValues.split('\n').filter(Boolean),
        add_to_council: true
      });
      const [c, p] = await Promise.all([api.getCouncil(), api.listPersonas()]);
      setCouncil(c);
      setPersonas(p);
      setDraftingCustom(false);
      setCustomName("");
      setCustomSummary("");
      setCustomWorldview("");
      setCustomValues("");
    } catch (err) {
      setError("Failed to save custom persona.");
    } finally {
      setIsSavingCustom(false);
    }
  };

  const handleStartDebate = async () => {
    if (!isReady) return;
    router.push("/app/session/new");
  };

  if (isLoading) {
    return (
      <div className="w-full h-[80vh] flex items-center justify-center">
         <LoaderCircle className="w-8 h-8 animate-spin text-[var(--color-brand-accent)]" />
      </div>
    );
  }

  return (
    <div className="w-full min-h-full p-4 md:p-8 lg:p-12 pb-32 relative">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Header */}
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-brand-text)]/5 text-[var(--color-brand-accent)] text-sm font-medium tracking-wide border border-[var(--color-brand-text)]/10">
            <Users className="w-4 h-4" /> Step 1: Draft Roster
          </div>
          <h1 className="text-3xl md:text-5xl font-serif italic font-bold tracking-tight text-[var(--color-brand-text)]">
            Build Your Council.
          </h1>
          <p className="max-w-2xl text-[var(--color-brand-text)]/60 text-lg leading-relaxed mix-blend-plus-lighter">
            Select {council?.min_personas ?? 3} to {council?.max_personas ?? 5} advisors to form your round table. You can choose from historical archetypes or architect a custom persona.
          </p>
        </header>

        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" /> {error}
          </div>
        )}

        {/* Existing Personas Roster Grid */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-[var(--color-brand-text)]">Available Minds</h2>
            {personas.length === 0 && (
              <button 
                onClick={seedStarterMinds}
                disabled={isSeeding}
                className="flex items-center gap-2 text-sm text-[var(--color-brand-accent)] hover:underline"
              >
                {isSeeding ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Draft Historical Set
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {personas.length === 0 && (
              <div className="col-span-1 md:col-span-2 p-12 border border-dashed border-[var(--color-brand-text)]/20 rounded-[2rem] text-center max-w-2xl mx-auto w-full">
                <Users className="w-12 h-12 text-[var(--color-brand-text)]/20 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-[var(--color-brand-text)] mb-2">No Advisors Drafted</h3>
                <p className="text-[var(--color-brand-text)]/60 mb-6 text-sm">
                  Your roster is currently empty. Start by loading our curated historical array.
                </p>
                <button 
                  onClick={seedStarterMinds}
                  disabled={isSeeding}
                  className="inline-flex items-center justify-center bg-[var(--color-brand-text)]/10 text-[var(--color-brand-text)] hover:bg-[var(--color-brand-text)]/20 px-6 py-3 rounded-full font-bold transition-all duration-300 transform hover:scale-[1.02]"
                >
                  {isSeeding ? "Drafting..." : "Generate Roster"}
                </button>
              </div>
            )}

            {personas.map(persona => {
              const isActive = council?.members.some(m => m.persona_id === persona.id && m.is_active) ?? false;
              
              return (
              <div 
                key={persona.id}
                className={`relative p-6 rounded-2xl border transition-all duration-300 cursor-pointer group flex flex-col justify-between
                  ${isActive 
                    ? "bg-[var(--color-brand-text)]/5 border-[var(--color-brand-accent)] shadow-[0_0_20px_rgba(201,168,76,0.1)]" 
                    : "bg-transparent border-[var(--color-brand-text)]/10 hover:border-[var(--color-brand-text)]/30"
                  }`}
                onClick={() => togglePersonaAction(persona.id)}
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className={`w-12 h-12 rounded-full border flex items-center justify-center font-bold text-lg
                      ${isActive ? "bg-[var(--color-brand-accent)]/20 border-[var(--color-brand-accent)] text-[var(--color-brand-accent)]" : "bg-[var(--color-brand-text)]/5 border-[var(--color-brand-text)]/10 text-[var(--color-brand-text)]/60"}
                    `}>
                      {persona.display_name.charAt(0)}
                    </div>
                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors 
                      ${isActive ? "bg-[var(--color-brand-accent)] border-[var(--color-brand-accent)]" : "border-[var(--color-brand-text)]/20 group-hover:border-[var(--color-brand-text)]/50"}`}>
                      {isActive && <Check className="w-4 h-4 text-[var(--color-brand-primary)]" />}
                    </div>
                  </div>
                  <h3 className={`font-bold text-xl mb-2 transition-colors ${isActive ? "text-[var(--color-brand-accent)]" : "text-[var(--color-brand-text)] group-hover:text-[var(--color-brand-accent)]"}`}>
                    {persona.display_name}
                  </h3>
                  <p className="text-sm text-[var(--color-brand-text)]/60 line-clamp-2 md:line-clamp-3 leading-relaxed">
                    {persona.identity_summary}
                  </p>
                </div>
              </div>
            )})}

            {/* Add Custom Button */}
            {!draftingCustom && (
              <button 
                onClick={() => setDraftingCustom(true)}
                className="p-6 rounded-2xl border border-dashed border-[var(--color-brand-text)]/20 hover:border-[var(--color-brand-accent)] hover:bg-[var(--color-brand-accent)]/5 transition-all duration-300 flex flex-col items-center justify-center text-center gap-3 min-h-[16rem] group"
              >
                <div className="w-12 h-12 rounded-full border border-[var(--color-brand-text)]/20 bg-[var(--color-brand-text)]/5 flex items-center justify-center group-hover:scale-110 group-hover:border-[var(--color-brand-accent)] transition-transform">
                  <Sparkles className="w-5 h-5 text-[var(--color-brand-text)]/40 group-hover:text-[var(--color-brand-accent)]" />
                </div>
                <span className="font-bold text-[var(--color-brand-text)]/60 group-hover:text-[var(--color-brand-accent)]">Architect Custom Persona</span>
              </button>
            )}
          </div>
        </section>

        {/* Custom Persona Form Popover/Inline */}
        {draftingCustom && (
          <section className="bg-[var(--color-brand-surface)] border border-[var(--color-brand-text)]/10 p-6 md:p-8 rounded-[2rem] animate-in fade-in slide-in-from-bottom-4 duration-300 relative">
            <button 
              onClick={() => setDraftingCustom(false)}
              className="absolute top-6 right-6 p-2 rounded-full text-[var(--color-brand-text)]/40 hover:text-[var(--color-brand-text)] hover:bg-[var(--color-brand-text)]/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-[var(--color-brand-text)] mb-6 flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-[var(--color-brand-accent)]" />
              Custom Architect
            </h2>
            <form onSubmit={handleSaveCustomPersona} className="space-y-6">
              <div className="grid gap-2">
                <label className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-text)] opacity-50 pl-2">Display Name</label>
                <input 
                  required
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="rounded-2xl border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-primary)] px-5 py-4 text-sm text-[var(--color-brand-text)] outline-none transition-all focus:border-[var(--color-brand-accent)]"
                  placeholder="e.g. The Contrarian"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-text)] opacity-50 pl-2">Identity Summary</label>
                <textarea 
                  required
                  value={customSummary}
                  onChange={(e) => setCustomSummary(e.target.value)}
                  rows={2}
                  className="rounded-2xl border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-primary)] px-5 py-4 text-sm text-[var(--color-brand-text)] outline-none transition-all focus:border-[var(--color-brand-accent)] resize-none"
                  placeholder="A synthesized persona who actively searches for opposing viewpoints."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="grid gap-2">
                  <label className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-text)] opacity-50 pl-2">Worldview (Line separated)</label>
                  <textarea 
                    value={customWorldview}
                    onChange={(e) => setCustomWorldview(e.target.value)}
                    rows={3}
                    className="rounded-2xl border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-primary)] px-5 py-4 text-sm text-[var(--color-brand-text)] outline-none transition-all focus:border-[var(--color-brand-accent)] resize-none"
                    placeholder={"The majority is often wrong.\nConsensus is a warning sign."}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-text)] opacity-50 pl-2">Core Values (Line separated)</label>
                  <textarea 
                    value={customValues}
                    onChange={(e) => setCustomValues(e.target.value)}
                    rows={3}
                    className="rounded-2xl border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-primary)] px-5 py-4 text-sm text-[var(--color-brand-text)] outline-none transition-all focus:border-[var(--color-brand-accent)] resize-none"
                    placeholder={"Truth seeking\nSkepticism"}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={isSavingCustom || !customName.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--color-brand-accent)] bg-[var(--color-brand-accent)]/10 text-[var(--color-brand-accent)] hover:bg-[var(--color-brand-accent)] hover:text-[var(--color-brand-primary)] px-8 py-3 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSavingCustom ? "Assembling..." : "Add to Council"}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Sticky Action Footer */}
        <div className="fixed bottom-0 left-0 md:left-64 w-full md:w-[calc(100%-16rem)] border-t border-[var(--color-brand-text)]/10 bg-[color-mix(in_srgb,var(--color-brand-primary)_80%,transparent)] backdrop-blur-xl p-4 md:px-12 z-20 transition-all duration-300">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex flex-col">
              <div className="text-sm font-medium text-[var(--color-brand-text)] flex items-center gap-2">
                Council Size: <span className={isReady ? "text-[var(--color-brand-accent)] font-mono text-xl font-bold" : "text-[var(--color-brand-text)]/50 font-mono text-xl"}>{activeCount}</span> <span className="text-[var(--color-brand-text)]/30">/</span> <span className="font-mono text-[var(--color-brand-text)]/40 text-xs">{council?.max_personas ?? 5} Max</span>
              </div>
              {!isReady && (
                <div className="text-[10px] md:text-xs text-[var(--color-brand-text)]/40 uppercase tracking-widest mt-1">
                  Requires {council?.min_personas ?? 3} active
                </div>
              )}
            </div>
            
            <button
              onClick={handleStartDebate}
              disabled={!isReady}
              className={`px-6 md:px-8 py-3 md:py-4 rounded-full font-bold transition-all duration-300 ${
                isReady 
                  ? "bg-[var(--color-brand-text)] text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-accent)] shadow-[0_0_20px_rgba(201,168,76,0.3)] transform hover:scale-[1.02]" 
                  : "bg-[var(--color-brand-text)]/10 text-[var(--color-brand-text)]/30 cursor-not-allowed"
              }`}
            >
              Confirm Roster &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
