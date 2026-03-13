"use client";

import { Check } from "lucide-react";
import Link from "next/link";

export default function Pricing() {
  const tiers = [
    {
      name: "Free",
      price: "$0",
      description: "Everything you need to build a personal council.",
      features: [
        "1 Council (up to 5 advisors)",
        "Real-person and custom personas",
        "Full synthesis and reasoning",
        "Unlimited conversation history",
      ],
      isPopular: true,
      buttonText: "Get Started Free",
    },
    {
      name: "Premium",
      price: "$10",
      interval: "/mo",
      description: "Advanced tools for the power decision-maker.",
      features: [
        "Multiple named councils",
        "Multi-round advisor debates",
        "Single-advisor follow-up threads",
        "Enhanced persona research & refresh",
        "Conversation branching & export",
        "Priority model access",
      ],
      isPopular: false,
      buttonText: "Upgrade to Premium",
    },
  ];

  return (
    <section id="pricing" className="relative z-20 py-32 px-4 md:px-16 bg-[var(--color-brand-background)]">
      <div className="max-w-5xl mx-auto">
        
        <div className="text-center mb-16">
           <h2 className="text-3xl md:text-5xl font-sans font-bold tracking-tight mb-4 text-[var(--color-brand-text)]">
              Pricing that respects your intelligence.
           </h2>
           <p className="text-lg text-[var(--color-brand-text)] opacity-60 font-serif italic max-w-2xl mx-auto">
              The core advisory loop is free forever. Upgrade for depth, not access.
           </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 max-w-4xl mx-auto">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col p-8 rounded-[2rem] border transition-all hover:-translate-y-1 duration-300 ${
                tier.isPopular
                  ? "bg-[var(--color-brand-text)]/5 border-[var(--color-brand-text)]/20 shadow-xl"
                  : "bg-transparent border-[var(--color-brand-text)]/10 text-[var(--color-brand-text)] opacity-80"
              }`}
            >
              {tier.isPopular && (
                <div className="absolute top-0 right-8 -translate-y-1/2">
                  <span className="bg-[var(--color-brand-accent)] text-[var(--color-brand-primary)] text-xs font-bold uppercase tracking-widest py-1 px-3 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
                <p className="text-sm opacity-80 min-h-[40px]">{tier.description}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-serif italic font-bold text-[var(--color-brand-text)]">{tier.price}</span>
                  {tier.interval && <span className="text-sm opacity-60 font-medium">{tier.interval}</span>}
                </div>
              </div>

              <ul className="flex flex-col gap-4 flex-1 mb-8">
                {tier.features.map((feature, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <Check className="w-5 h-5 shrink-0 text-[var(--color-brand-accent)]" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/auth"
                className={`block w-full rounded-full py-4 text-center font-bold transition-all ${
                  tier.isPopular
                    ? "bg-[var(--color-brand-text)] text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-accent)]"
                    : "bg-[var(--color-brand-text)]/5 hover:bg-[var(--color-brand-text)]/10 text-[var(--color-brand-text)]"
                }`}
                style={{ transitionTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)" }}
              >
                {tier.buttonText}
              </Link>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
