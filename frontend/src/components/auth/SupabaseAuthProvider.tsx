"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
  type SupabaseAuthSnapshot,
} from "@/lib/supabase";

type AuthContextValue = SupabaseAuthSnapshot & {
  isLoading: boolean;
  isConfigured: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  isLoading: true,
  isConfigured: false,
});

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SupabaseAuthSnapshot>({ session: {} as any, user: { id: "mock", email: "demo@consilium.com" } as any });
  const configured = isSupabaseConfigured();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!configured) {
      return;
    }

    const client = getSupabaseBrowserClient();

    client.auth.getSession().then(({ data }) => {
      setState({ session: data.session, user: data.session?.user ?? null });
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setState({ session, user: session?.user ?? null });
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [configured]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isLoading,
      isConfigured: configured,
    }),
    [configured, isLoading, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSupabaseAuth() {
  return useContext(AuthContext);
}
