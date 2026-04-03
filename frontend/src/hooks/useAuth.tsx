"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api, User } from "../lib/api";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = async () => {
    try {
      const me = await api.getMe();
      setUser(me);
      setError(null);
    } catch (fetchError: unknown) {
      setUser(null);
      setError(fetchError instanceof Error ? fetchError.message : "Unable to reach the API.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = async () => {
    setIsLoading(true);
    setError(null);
    // In dev bypass mode, calling getMe creates/returns the dev user
    await fetchUser();
  };

  const logout = () => {
    setUser(null);
    setError(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
