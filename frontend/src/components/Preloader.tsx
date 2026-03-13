"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

export default function Preloader() {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Lock scroll
    document.body.style.overflow = "hidden";

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          setIsComplete(true);
          document.body.style.overflow = ""; // Restore scroll
        },
      });

      // Animate progress number
      tl.to(
        { val: 0 },
        {
          val: 100,
          duration: 2.5,
          ease: "power2.inOut",
          onUpdate: function () {
            setProgress(Math.round(this.targets()[0].val));
          },
        }
      );

      // Animate progress bar width
      tl.to(
        progressRef.current,
        {
          width: "100%",
          duration: 2.5,
          ease: "power2.inOut",
        },
        "<" // Sync with number
      );

      // Fade out text and progress
      tl.to([textRef.current, progressRef.current?.parentElement], {
        opacity: 0,
        duration: 0.5,
        ease: "power2.in",
      });

      // Slide up the curtain
      tl.to(containerRef.current, {
        yPercent: -100,
        duration: 1.2,
        ease: "power4.inOut",
      });
    });

    return () => ctx.revert();
  }, []);

  if (isComplete) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[999] bg-[var(--color-brand-primary)] flex flex-col justify-between p-8 sm:p-12 md:p-24"
    >
      <div className="flex-1 flex items-center justify-center">
        <h1
          ref={textRef}
          className="text-4xl sm:text-6xl md:text-8xl font-serif italic text-[var(--color-brand-text)]"
        >
          Consilium
        </h1>
      </div>

      <div className="w-full max-w-sm mx-auto flex items-center space-x-4">
        <div className="flex-1 h-[1px] bg-[rgba(250,248,245,0.2)] relative overflow-hidden">
          <div
            ref={progressRef}
            className="absolute top-0 left-0 h-full w-0 bg-[var(--color-brand-accent)]"
          />
        </div>
        <div className="w-12 text-right font-mono text-sm tracking-widest text-[var(--color-brand-accent-amber)]">
          {progress}%
        </div>
      </div>
    </div>
  );
}
