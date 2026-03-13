"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState("dark"); // Default to dark (Midnight Luxe)

  useEffect(() => {
    // Optionally check system preference here in the future
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <button 
      onClick={toggleTheme}
      className="w-10 h-10 rounded-full bg-[var(--color-brand-surface)] border border-[rgba(128,128,128,0.2)] flex items-center justify-center text-[var(--color-brand-text)] hover:scale-110 transition-transform shadow-lg pointer-events-auto"
      data-cursor-text={theme === "dark" ? "Light Mode" : "Dark Mode"}
      aria-label="Toggle Theme"
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
