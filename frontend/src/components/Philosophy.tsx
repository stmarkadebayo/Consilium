"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SplitType from "split-type";
import Image from "next/image";

export default function Philosophy() {
  const sectionRef = useRef<HTMLElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      // Parallax background
      gsap.to(bgRef.current, {
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
        yPercent: 20,
        ease: "none",
      });

      // Split text logic
      if (textContainerRef.current) {
        // Need to target specific tags after mount since SplitType modifies DOM
        const smallText = new SplitType(".philosophy-small", { types: "words" });
        const largeText = new SplitType(".philosophy-large", { types: "words" });

        // Staggered reveal for the small "Most AI" text
        gsap.from(smallText.words, {
          scrollTrigger: {
            trigger: textContainerRef.current,
            start: "top 80%",
          },
          y: 20,
          opacity: 0,
          duration: 0.8,
          stagger: 0.04,
          ease: "power3.out",
        });

        // Staggered reveal for the large "We focus on" text
        gsap.from(largeText.words, {
          scrollTrigger: {
            trigger: ".philosophy-large",
            start: "top 80%",
          },
          y: 40,
          opacity: 0,
          duration: 1.2,
          stagger: 0.06,
          ease: "power3.out",
        });
        
        return () => {
           smallText.revert();
           largeText.revert();
        };
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="philosophy" className="relative h-screen min-h-[800px] w-full flex items-center justify-center overflow-hidden bg-[var(--color-brand-primary)]">
      
      {/* Background Parallax */}
      <div 
        ref={bgRef} 
        className="absolute inset-x-0 -top-[20%] h-[140%] w-full opacity-30 z-0 pointer-events-none"
      >
        <Image
          src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1920&q=80&auto=format" // Abstract / Dark textured
          alt="Dark texture"
          fill
          sizes="100vw"
          className="object-cover mix-blend-multiply filter grayscale contrast-125"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-brand-primary)] via-transparent to-[var(--color-brand-primary)]" />
      </div>

      {/* Philosophy Content */}
      <div ref={textContainerRef} className="relative z-10 max-w-5xl px-8 w-full">
        
        <p className="philosophy-small text-xl md:text-2xl text-[var(--color-brand-text)] opacity-50 font-sans font-medium mb-12 max-w-2xl">
          Most AI focuses on a single, homogenized mathematical consensus.
        </p>

        <h2 className="philosophy-large text-5xl md:text-7xl lg:text-8xl font-serif italic leading-[1.1] text-[var(--color-brand-text)] max-w-4xl">
          We focus on <span className="text-[var(--color-brand-accent)] not-italic font-sans font-bold tracking-tight">visible disagreement</span> to help you act.
        </h2>

      </div>

    </section>
  );
}
