"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export default function Features() {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      // Entrance animation for the whole section
      gsap.from(".feature-card", {
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 80%",
        },
        y: 60,
        opacity: 0,
        duration: 1,
        stagger: 0.15,
        ease: "power3.out",
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} id="features" className="py-32 px-4 md:px-16 bg-[var(--color-brand-primary)]">
      <div className="max-w-7xl mx-auto">
        <div className="mb-20 text-center">
          <h2 className="text-sm font-mono tracking-widest text-[var(--color-brand-accent)] uppercase mb-4">How It Works</h2>
          <p className="text-4xl md:text-5xl font-serif italic max-w-2xl mx-auto">Three steps to a better decision.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <DiagnosticShufflerCard />
          <TelemetryTypewriterCard />
          <CursorProtocolCard />
        </div>
      </div>
    </section>
  );
}

// Card 1: Diagnostic Shuffler "Build your council"
function DiagnosticShufflerCard() {
  const cards = ["Advisor: Marcus", "Advisor: Custom", "Advisor: Naval"];
  const [order, setOrder] = useState([0, 1, 2]);

  useEffect(() => {
    const interval = setInterval(() => {
      setOrder(prev => {
        const newArr = [...prev];
        const last = newArr.pop();
        if (last !== undefined) newArr.unshift(last);
        return newArr;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="feature-card relative bg-[var(--color-brand-text)]/5 border border-[var(--color-brand-text)]/10 rounded-[2rem] p-8 h-[400px] flex flex-col items-center justify-end overflow-hidden group">

      {/* Interactive Micro UI */}
      <div className="absolute top-12 w-full h-[200px] flex items-center justify-center">
        {order.map((itemIndex, i) => {
          // i is current visual position (0 = top/front, 1 = middle, 2 = back)
          const yOffset = i * 20;
          const scale = 1 - (i * 0.05);
          const opacity = 1 - (i * 0.3);
          const zIndex = 30 - i;

          return (
            <div
              key={itemIndex}
              className="absolute w-48 h-16 rounded-xl bg-[var(--color-brand-surface)] border border-[var(--color-brand-text)]/10 shadow-2xl flex items-center px-4 transition-all duration-700"
              style={{
                transform: `translateY(${yOffset}px) scale(${scale})`,
                opacity,
                zIndex,
                transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)"
              }}
            >
              <div className="w-6 h-6 rounded-full bg-[var(--color-brand-text)]/10 mr-3" />
              <span className="text-xs font-medium text-[var(--color-brand-text)] opacity-80">{cards[itemIndex]}</span>
            </div>
          );
        })}
      </div>

      <div className="text-center relative z-40 mt-auto">
        <h3 className="text-xl font-sans font-bold mb-2 text-[var(--color-brand-text)]">Draft your round table</h3>
        <p className="text-sm text-[var(--color-brand-text)] opacity-60">Pick 3–5 advisors. Form an elite, private circle tailored to your challenge.</p>
      </div>
    </div>
  );
}

// Card 2: Telemetry Typewriter "Ask anything"
function TelemetryTypewriterCard() {
  const textToType = "> Distributing query to council...\n> Awaiting independent analysis...\n> Gathering 5 distinct paradigms.";
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    let i = 0;
    const typingInterval = setInterval(() => {
      setDisplayedText(textToType.slice(0, i));
      i++;
      if (i > textToType.length) i = 0; // loop for demo
    }, 100);
    return () => clearInterval(typingInterval);
  }, []);

  return (
    <div className="feature-card relative bg-[var(--color-brand-text)]/5 border border-[var(--color-brand-text)]/10 rounded-[2rem] p-8 h-[400px] flex flex-col overflow-hidden group">

      {/* Interactive Micro UI */}
      <div className="flex-1 w-full bg-[var(--color-brand-surface)] rounded-xl border border-[var(--color-brand-text)]/10 p-4 mb-6 relative overflow-hidden">
        <div className="flex items-center gap-2 mb-4 opacity-50">
          <div className="w-2 h-2 rounded-full bg-[var(--color-brand-accent)] animate-pulse" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-brand-accent)]">Live Matrix</span>
        </div>
        <pre className="text-[11px] font-mono text-[var(--color-brand-accent)] leading-relaxed whitespace-pre-wrap" aria-live="polite">
          {displayedText}
          <span className="inline-block w-2 h-3 bg-[var(--color-brand-text)] ml-1 animate-pulse" />
        </pre>
      </div>

      <div className="text-center mt-auto">
        <h3 className="text-xl font-sans font-bold mb-2 text-[var(--color-brand-text)]">Ignite the debate</h3>
        <p className="text-sm text-[var(--color-brand-text)] opacity-60">Submit your query and watch independent paradigms clash and align in real-time.</p>
      </div>
    </div>
  );
}

