"use client";

import { useState } from "react";
import { api, PersonaDraft, pollJobUntilSettled } from "@/lib/api";

export function usePersonaPipeline() {
  const [isGenerating, setIsGenerating] = useState(false);
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

    } catch (err: any) {
      setError(err.message || "An error occurred during persona generation.");
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const approveDraft = async (draftId: string) => {
    try {
      return await api.approveDraft(draftId);
    } catch (err: any) {
      setError(err.message || "Approval failed.");
      return null;
    }
  };

  return { generateDraft, approveDraft, isGenerating, error, setError };
}
