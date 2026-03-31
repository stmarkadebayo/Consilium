"use client";

import { useState, useCallback } from "react";
import { api, Conversation, ConversationSummary, Job, pollJobUntilSettled } from "@/lib/api";

export const CONVERSATION_REFRESH_EVENT = "consilium:refresh-conversations";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function useConversationList() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.listConversations();
      setConversations(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createConversation = async (title?: string) => {
    const newConv = await api.createConversation(title);
    setConversations((prev) => [newConv, ...prev]);
    return newConv;
  };

  return { conversations, isLoading, fetchConversations, createConversation };
}

export function useConversation(conversationId: string | null) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [failedJob, setFailedJob] = useState<Job | null>(null);
  const [failedMessageContent, setFailedMessageContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchConversation = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getConversation(id);
      setConversation(data);
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to load conversation"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const awaitJob = useCallback(
    async (jobId: string, optimisticContent: string) => {
      if (!conversationId) return;

      setIsSending(true);
      setPendingUserMessage(optimisticContent);
      setFailedJob(null);
      setFailedMessageContent(null);
      setError(null);

      try {
        const settledJob = await pollJobUntilSettled(jobId, 120000);
        await fetchConversation(conversationId);

        if (settledJob.status === "failed") {
          setFailedJob(settledJob);
          setFailedMessageContent(optimisticContent);
          setError(
            settledJob.error_message || "The council could not complete this consult."
          );
          return;
        }
      } catch (error: unknown) {
        setError(getErrorMessage(error, "Failed to submit message"));
      } finally {
        setPendingUserMessage(null);
        setIsSending(false);
      }
    },
    [conversationId, fetchConversation]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!conversationId) return;
      try {
        const { job_id } = await api.submitMessage(conversationId, content);
        window.dispatchEvent(new Event(CONVERSATION_REFRESH_EVENT));
        await awaitJob(job_id, content);
      } catch (error: unknown) {
        setError(getErrorMessage(error, "Failed to submit message"));
      }
    },
    [awaitJob, conversationId]
  );

  const resumePendingJob = useCallback(
    async (jobId: string, content: string) => {
      if (!conversationId) return;
      window.dispatchEvent(new Event(CONVERSATION_REFRESH_EVENT));
      await awaitJob(jobId, content);
    },
    [awaitJob, conversationId]
  );

  const retryFailedJob = useCallback(async () => {
    if (!failedJob || !failedMessageContent) return;
    try {
      const retriedJob = await api.retryJob(failedJob.id);
      await awaitJob(retriedJob.id, failedMessageContent);
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to retry consult"));
    }
  }, [awaitJob, failedJob, failedMessageContent]);

  return {
    conversation,
    setConversation,
    isLoading,
    isSending,
    pendingUserMessage,
    failedJob,
    failedMessageContent,
    error,
    fetchConversation,
    sendMessage,
    resumePendingJob,
    retryFailedJob,
  };
}
