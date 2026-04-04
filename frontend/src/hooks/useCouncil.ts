"use client";

import { useSyncExternalStore } from "react";
import { api, Council } from "@/lib/api";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Council request failed";
}

type CouncilStoreState = {
  council: Council | null;
  isLoading: boolean;
  error: string | null;
};

const listeners = new Set<() => void>();
let inflightCouncilRequest: Promise<Council | null> | null = null;
let councilStore: CouncilStoreState = {
  council: null,
  isLoading: false,
  error: null,
};

function emitCouncilStore() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return councilStore;
}

function setCouncilState(nextState: Partial<CouncilStoreState>) {
  councilStore = { ...councilStore, ...nextState };
  emitCouncilStore();
}

async function fetchCouncilInternal(force = false) {
  if (inflightCouncilRequest && !force) {
    return inflightCouncilRequest;
  }

  setCouncilState({ isLoading: true, error: null });

  inflightCouncilRequest = (async () => {
    try {
      const data = await api.getCouncil();
      setCouncilState({ council: data, isLoading: false, error: null });
      return data;
    } catch (err: unknown) {
      setCouncilState({ isLoading: false, error: getErrorMessage(err) });
      return null;
    } finally {
      inflightCouncilRequest = null;
    }
  })();

  return inflightCouncilRequest;
}

async function refreshCouncilInternal() {
  return fetchCouncilInternal(true);
}

async function updateCouncilNameInternal(name: string) {
  setCouncilState({ error: null });
  try {
    const data = await api.updateCouncil(name);
    setCouncilState({ council: data, error: null });
    return data;
  } catch (err: unknown) {
    setCouncilState({ error: getErrorMessage(err) });
    return null;
  }
}

async function updateMemberInternal(memberId: string, payload: { is_active?: boolean; position?: number }) {
  setCouncilState({ error: null });
  try {
    const data = await api.updateCouncilMember(memberId, payload);
    setCouncilState({ council: data, error: null });
    return data;
  } catch (err: unknown) {
    setCouncilState({ error: getErrorMessage(err) });
    return null;
  }
}

export function useCouncil() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    ...state,
    fetchCouncil: fetchCouncilInternal,
    refreshCouncil: refreshCouncilInternal,
    updateCouncilName: updateCouncilNameInternal,
    updateMember: updateMemberInternal,
    setCouncil: (council: Council | null) => setCouncilState({ council }),
  };
}
