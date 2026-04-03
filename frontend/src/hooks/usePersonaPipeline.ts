"use client";

import { useState } from "react";
import { api, PersonaDraftRevision, pollJobUntilSettled } from "@/lib/api";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function usePersonaPipeline() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isRestoringRevision, setIsRestoringRevision] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [revisions, setRevisions] = useState<PersonaDraftRevision[]>([]);
  const [error, setError] = useState<string | null>(null);

  const generateDraft = async (inputName: string, personaType: string, customBrief: string) => {
    setIsGenerating(true);
    setError(null);
    try {
      // 1. Create Draft (kicks off Job)
      const draftResponse = await api.createDraft({
        input_name: inputName,
        persona_type: personaType,
        custom_brief: customBrief || undefined,
      });

      if (!draftResponse.job_id) {
        throw new Error("Pipeline started but no job ID returned.");
      }

      // 2. Poll the job until it completes
      const job = await pollJobUntilSettled(draftResponse.job_id);
      
      if (job.status === "failed") {
        throw new Error(job.error_message || "Persona generation failed.");
      }

      // 3. Fetch the fully rendered draft
      const finalDraft = await api.getDraft(draftResponse.id);
      return finalDraft;

    } catch (err: unknown) {
      setError(getErrorMessage(err, "An error occurred during persona generation."));
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const reviseDraft = async (draftId: string, instruction: string) => {
    setIsRevising(true);
    setError(null);
    try {
      const draft = await api.reviseDraft(draftId, instruction);
      const history = await api.listDraftRevisions(draftId);
      setRevisions(history);
      return draft;
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Revision failed."));
      return null;
    } finally {
      setIsRevising(false);
    }
  };

  const updateDraft = async (draftId: string, draftProfile: Record<string, unknown>) => {
    setIsSavingDraft(true);
    setError(null);
    try {
      const draft = await api.updateDraft(draftId, draftProfile);
      const history = await api.listDraftRevisions(draftId);
      setRevisions(history);
      return draft;
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Saving draft failed."));
      return null;
    } finally {
      setIsSavingDraft(false);
    }
  };

  const fetchRevisions = async (draftId: string) => {
    setIsLoadingHistory(true);
    setError(null);
    try {
      const history = await api.listDraftRevisions(draftId);
      setRevisions(history);
      return history;
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load draft history."));
      return [];
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const restoreRevision = async (draftId: string, revisionId: string) => {
    setIsRestoringRevision(true);
    setError(null);
    try {
      const draft = await api.restoreDraftRevision(draftId, revisionId);
      const history = await api.listDraftRevisions(draftId);
      setRevisions(history);
      return draft;
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Restoring revision failed."));
      return null;
    } finally {
      setIsRestoringRevision(false);
    }
  };

  const approveDraft = async (draftId: string) => {
    try {
      return await api.approveDraft(draftId);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Approval failed."));
      return null;
    }
  };

  return {
    generateDraft,
    reviseDraft,
    updateDraft,
    fetchRevisions,
    restoreRevision,
    approveDraft,
    isGenerating,
    isRevising,
    isSavingDraft,
    isRestoringRevision,
    isLoadingHistory,
    revisions,
    error,
    setError,
  };
}
