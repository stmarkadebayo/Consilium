"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoaderCircle, Calendar, MessageSquareText } from "lucide-react";
import { api, type ConversationSummary } from "@/lib/api";

export default function HistoryPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const history = await api.listConversations();
        setConversations(history);
      } catch (err) {
        console.error("Failed to load history", err);
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  if (isLoading) {
    return (
      <div className="w-full h-[80vh] flex items-center justify-center">
        <LoaderCircle className="w-8 h-8 animate-spin text-[var(--color-brand-accent)]" />
      </div>
    );
  }

  return (
    <div className="w-full h-full p-4 md:p-8 lg:p-12">
      <div className="max-w-4xl mx-auto space-y-10">
        <header>
          <h1 className="text-3xl md:text-5xl font-serif italic font-bold tracking-tight text-[var(--color-brand-text)]">
            Session History
          </h1>
          <p className="text-[var(--color-brand-text)]/60 mt-2 md:text-lg">
            Every debate, every synthesis — indexed and searchable.
          </p>
        </header>

        {conversations.length === 0 ? (
          <div className="border border-dashed border-[var(--color-brand-text)]/20 p-12 rounded-[2rem] flex flex-col items-center justify-center text-center">
            <Calendar className="w-12 h-12 text-[var(--color-brand-text)]/20 mb-4" />
            <h3 className="text-lg font-bold text-[var(--color-brand-text)] mb-2">No sessions yet</h3>
            <p className="text-sm text-[var(--color-brand-text)]/60 max-w-sm mb-6">
              Once you start a debate, your history will be preserved here.
            </p>
            <Link
              href="/app/draft"
              className="inline-flex items-center justify-center bg-[var(--color-brand-text)]/10 text-[var(--color-brand-text)] hover:bg-[var(--color-brand-accent)] px-6 py-3 rounded-full font-bold transition-all"
            >
              Draft Your First Council
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conv) => (
              <Link
                key={conv.id}
                href={`/app/session/${conv.id}`}
                className="block bg-[var(--color-brand-text)]/[0.03] border border-[var(--color-brand-text)]/10 p-5 rounded-2xl hover:border-[var(--color-brand-text)]/30 hover:bg-[var(--color-brand-text)]/[0.06] transition-all duration-300 group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-accent)]/10 border border-[var(--color-brand-accent)]/20 flex items-center justify-center shrink-0">
                      <MessageSquareText className="w-5 h-5 text-[var(--color-brand-accent)]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-[var(--color-brand-text)] group-hover:text-[var(--color-brand-accent)] transition-colors truncate">
                        {conv.title || "Untitled Session"}
                      </h3>
                      <p className="text-xs font-mono text-[var(--color-brand-text)]/40 mt-1">
                        {new Intl.DateTimeFormat("en", {
                          month: "short", day: "numeric", year: "numeric",
                          hour: "numeric", minute: "2-digit"
                        }).format(new Date(conv.created_at))}
                        {" · "}{conv.message_count} messages
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-[var(--color-brand-text)]/30 group-hover:text-[var(--color-brand-accent)] transition-colors shrink-0 mt-1">
                    View →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
