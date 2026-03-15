"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  MessageSquarePlus, 
  Clock, 
  Settings, 
  LogOut,
  Moon,
  Sun,
  Menu,
  X 
} from "lucide-react";
import { useState, useEffect } from "react";

import { isSupabaseConfigured, signOutSupabase } from "@/lib/supabase";

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") {
      return "dark";
    }
    const savedTheme = window.localStorage.getItem("theme");
    return savedTheme === "light" ? "light" : "dark";
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const handleSignOut = async () => {
    if (!isSupabaseConfigured()) {
      return;
    }
    setIsSigningOut(true);
    try {
      await signOutSupabase();
      window.location.href = "/auth";
    } finally {
      setIsSigningOut(false);
    }
  };

  const navItems = [
    { name: "Dashboard", href: "/app", icon: Home },
    { name: "Draft Council", href: "/app/draft", icon: MessageSquarePlus },
    { name: "History", href: "/app/history", icon: Clock },
    { name: "Settings", href: "/app/settings", icon: Settings },
  ];

  return (
    <>
      {/* Mobile Menu Toggle */}
      <div className="md:hidden fixed top-0 left-0 w-full z-50 p-4 flex justify-between items-center bg-[color-mix(in_srgb,var(--color-brand-primary)_80%,transparent)] backdrop-blur-md border-b border-[var(--color-brand-text)]/10">
        <Link href="/app" className="font-serif italic text-xl font-bold tracking-tight">
          Consilium
        </Link>
        <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="p-2 text-[var(--color-brand-text)]">
          {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Container */}
      <aside 
        className={`
          fixed top-0 left-0 h-full z-40 bg-[var(--color-brand-surface)] border-r border-[var(--color-brand-text)]/10 flex flex-col transition-all duration-300
          ${isCollapsed ? "w-20" : "w-64"}
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          md:relative
        `}
      >
        {/* Brand / Logo */}
        <div className="flex items-center justify-between p-6 h-20 shrink-0 border-b border-[var(--color-brand-text)]/10">
          {!isCollapsed && (
            <Link href="/app" className="font-serif italic text-2xl font-bold tracking-tight text-[var(--color-brand-text)] truncate transition-opacity duration-300">
              Consilium
            </Link>
          )}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            className="hidden md:flex p-2 rounded-lg hover:bg-[var(--color-brand-text)]/5 text-[var(--color-brand-text)]/60 hover:text-[var(--color-brand-text)] transition-colors"
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 py-8 px-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group ${
                  isActive 
                    ? "bg-[var(--color-brand-text)]/10 text-[var(--color-brand-accent)]" 
                    : "text-[var(--color-brand-text)]/60 hover:bg-[var(--color-brand-text)]/5 hover:text-[var(--color-brand-text)]"
                }`}
                title={isCollapsed ? item.name : undefined}
                onClick={() => setIsMobileOpen(false)}
              >
                <item.icon size={20} className={`shrink-0 ${isActive ? "text-[var(--color-brand-accent)]" : "text-[var(--color-brand-text)]/60 group-hover:text-[var(--color-brand-text)]"}`} />
                {!isCollapsed && <span className="font-medium truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer Actions (Theme Toggle & Sign Out) */}
        <div className="p-4 border-t border-[var(--color-brand-text)]/10 space-y-2 shrink-0">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-[var(--color-brand-text)]/60 hover:bg-[var(--color-brand-text)]/5 hover:text-[var(--color-brand-text)] transition-all duration-300 group"
            title={isCollapsed ? "Toggle Theme" : undefined}
          >
            {theme === "dark" ? (
              <Sun size={20} className="shrink-0 group-hover:text-[var(--color-brand-accent)]" />
            ) : (
              <Moon size={20} className="shrink-0 group-hover:text-[var(--color-brand-accent)]" />
            )}
            {!isCollapsed && <span className="font-medium truncate">Toggle Theme</span>}
          </button>

          <button
            onClick={() => void handleSignOut()}
            disabled={!isSupabaseConfigured() || isSigningOut}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-red-400/80 hover:bg-red-500/10 hover:text-red-400 transition-all duration-300 group"
            title={isCollapsed ? "Sign Out" : undefined}
          >
            <LogOut size={20} className="shrink-0" />
            {!isCollapsed && (
              <span className="font-medium truncate">
                {isSigningOut ? "Signing Out..." : "Sign Out"}
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="md:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
    </>
  );
}
