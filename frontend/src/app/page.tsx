"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import CustomCursor from "@/components/CustomCursor";
import Preloader from "@/components/Preloader";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Philosophy from "@/components/Philosophy";
import Protocol from "@/components/Protocol";
import Pricing from "@/components/Pricing";
import Footer from "@/components/Footer";

export default function Home() {
  useEffect(() => {
    // 1. Check for prevents-reduced-motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) return; // Do not initialize Lenis or ScrollTrigger heavy animations

    // 2. Initialize Lenis for smooth scrolling
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), 
    });

    // 3. Connect Lenis to GSAP ScrollTrigger
    gsap.registerPlugin(ScrollTrigger);
    
    lenis.on('scroll', ScrollTrigger.update);

    // 4. RequestAnimationFrame loop for Lenis
    gsap.ticker.add((time) => {
      lenis.raf(time * 1000); // GSAP ticker provides time in seconds, Lenis needs ms
    });

    gsap.ticker.lagSmoothing(0); // Important for Lenis + GSAP sync

    return () => {
      gsap.ticker.remove((time) => {
        lenis.raf(time * 1000);
      });
      lenis.destroy();
    };
  }, []);

  return (
    <main className="marketing-cursor-none relative min-h-screen selection:bg-[var(--color-brand-accent-amber)] selection:text-[var(--color-brand-primary)]">
      <CustomCursor />
      <Preloader />
      <Navbar />
      
      <Hero />
      <Features />
      <Philosophy />
      <Protocol />
      <Pricing />
      <Footer />
    </main>
  );
}
