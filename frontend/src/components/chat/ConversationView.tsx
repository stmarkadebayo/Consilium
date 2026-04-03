"use client";

import { useRef, useEffect } from "react";
import { Conversation, ConversationTurn } from "@/lib/api";
import { SynthesisCard } from "./SynthesisCard";

function CouncilGlyph({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] ${className}`}>
      <span className="block h-3 w-3 rotate-45 rounded-[0.28rem] border-2 border-[var(--color-accent)]" />
    </span>
  );
}

function UserTurnMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-xl">
        <div className="min-w-0 rounded-[1.45rem] border border-[var(--color-border)] bg-gradient-to-b from-[var(--color-surface-raised)] to-[var(--color-surface)] px-4 py-3 text-right shadow-lg">
          <p className="text-[0.95rem] leading-relaxed text-white">{content}</p>
        </div>
      </div>
    </div>
  );
}

function CouncilTurnContent({ turn }: { turn: ConversationTurn }) {
  return (
    <div className="flex items-start gap-4">
      <CouncilGlyph className="mt-1 flex-shrink-0" />
      <div className="flex-1">
        <SynthesisCard
          synthesis={turn.synthesis}
          personaResponses={turn.persona_responses}
        />
      </div>
    </div>
  );
}

function PendingTurn({
  content,
  activeMemberNames,
  error,
  onRetry,
}: {
  content: string;
  activeMemberNames: string[];
  error?: string | null;
  onRetry?: (() => void) | null;
}) {
  const pendingNames =
    activeMemberNames.length > 0
      ? activeMemberNames
      : ["Advisor 1", "Advisor 2", "Advisor 3"];

  return (
    <div className="mt-4 flex flex-col space-y-10 animate-fade-in">
      <UserTurnMessage content={content} />

      <div className="flex items-start gap-4">
        <CouncilGlyph className="mt-1 flex-shrink-0" />
        <div className="flex-1">
          <SynthesisCard
            pendingNames={pendingNames}
            isLoading
            error={error}
            onRetry={error ? onRetry : null}
          />
        </div>
      </div>
    </div>
  );
}

export function ConversationView({
  conversation,
  isSending,
  pendingUserMessage,
  error,
  onRetry,
  activeMemberNames,
}: {
  conversation: Conversation | null;
  isSending: boolean;
  pendingUserMessage: string | null;
  error?: string | null;
  onRetry?: (() => void) | null;
  activeMemberNames: string[];
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.turns.length, pendingUserMessage, isSending]);

  if (!conversation || conversation.turns.length === 0) {
    return (
      <div className="flex w-full max-w-4xl flex-1 flex-col mx-auto px-4 py-8 sm:px-8">
        {pendingUserMessage ? (
          <PendingTurn
            content={pendingUserMessage}
            activeMemberNames={activeMemberNames}
            error={error}
            onRetry={error ? onRetry : null}
          />
        ) : (
          <div className="mt-16 flex flex-1 flex-col items-center justify-center p-8 text-center animate-fade-in">
            <h2 className="mb-3 font-serif text-[1.7rem] italic text-white">Council Assembled</h2>
            <p className="max-w-md text-[0.92rem] text-[var(--color-text-secondary)]">
              Your advisors await. Present a scenario, decision, or dilemma to receive parallel perspectives and synthesis.
            </p>
          </div>
        )}
        <div ref={bottomRef} className="h-8 w-full flex-none" />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto py-8 px-4 sm:px-8 space-y-12">
      {conversation.turns.map((turn: ConversationTurn, index: number) => (
        <div key={turn.turn_number} className="flex flex-col mt-4 space-y-8 animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
          {turn.user_message ? <UserTurnMessage content={turn.user_message.content} /> : null}
          <CouncilTurnContent turn={turn} />
        </div>
      ))}

      {isSending && pendingUserMessage && (
        <PendingTurn content={pendingUserMessage} activeMemberNames={activeMemberNames} />
      )}

      <div ref={bottomRef} className="h-8 w-full flex-none" />
    </div>
  );
}
