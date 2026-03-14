"use client";

import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";

export default function SettingsPage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    if (saved) setTheme(saved);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  return (
    <div className="w-full h-full p-4 md:p-8 lg:p-12">
      <div className="max-w-3xl mx-auto space-y-10">
        <header>
          <h1 className="text-3xl md:text-5xl font-serif italic font-bold tracking-tight text-[var(--color-brand-text)]">
            Settings
          </h1>
          <p className="text-[var(--color-brand-text)]/60 mt-2 md:text-lg">
            Preferences and configuration.
          </p>
        </header>

        <section className="bg-[var(--color-brand-surface)] border border-[var(--color-brand-text)]/10 rounded-[2rem] overflow-hidden">
          {/* Theme Toggle */}
          <div className="p-6 flex items-center justify-between border-b border-[var(--color-brand-text)]/5">
            <div>
              <h3 className="font-bold text-[var(--color-brand-text)]">Appearance</h3>
              <p className="text-sm text-[var(--color-brand-text)]/60 mt-1">Toggle between dark and light mode.</p>
            </div>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-3 px-5 py-3 rounded-full border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-text)]/5 hover:bg-[var(--color-brand-text)]/10 text-[var(--color-brand-text)] transition-all"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span className="text-sm font-bold capitalize">{theme} Mode</span>
            </button>
          </div>

          {/* API Endpoint */}
          <div className="p-6 flex items-center justify-between border-b border-[var(--color-brand-text)]/5">
            <div>
              <h3 className="font-bold text-[var(--color-brand-text)]">API Endpoint</h3>
              <p className="text-sm text-[var(--color-brand-text)]/60 mt-1">Backend server connection.</p>
            </div>
            <span className="text-sm font-mono text-[var(--color-brand-accent)] bg-[var(--color-brand-accent)]/10 px-4 py-2 rounded-full">
              localhost:8000
            </span>
          </div>

          {/* Account */}
          <div className="p-6 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-[var(--color-brand-text)]">Account</h3>
              <p className="text-sm text-[var(--color-brand-text)]/60 mt-1">demo@consilium.com</p>
            </div>
            <button className="text-sm font-bold text-red-400/80 hover:text-red-400 px-5 py-3 rounded-full border border-red-400/20 hover:border-red-400/40 transition-colors">
              Sign Out
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
