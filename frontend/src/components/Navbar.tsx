"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import ThemeSwitcher from "./ThemeSwitcher";

export default function Navbar() {
  const navRef = useRef<HTMLElement>(null);
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: document.body,
        start: "top -50", // 50px down
        onUpdate: (self) => {
          if (self.direction === 1 && !hasScrolled) {
            setHasScrolled(true);
            gsap.to(navRef.current, {
              backgroundColor: "var(--color-navbar-bg)",
              backdropFilter: "blur(16px)",
              border: "1px solid var(--color-navbar-border)",
              padding: "1rem 2rem",
              duration: 0.4,
              ease: "power2.inOut",
            });
          } else if (self.direction === -1 && self.progress <= 0 && hasScrolled) {
            setHasScrolled(false);
            gsap.to(navRef.current, {
              backgroundColor: "transparent",
              backdropFilter: "blur(0px)",
              border: "1px solid transparent",
              padding: "1.5rem 2rem",
              duration: 0.4,
              ease: "power2.inOut",
            });
          }
        },
      });
    });

    return () => ctx.revert();
  }, [hasScrolled]);

  return (
    <div className="fixed top-0 left-0 w-full z-50 flex justify-center pt-6 px-4 pointer-events-none">
      <nav
        ref={navRef}
        className="pointer-events-auto flex items-center justify-between w-full max-w-5xl rounded-[2rem] transition-all px-8 py-6 border border-transparent"
      >
        <Link href="/" className="font-serif italic text-xl font-bold tracking-wide">
          Consilium
        </Link>

        <div className="hidden md:flex items-center space-x-8 text-sm font-medium tracking-wide">
          <a href="#features" className="hover:text-[var(--color-brand-accent)] transition-colors hover:-translate-y-[1px] block" data-cursor-text="Scroll">
            Features
          </a>
          <a href="#philosophy" className="hover:text-[var(--color-brand-accent)] transition-colors hover:-translate-y-[1px] block" data-cursor-text="Read">
            Philosophy
          </a>
          <a href="#pricing" className="hover:text-[var(--color-brand-accent)] transition-colors hover:-translate-y-[1px] block" data-cursor-text="View">
            Pricing
          </a>
        </div>

        <div className="flex items-center gap-4">
          <ThemeSwitcher />
          <Link
            href="/"
            className="group relative overflow-hidden inline-block bg-[var(--color-brand-accent)] text-[var(--color-brand-primary)] px-6 py-2 rounded-full font-medium text-sm transition-transform hover:scale-[1.03] duration-300"
            style={{ transitionTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)" }}
            data-cursor-text="Open"
          >
            <span className="relative z-10">Get Started</span>
            <div className="absolute inset-0 h-full w-full translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out bg-[var(--color-brand-text)] z-0" />
          </Link>
        </div>
      </nav>
    </div>
  );
}
