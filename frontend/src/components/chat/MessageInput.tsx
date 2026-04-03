"use client";

import { useState } from "react";
import { SendHorizontal } from "lucide-react";
import TextareaAutosize from 'react-textarea-autosize';

type Props = {
  onSend: (msg: string) => Promise<void>;
  isSending: boolean;
};

export function MessageInput({ onSend, isSending }: Props) {
  const [content, setContent] = useState("");

  const handleSend = () => {
    if (!content.trim() || isSending) return;
    onSend(content);
    setContent("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-[1.6rem] border border-[var(--color-border-strong)] bg-[var(--color-surface)]/88 px-2 py-2 shadow-[0_14px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-[box-shadow,border-color,border-radius] focus-within:border-[var(--color-accent)]/45 focus-within:shadow-[0_0_0_1px_rgba(208,169,90,0.2),0_0_20px_rgba(208,169,90,0.12)]">
      <div className="flex items-end gap-2">
        <TextareaAutosize
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Present your inquiry to the council..."
          minRows={1}
          maxRows={8}
          className="message-input-field flex-1 resize-none appearance-none border-0 bg-transparent px-3 py-1 text-[0.9rem] leading-6 text-white placeholder-[var(--color-text-tertiary)] shadow-none outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
          disabled={isSending}
        />

        <button
          onClick={handleSend}
          disabled={!content.trim() || isSending}
          className="mb-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-black transition-all hover:scale-[1.03] disabled:bg-[var(--color-surface-raised)] disabled:text-[var(--color-text-tertiary)] disabled:hover:scale-100"
          aria-label="Submit inquiry"
        >
          {isSending ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-inherit border-t-transparent" />
          ) : (
            <SendHorizontal className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
