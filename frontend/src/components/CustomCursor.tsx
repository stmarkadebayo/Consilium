"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

export default function CustomCursor() {
  const innerCursor = useRef<HTMLDivElement>(null);
  const outerCursor = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [hoverText, setHoverText] = useState("");

  useEffect(() => {
    // Disable on touch devices
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const ctx = gsap.context(() => {
      // Mouse move
      const onMouseMove = (e: MouseEvent) => {
        gsap.to(innerCursor.current, {
          x: e.clientX,
          y: e.clientY,
          duration: 0,
        });
        
        // Trailing effect for outer ring
        gsap.to(outerCursor.current, {
          x: e.clientX,
          y: e.clientY,
          duration: 0.15,
          ease: "power2.out",
        });
      };

      // Hover logic
      const onMouseOver = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const interactive = target.closest("a, button, [data-interactive]");
        
        if (interactive) {
          setIsHovering(true);
          const customText = interactive.getAttribute("data-cursor-text") || "";
          setHoverText(customText);
          
          gsap.to(outerCursor.current, {
            scale: 1.5,
            backgroundColor: "rgba(58, 125, 139, 0.1)", // Accent color at 10%
            borderColor: "rgba(58, 125, 139, 0.5)",
            duration: 0.2,
          });
        } else {
          setIsHovering(false);
          setHoverText("");
          
          gsap.to(outerCursor.current, {
            scale: 1,
            backgroundColor: "transparent",
            borderColor: "rgba(250, 248, 245, 0.5)", // Primary text color at 50%
            duration: 0.2,
          });
        }
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseover", onMouseOver);

      return () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseover", onMouseOver);
      };
    });

    return () => ctx.revert();
  }, []);

  return (
    <>
      {/* Inner Dot */}
      <div
        ref={innerCursor}
        className="fixed top-0 left-0 w-2 h-2 -ml-1 -mt-1 bg-[var(--color-brand-accent)] rounded-full pointer-events-none z-[99999] hidden lg:block"
        style={{ transform: "translate(-100px, -100px)" }}
      />
      {/* Outer Ring */}
      <div
        ref={outerCursor}
        className="fixed top-0 left-0 w-10 h-10 -ml-5 -mt-5 border border-[rgba(250,248,245,0.5)] rounded-full pointer-events-none z-[99998] hidden lg:flex items-center justify-center transition-colors overflow-hidden"
        style={{ transform: "translate(-100px, -100px)" }}
      >
        <span
          className={`text-[8px] font-mono tracking-widest uppercase text-[var(--color-brand-accent)] transition-opacity duration-200 ${
            isHovering && hoverText ? "opacity-100" : "opacity-0"
          }`}
        >
          {hoverText}
        </span>
      </div>
    </>
  );
}
