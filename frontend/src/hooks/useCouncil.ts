"use client";

import { useState, useCallback } from "react";
import { api, Council } from "@/lib/api";

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
    } catch (err: any) {
      setError(err.message || "Failed to fetch council");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { council, isLoading, error, fetchCouncil, setCouncil };
}
