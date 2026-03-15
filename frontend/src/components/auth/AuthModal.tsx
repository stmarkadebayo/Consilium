"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { LoaderCircle, X } from "lucide-react";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import { useSupabaseAuth } from "@/components/auth/SupabaseAuthProvider";

export default function AuthModal() {
  const router = useRouter();
  const modalRef = useRef<HTMLDivElement>(null);
  const { user, isLoading } = useSupabaseAuth();
  
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Close when authenticated
  useEffect(() => {
    if (!isLoading && user) {
      router.back();
      setTimeout(() => router.push("/app"), 100); // Small delay to let modal close
    }
  }, [isLoading, router, user]);

  const configured = isSupabaseConfigured();

  // Close modal on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  // Click outside to close
  const handleOutsideClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      router.back();
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!configured) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const client = getSupabaseBrowserClient();
      if (mode === "sign_in") {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // User effect will handle router push
      } else {
        const { error } = await client.auth.signUp({
          email,
          password,
          options: { data: { full_name: `${firstName} ${lastName}` } },
        });
        if (error) throw error;
        setStatusMessage("Account created. Check your inbox if email confirmation is enabled.");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!configured) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const client = getSupabaseBrowserClient();
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/app`,
        },
      });
      if (error) {
        throw error;
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Google authentication failed");
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--color-brand-primary)]/70 backdrop-blur-md p-4"
    >
      {/* Background click handler moved here to allow X button separate layout */}
      <div className="absolute inset-0 cursor-pointer" onClick={handleOutsideClick} />
      
      {/* Global Close Button */}
      <button 
        onClick={() => router.back()}
        className="absolute top-6 right-6 p-4 rounded-full text-[var(--color-brand-text)] opacity-60 hover:opacity-100 hover:bg-[rgba(128,128,128,0.15)] transition-colors z-[110]"
        aria-label="Close authentication"
      >
        <X className="w-6 h-6" />
      </button>

      <div 
        ref={modalRef}
        className="relative w-full max-w-md rounded-[3rem] border border-[rgba(128,128,128,0.1)] bg-[var(--color-brand-surface)] p-8 md:p-10 shadow-2xl flex flex-col justify-center overflow-hidden animate-in fade-in zoom-in-95 duration-300"
      >
        {/* Background Texture Overlay */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-[var(--color-brand-accent)] opacity-5 blur-[60px] rounded-full pointer-events-none" />

        <div className="relative z-10 w-full">
          <div className="flex bg-[rgba(128,128,128,0.1)] rounded-full p-1 mb-8">
            <button
              type="button"
              onClick={() => setMode("sign_in")}
              className={`flex-1 rounded-full py-2.5 text-sm font-bold transition-all duration-300 ${
                mode === "sign_in" 
                  ? "bg-[var(--color-brand-text)] text-[var(--color-brand-primary)] shadow-md" 
                  : "text-[var(--color-brand-text)] opacity-60 hover:opacity-100"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("sign_up")}
              className={`flex-1 rounded-full py-2.5 text-sm font-bold transition-all duration-300 ${
                mode === "sign_up" 
                  ? "bg-[var(--color-brand-text)] text-[var(--color-brand-primary)] shadow-md" 
                  : "text-[var(--color-brand-text)] opacity-60 hover:opacity-100"
              }`}
            >
              Sign Up
            </button>
          </div>

          {!configured && (
            <div className="mb-6 rounded-[1.5rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100">
              Supabase is not configured.
            </div>
          )}

          {(statusMessage || errorMessage) && (
            <div
              className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-mono tracking-tight leading-6 ${
                errorMessage
                  ? "border-red-500/30 bg-red-500/10 text-red-500"
                  : "border-[var(--color-brand-accent)]/30 bg-[var(--color-brand-accent)]/10 text-[var(--color-brand-accent)]"
              }`}
            >
              {errorMessage ?? statusMessage}
            </div>
          )}

          <form className="grid gap-4" onSubmit={handleSubmit}>
            {mode === "sign_up" && (
              <div className="flex flex-col sm:flex-row gap-4">
                <label className="flex-1 grid gap-1.5 min-w-0">
                  <span className="text-[10px] md:text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-text)] opacity-50 pl-2 truncate">First name</span>
                  <input
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className="rounded-2xl border border-[rgba(128,128,128,0.1)] bg-[rgba(128,128,128,0.05)] px-4 md:px-5 py-3.5 text-sm text-[var(--color-brand-text)] outline-none transition-all focus:border-[var(--color-brand-accent)] w-full"
                    placeholder="Alan"
                  />
                </label>
                <label className="flex-1 grid gap-1.5 min-w-0">
                  <span className="text-[10px] md:text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-text)] opacity-50 pl-2 truncate">Last name</span>
                  <input
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className="rounded-2xl border border-[rgba(128,128,128,0.1)] bg-[rgba(128,128,128,0.05)] px-4 md:px-5 py-3.5 text-sm text-[var(--color-brand-text)] outline-none transition-all focus:border-[var(--color-brand-accent)] w-full"
                    placeholder="Turing"
                  />
                </label>
              </div>
            )}

            <label className="grid gap-1.5">
              <span className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-text)] opacity-50 pl-2">Email</span>
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-2xl border border-[rgba(128,128,128,0.1)] bg-[rgba(128,128,128,0.05)] px-5 py-3.5 text-sm text-[var(--color-brand-text)] outline-none transition-all focus:border-[var(--color-brand-accent)]"
                placeholder="operator@system.com"
              />
            </label>

            <label className="grid gap-1.5 mb-2">
              <span className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-text)] opacity-50 pl-2">Password</span>
              <input
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-2xl border border-[rgba(128,128,128,0.1)] bg-[rgba(128,128,128,0.05)] px-5 py-3.5 text-sm text-[var(--color-brand-text)] outline-none transition-all focus:border-[var(--color-brand-accent)]"
                placeholder="••••••••"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting || !configured}
              className="group relative overflow-hidden inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-brand-accent)] px-5 py-4 text-sm font-bold text-[var(--color-brand-primary)] transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 mt-2"
              style={{ transitionTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)" }}
            >
              <span className="relative z-10 flex items-center gap-2">
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : mode === "sign_in" ? (
                  "Sign In"
                ) : (
                  "Sign Up"
                )}
              </span>
              <div className="absolute inset-0 h-full w-full translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out bg-[var(--color-brand-text)] z-0" />
            </button>
            
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-[rgba(128,128,128,0.15)]"></div>
              <span className="flex-shrink-0 mx-4 text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-text)] opacity-40">Or</span>
              <div className="flex-grow border-t border-[rgba(128,128,128,0.15)]"></div>
            </div>

            <button
              type="button"
              onClick={() => void handleGoogleSignIn()}
              disabled={!configured || isSubmitting}
              className="group relative overflow-hidden inline-flex items-center justify-center gap-2 rounded-full border border-[rgba(128,128,128,0.15)] bg-transparent px-5 py-4 text-sm font-bold text-[var(--color-brand-text)] transition-transform hover:scale-[1.02]"
              style={{ transitionTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)" }}
            >
              <span className="relative z-10 flex items-center gap-3">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </span>
              <div className="absolute inset-0 h-full w-full translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out bg-[rgba(128,128,128,0.08)] z-0" />
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}
