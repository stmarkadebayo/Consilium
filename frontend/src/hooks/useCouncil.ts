"use client";

import { useState, useCallback, useEffect } from "react";
import { api, Council } from "@/lib/api";

export const COUNCIL_REFRESH_EVENT = "consilium:council-refresh";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Council request failed";
}

export function useCouncil() {
  const [council, setCouncil] = useState<Council | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCouncil = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getCouncil();
      setCouncil(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => {
      void fetchCouncil();
    };
    window.addEventListener(COUNCIL_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(COUNCIL_REFRESH_EVENT, refresh);
  }, [fetchCouncil]);

  const updateCouncilName = useCallback(async (name: string) => {
    setError(null);
    try {
      const data = await api.updateCouncil(name);
      setCouncil(data);
      return data;
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      return null;
    }
  }, []);

  const updateMember = useCallback(async (memberId: string, payload: { is_active?: boolean; position?: number }) => {
    setError(null);
    try {
      const data = await api.updateCouncilMember(memberId, payload);
      setCouncil(data);
      return data;
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      return null;
    }
  }, []);

  return { council, isLoading, error, fetchCouncil, updateCouncilName, updateMember, setCouncil };
}
