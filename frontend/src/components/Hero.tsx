"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import Link from "next/link";
import Image from "next/image";

export default function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const headlinePartsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const ctaRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Wait for preloader to finish (approx 3.7s total)
    const timer = setTimeout(() => {
      const ctx = gsap.context(() => {
        const tl = gsap.timeline();

        // Reveal image with subtle scale down
        tl.fromTo(
          imageRef.current,
          { scale: 1.1, autoAlpha: 0 },
          { scale: 1, autoAlpha: 1, duration: 2, ease: "power3.out" }
        );

        // Staggered fade-up for text and CTA
        tl.fromTo(
          headlinePartsRef.current,
          { y: 40, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration: 1.2,
            stagger: 0.15,
            ease: "power3.out",
          },
          "-=1.5"
        );

        tl.fromTo(
          ctaRef.current,
          { y: 20, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration: 1,
            ease: "power3.out",
          },
          "-=1"
        );
      }, heroRef);

      return () => ctx.revert();
    }, 3800);

    return () => clearTimeout(timer);
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative h-[100dvh] w-full flex flex-col justify-end pb-24 px-8 md:px-16 overflow-hidden bg-black"
    >
      {/* Background Image with Gradient Overlay */}
      <div className="absolute inset-0 w-full h-full z-0">
        <Image
          ref={imageRef}
          src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1920&q=80&auto=format" // Architecture / Editorial mood (Dark interior)
          alt="Dark architectural interior"
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-0"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-brand-primary)] via-[var(--color-brand-primary)]/80 to-transparent" />
        <div className="absolute inset-0 bg-[var(--color-brand-primary)]/40" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-5xl">
        <h1 className="flex flex-col gap-2 md:gap-4 mb-10">
          <span
            ref={(el) => { headlinePartsRef.current[0] = el; }}
            className="text-2xl md:text-3xl lg:text-4xl font-sans font-bold tracking-tight opacity-0 text-[var(--color-brand-text)]"
          >
            Your private council of
          </span>
          <span
            ref={(el) => { headlinePartsRef.current[1] = el; }}
            className="text-6xl md:text-8xl lg:text-9xl font-serif italic text-[var(--color-brand-text)] opacity-0 leading-[0.9]"
          >
            Minds.
          </span>
        </h1>

        <div ref={ctaRef} className="opacity-0 max-w-xl">
          <p className="text-lg md:text-xl text-[var(--color-brand-text)] opacity-80 mb-8 font-sans">
            Assemble a council of AI advisors. Get structured perspective, visible disagreement, and actionable synthesis — not just one answer.
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/auth"
              className="group relative overflow-hidden bg-[var(--color-brand-text)] text-[var(--color-brand-primary)] px-8 py-4 rounded-full font-medium text-base transition-transform hover:scale-[1.03] duration-300"
              style={{ transitionTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)" }}
              data-cursor-text="Start"
            >
              <span className="relative z-10 font-bold">Get Started — It&apos;s Free</span>
              <div className="absolute inset-0 h-full w-full translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out bg-[var(--color-brand-accent)] z-0" />
            </Link>
            <a href="#features" className="text-sm font-bold tracking-widest uppercase border-b border-[var(--color-brand-text)] border-opacity-30 hover:border-opacity-100 text-[var(--color-brand-text)] pb-1 transition-colors">
              How it works
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
