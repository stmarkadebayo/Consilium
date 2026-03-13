"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export default function Protocol() {
  const containerRef = useRef<HTMLElement>(null);
  
  // Create an array to map over for our 3 cards
  const steps = [
    {
      num: "01",
      title: "Assemble the Council",
      description: "Draft your advisory board. Blend historical minds with custom profiles.",
    },
    {
      num: "02",
      title: "The Cross-Examination",
      description: "Submit your query to the full council and watch parallel reasoning stream in.",
    },
    {
      num: "03",
      title: "The Final Synthesis",
      description: "Extract agreement, expose tension, and walk away with a clear next step.",
    }
  ];

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>(".protocol-card");
      
      // Each card pins on scroll
      cards.forEach((card) => {
        ScrollTrigger.create({
          trigger: card,
          start: "top top", // Pin when the card reaches the top
          pin: true,
          pinSpacing: false,
          endTrigger: containerRef.current,
          end: "bottom top", 
          // Effect: scale down and blur the pinned card as the user scrolls past it
          animation: gsap.to(card, {
            scale: 0.9,
            opacity: 0.5,
            filter: "blur(20px)",
            ease: "none"
          }),
          scrub: true,
        });
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="relative z-10 w-full bg-[var(--color-brand-primary)]">
       {/* 
         We need an explicit height for the scrolling container. 
         3 cards * 100vh = 300vh 
       */}
       {steps.map((step, index) => (
          <div 
            key={step.num} 
            className="protocol-card h-[100vh] w-full flex items-center justify-center sticky top-0 px-4"
            style={{ zIndex: index * 10 }}
          >
             <div className="w-full max-w-4xl h-[60vh] bg-[var(--color-brand-surface)] border border-[rgba(250,248,245,0.05)] rounded-[3rem] p-12 flex flex-col justify-between shadow-2xl relative overflow-hidden">
                
                {/* SVG Graphics Based on the Index */}
                <div className="absolute right-0 top-0 w-1/2 h-full opacity-30 pointer-events-none flex items-center justify-center">
                    {index === 0 && (
                      <svg className="w-64 h-64 text-[var(--color-brand-accent)] animate-spin-slow" viewBox="0 0 100 100">
                         <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="1" fill="none" strokeDasharray="10 5" />
                         <circle cx="50" cy="50" r="25" stroke="currentColor" strokeWidth="2" fill="none" />
                      </svg>
                    )}
                    {index === 1 && (
                      <div className="w-full h-full relative overflow-hidden">
                          <div className="absolute w-full h-[1px] bg-[var(--color-brand-accent)] top-1/2 animate-[scan_3s_ease-in-out_infinite]" />
                          <div className="w-full h-full bg-[radial-gradient(circle_at_center,rgba(250,248,245,0.1)_1px,transparent_1px)] bg-[length:20px_20px]" />
                      </div>
                    )}
                    {index === 2 && (
                      <svg className="w-full h-32" preserveAspectRatio="none" viewBox="0 0 100 100">
                         <path d="M0,50 L20,50 L30,20 L40,80 L50,50 L100,50" fill="none" stroke="#FAF8F5" strokeWidth="2" className="animate-[dash_2s_linear_infinite]" strokeDasharray="200" strokeDashoffset="200" />
                      </svg>
                    )}
                </div>

                <div className="font-mono text-2xl text-[var(--color-brand-accent)] relative z-10">
                   {step.num}
                </div>
                
                <div className="max-w-xl relative z-10">
                   <h2 className="text-4xl md:text-5xl font-sans font-bold tracking-tight mb-4 text-[var(--color-brand-text)]">{step.title}</h2>
                   <p className="text-lg text-[rgba(250,248,245,0.6)] font-serif italic">{step.description}</p>
                </div>
             </div>
          </div>
       ))}
    </section>
  );
}
