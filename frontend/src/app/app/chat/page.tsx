"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageInput } from "@/components/chat/MessageInput";
import { api } from "@/lib/api";
import { CONVERSATION_REFRESH_EVENT } from "@/hooks/useConversation";

const pendingConsultKey = (conversationId: string) =>
  `consilium:pending-first-message:${conversationId}`;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to start consult";
}

export default function ChatEmptyState() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async (content: string) => {
    setIsCreating(true);
    setError(null);
    try {
      const consult = await api.startConsult(content);
      sessionStorage.setItem(
        pendingConsultKey(consult.conversation_id),
        JSON.stringify({ content, jobId: consult.job_id })
      );
      window.dispatchEvent(new Event(CONVERSATION_REFRESH_EVENT));
      router.push(`/app/chat/${consult.conversation_id}`);
    } catch (error: unknown) {
      setError(getErrorMessage(error));
      setIsCreating(false);
    }
  };

  return (
    <div className="flex-1 animate-fade-in p-8">
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex w-full max-w-4xl flex-col items-center text-center">
          <h2 className="mb-3 font-serif text-3xl italic">Council Assembled</h2>
          <p className="mb-10 max-w-xl text-sm text-[var(--color-text-secondary)]">
            Your advisors await. Present a scenario, decision, or dilemma to receive parallel perspectives and synthesis.
          </p>

          <div className="w-full">
            <MessageInput onSend={handleSend} isSending={isCreating} />
          </div>

          {error && (
            <p className="mt-4 text-sm text-[var(--color-error)]">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