// Card 3: Cursor Protocol Scheduler "See the full picture"
// Adapted the "scheduler" concept to fit the synthesis/disagreement requirement
function CursorProtocolCard() {
  const svgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ repeat: -1 });

      // Reset
      tl.set(".protocol-cursor", { x: 20, y: 100, opacity: 0 });
      tl.set(".protocol-highlight", { backgroundColor: "transparent", borderColor: "rgba(250,248,245,0.05)" });

      // Enter and move to "Synthesis"
      tl.to(".protocol-cursor", { opacity: 1, duration: 0.3 });
      tl.to(".protocol-cursor", { x: 140, y: 40, duration: 1, ease: "power2.inOut" });

      // Click simulation
      tl.to(".protocol-cursor", { scale: 0.8, duration: 0.1 });
      tl.to(".protocol-cursor", { scale: 1, duration: 0.1 });

      // Activate Synthesis block
      tl.to(".protocol-highlight", {
        backgroundColor: "rgba(201, 168, 76, 0.1)", // Champagne hint
        borderColor: "rgba(201, 168, 76, 0.4)",
        duration: 0.3
      }, "-=0.1");

      // Pause, then exit
      tl.to(".protocol-cursor", { x: 250, y: 150, opacity: 0, duration: 1, ease: "power2.in", delay: 1 });
      tl.to(".protocol-highlight", {
        backgroundColor: "transparent",
        borderColor: "rgba(250,248,245,0.05)",
        duration: 0.5
      });

    }, svgRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="feature-card relative bg-[var(--color-brand-text)]/5 border border-[var(--color-brand-text)]/10 rounded-[2rem] p-8 h-[400px] flex flex-col overflow-hidden group">

      {/* Interactive Micro UI */}
      <div ref={svgRef} className="flex-1 w-full flex items-center justify-center relative mb-6">

        <div className="w-full max-w-[200px] space-y-2">
          <div className="h-8 rounded-lg border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-text)]/20" />
          <div className="h-8 rounded-lg border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-text)]/20" />
          <div className="protocol-highlight h-16 rounded-lg border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-text)]/20 flex flex-col justify-center px-4 transition-colors">
            <div className="w-1/2 h-2 bg-[var(--color-brand-text)]/30 rounded mb-2" />
            <div className="w-3/4 h-2 bg-[var(--color-brand-text)]/20 rounded" />
          </div>
        </div>

        {/* Animated Custom Cursor SVG inside the card */}
        <svg
          className="protocol-cursor absolute top-0 left-0 w-6 h-6 drop-shadow-lg z-50 text-white"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" fill="white" />
        </svg>

      </div>

      <div className="text-center mt-auto">
        <h3 className="text-xl font-sans font-bold mb-2 text-[var(--color-brand-text)]">Extract the synthesis</h3>
        <p className="text-sm text-[var(--color-brand-text)] opacity-60">Isolate the consensus, reveal the blind spots, and take decisive action.</p>
      </div>
    </div>
  );
}
