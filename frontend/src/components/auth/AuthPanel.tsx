"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { useSupabaseAuth } from "@/components/auth/SupabaseAuthProvider";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

export default function AuthPanel() {
  const router = useRouter();
  const { user, isLoading } = useSupabaseAuth();
  const configured = isSupabaseConfigured();

  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isLocalMode = !configured;

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/app");
    }
  }, [isLoading, router, user]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!configured) {
      router.push("/app");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const client = getSupabaseBrowserClient();
      if (mode === "sign_in") {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) {
          throw error;
        }
      } else {
        const { error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: `${firstName} ${lastName}`.trim(),
            },
          },
        });
        if (error) {
          throw error;
        }
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
      router.push("/app");
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
    <div className="w-full max-w-xl">
      <div className="rounded-[2.5rem] border border-[var(--color-brand-text)]/10 bg-[color-mix(in_srgb,var(--color-brand-surface)_80%,transparent)] p-8 shadow-[0_32px_120px_rgba(0,0,0,0.3)] md:p-10">
        <div className="mb-8 space-y-3">
          <p className="text-xs font-mono uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">
            Start here
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">Create your council.</h2>
          <p className="text-sm leading-7 text-[var(--color-brand-text)]/62">
            Sign up, create at least two personas, then move directly into the council chat.
          </p>
        </div>

        <div className="mb-6 flex rounded-full border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-primary)]/45 p-1">
          <button
            type="button"
            onClick={() => setMode("sign_up")}
            className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition ${
              mode === "sign_up"
                ? "bg-[var(--color-brand-accent)] text-[var(--color-brand-primary)]"
                : "text-[var(--color-brand-text)]/60"
            }`}
          >
            Sign Up
          </button>
          <button
            type="button"
            onClick={() => setMode("sign_in")}
            className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition ${
              mode === "sign_in"
                ? "bg-[var(--color-brand-accent)] text-[var(--color-brand-primary)]"
                : "text-[var(--color-brand-text)]/60"
            }`}
          >
            Sign In
          </button>
        </div>

        {!configured && (
          <div className="mb-6 rounded-[1.5rem] border border-[var(--color-brand-accent)]/20 bg-[var(--color-brand-accent)]/10 px-4 py-3 text-sm leading-6 text-[var(--color-brand-text)]/78">
            Supabase is not configured. You can continue in local development mode.
          </div>
        )}

        {(statusMessage || errorMessage) && (
          <div
            className={`mb-6 rounded-[1.5rem] border px-4 py-3 text-sm leading-6 ${
              errorMessage
                ? "border-red-500/30 bg-red-500/10 text-red-200"
                : "border-[var(--color-brand-accent)]/25 bg-[var(--color-brand-accent)]/10 text-[var(--color-brand-text)]"
            }`}
          >
            {errorMessage ?? statusMessage}
          </div>
        )}

        {isLocalMode ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => router.push("/app")}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-brand-accent)] px-5 py-3.5 text-sm font-semibold text-[var(--color-brand-primary)] transition hover:brightness-105"
            >
              Continue to local app
            </button>
            <div className="rounded-[1.5rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-primary)]/35 px-4 py-4 text-sm leading-7 text-[var(--color-brand-text)]/64">
              Local mode uses development auth automatically. The API will use Gemini if `GEMINI_API_KEY` is set,
              otherwise it falls back to mock responses.
            </div>
          </div>
        ) : (
          <>
            <form className="space-y-4" onSubmit={handleSubmit}>
              {mode === "sign_up" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-text)]/45">
                      First Name
                    </span>
                    <input
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      className="rounded-[1.25rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-primary)]/45 px-4 py-3 text-sm outline-none transition focus:border-[var(--color-brand-accent)]"
                      placeholder="Ada"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-text)]/45">
                      Last Name
                    </span>
                    <input
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      className="rounded-[1.25rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-primary)]/45 px-4 py-3 text-sm outline-none transition focus:border-[var(--color-brand-accent)]"
                      placeholder="Lovelace"
                    />
                  </label>
                </div>
              )}

              <label className="grid gap-2">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-text)]/45">
                  Email
                </span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="rounded-[1.25rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-primary)]/45 px-4 py-3 text-sm outline-none transition focus:border-[var(--color-brand-accent)]"
                  placeholder="operator@consilium.ai"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-text)]/45">
                  Password
                </span>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="rounded-[1.25rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-primary)]/45 px-4 py-3 text-sm outline-none transition focus:border-[var(--color-brand-accent)]"
                  placeholder="••••••••"
                />
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-brand-accent)] px-5 py-3.5 text-sm font-semibold text-[var(--color-brand-primary)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : mode === "sign_in" ? (
                  "Sign In"
                ) : (
                  "Create Account"
                )}
              </button>
            </form>

            <div className="my-5 flex items-center gap-4">
              <div className="h-px flex-1 bg-[var(--color-brand-text)]/10" />
              <span className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-brand-text)]/32">
                or
              </span>
              <div className="h-px flex-1 bg-[var(--color-brand-text)]/10" />
            </div>

            <button
              type="button"
              onClick={() => void handleGoogleSignIn()}
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-[var(--color-brand-text)]/12 bg-[var(--color-brand-primary)]/35 px-5 py-3.5 text-sm font-semibold transition hover:border-[var(--color-brand-accent)]/30 hover:bg-[var(--color-brand-primary)]/55 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>
          </>
        )}
      </div>
    </div>
  );
}
