"use client";

import { use, useEffect, useMemo, useRef } from "react";
import { useConversation } from "@/hooks/useConversation";
import { useCouncil } from "@/hooks/useCouncil";
import { ConversationView } from "@/components/chat/ConversationView";
import { MessageInput } from "@/components/chat/MessageInput";

const pendingMessageKey = (conversationId: string) =>
  `consilium:pending-first-message:${conversationId}`;

type PendingConsultBootstrap = {
  content: string;
  jobId: string;
};

function readPendingConsult(conversationId: string): PendingConsultBootstrap | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(pendingMessageKey(conversationId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PendingConsultBootstrap;
    if (!parsed?.content || !parsed?.jobId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function ConversationThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const {
    conversation,
    isLoading,
    isSending,
    pendingUserMessage,
    error,
    fetchConversation,
    sendMessage,
    resumePendingJob,
    retryFailedJob,
    failedMessageContent,
  } = useConversation(id);
  const { council, fetchCouncil } = useCouncil();
  const hasBootstrappedPending = useRef(false);
  const bootstrapPendingMessage = useMemo(() => {
    return readPendingConsult(id);
  }, [id]);
  const optimisticPendingMessage =
    pendingUserMessage ?? bootstrapPendingMessage?.content ?? failedMessageContent;

  useEffect(() => {
    fetchConversation(id);
    fetchCouncil();
  }, [id, fetchConversation, fetchCouncil]);

  useEffect(() => {
    hasBootstrappedPending.current = false;
  }, [id]);

  useEffect(() => {
    if (!bootstrapPendingMessage || hasBootstrappedPending.current) return;

    hasBootstrappedPending.current = true;
    sessionStorage.removeItem(pendingMessageKey(id));
    void resumePendingJob(bootstrapPendingMessage.jobId, bootstrapPendingMessage.content);
  }, [bootstrapPendingMessage, id, resumePendingJob]);

  if (isLoading && !conversation && !optimisticPendingMessage) {
    return (
      <div className="flex flex-1 items-center justify-center h-full">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border-strong)] border-t-[var(--color-accent)]" />
      </div>
    );
  }

  if (error && !conversation && !optimisticPendingMessage && !isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-[var(--color-error)]">
        Could not load conversation thread.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <ConversationView
          conversation={conversation}
          isSending={isSending}
          pendingUserMessage={optimisticPendingMessage}
          error={error}
          onRetry={retryFailedJob}
          activeMemberNames={(council?.members ?? [])
            .filter((member) => member.is_active)
            .map((member) => member.display_name)}
        />
      </div>
      
      <div className="flex-none p-4 pb-6 bg-gradient-to-t from-[var(--color-surface)] to-transparent sticky bottom-0">
        <MessageInput onSend={sendMessage} isSending={isSending} />
      </div>
    </div>
  );
}
