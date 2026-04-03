"use client";

import { useEffect } from "react";
import { MessagesSquare, Sparkles, UserCircle2 } from "lucide-react";
import { CONVERSATION_REFRESH_EVENT, useConversationList } from "@/hooks/useConversation";
import { useCouncil } from "@/hooks/useCouncil";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";

export function CouncilGlyph({ className = "" }: { className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)]",
        className
      )}
    >
      <span className="block h-3 w-3 rotate-45 rounded-[0.28rem] border-2 border-[var(--color-accent)]" />
    </span>
  );
}

export function ConversationSidebar({
  collapsed,
}: {
  collapsed: boolean;
}) {
  const { conversations, fetchConversations } = useConversationList();
  const { council, fetchCouncil } = useCouncil();
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const activeId = params.id as string | undefined;
  const activeMembers = (council?.members ?? []).filter((member) => member.is_active);
  const visibleConversations = conversations.filter(
    (conversation) => conversation.message_count > 0 || conversation.title
  );
  const profileLabel = user?.display_name || "User";
  const modeLabel = user?.email?.endsWith("@consilium.local") ? "Dev Mode" : "User";
  const motionClass = "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]";

  useEffect(() => {
    fetchConversations();
    fetchCouncil();
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, [fetchConversations, fetchCouncil]);

  useEffect(() => {
    const refresh = () => {
      fetchConversations();
      fetchCouncil();
    };

    window.addEventListener(CONVERSATION_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(CONVERSATION_REFRESH_EVENT, refresh);
  }, [fetchConversations, fetchCouncil]);

  const handleNewTopic = async () => {
    router.push("/app/chat");
  };

  return (
    <aside
      className={clsx(
        "z-20 flex h-full flex-shrink-0 flex-col overflow-hidden bg-[var(--color-surface)] transition-[width,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        collapsed ? "w-0 border-r-0 opacity-0" : "w-64 border-r border-[var(--color-border)] opacity-100 sm:w-80"
      )}
    >
      <div className="flex h-12 flex-none items-center px-5">
        <div className="flex w-full items-center">
          <div
            className={clsx(
              "overflow-hidden whitespace-nowrap",
              motionClass,
              collapsed ? "pointer-events-none max-w-0 -translate-x-2 opacity-0" : "max-w-[14rem] translate-x-0 opacity-100"
            )}
          >
            <Link href="/" className="group flex items-center">
              <h1 className="font-serif text-2xl italic tracking-tight text-white transition-colors group-hover:text-[var(--color-accent)]">
                Consilium
              </h1>
            </Link>
          </div>
        </div>
      </div>

      <div
        className={clsx(
          "flex flex-none flex-col border-b border-[var(--color-border-strong)]",
          collapsed ? "items-center gap-6 px-4 py-6" : "px-5 py-7"
        )}
      >
        <Link
          href="/app/setup"
          className={clsx(
            "group w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)]",
            collapsed ? "flex h-12 items-center justify-center" : "flex items-center gap-3 px-4 py-3"
          )}
          aria-label="View and edit council"
        >
          <CouncilGlyph className="transition-transform group-hover:scale-[1.04]" />
          <div
            className={clsx(
              "min-w-0 overflow-hidden whitespace-nowrap",
              motionClass,
              collapsed ? "max-w-0 opacity-0" : "max-w-[13rem] opacity-100"
            )}
          >
            <p className="truncate text-sm font-medium text-white">View Council</p>
            <p className="truncate text-xs text-[var(--color-text-tertiary)]">
              {activeMembers.length} active, edit members
            </p>
          </div>
        </Link>

        <button
          onClick={handleNewTopic}
          className={clsx(
            "text-white transition-colors hover:text-[var(--color-accent)]",
            collapsed
              ? "flex h-12 w-full items-center justify-center self-center"
              : "flex h-12 items-center text-sm font-medium"
          )}
          aria-label="New Consult"
        >
          <span className={clsx("flex justify-center", collapsed ? "w-auto" : "w-12")}>
            <Sparkles className="h-4 w-4" />
          </span>
          <span
            className={clsx(
              "overflow-hidden whitespace-nowrap",
              motionClass,
              collapsed ? "max-w-0 -translate-x-2 opacity-0" : "max-w-[12rem] translate-x-0 opacity-100"
            )}
          >
            New Consult
          </span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div
          className={clsx(
            "overflow-hidden px-2",
            motionClass,
            collapsed ? "max-h-0 pb-0 opacity-0" : "max-h-12 pb-4 opacity-100"
          )}
        >
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
            Consult History
          </p>
        </div>

        <div className="space-y-2">
          {visibleConversations.length === 0 ? (
            <div
              className={clsx(
                "overflow-hidden px-2 text-sm text-[var(--color-text-tertiary)]",
                motionClass,
                collapsed ? "max-h-0 py-0 opacity-0" : "max-h-20 py-4 opacity-100"
              )}
            >
              No consults yet
            </div>
          ) : (
            visibleConversations.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/app/chat/${conversation.id}`}
                className={clsx(
                  "group flex items-center rounded-xl transition-all",
                  activeId === conversation.id
                    ? "bg-[var(--color-surface-raised)] text-white"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-white",
                  collapsed ? "justify-center px-2 py-3" : "gap-3 px-3 py-3"
                )}
                aria-label={conversation.title || "Untitled Consult"}
              >
                <MessagesSquare
                  className={clsx(
                    "h-4 w-4 flex-shrink-0",
                    activeId === conversation.id
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-text-tertiary)] group-hover:text-white"
                  )}
                />
                <span
                  className={clsx(
                    "truncate overflow-hidden whitespace-nowrap text-sm font-medium",
                    motionClass,
                    collapsed ? "max-w-0 opacity-0" : "max-w-[12rem] opacity-100"
                  )}
                >
                  {conversation.title || "Untitled Consult"}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>

      <div className={clsx("flex flex-none border-t border-[var(--color-border-strong)] p-4", collapsed ? "justify-center" : "items-center gap-3")}>
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)]">
          <UserCircle2 className="h-5 w-5" />
        </div>
        <div
          className={clsx(
            "min-w-0 overflow-hidden whitespace-nowrap",
            motionClass,
            collapsed ? "max-w-0 opacity-0" : "max-w-[10rem] opacity-100"
          )}
        >
          <p className="truncate text-sm font-medium text-white">{profileLabel}</p>
          <p className="truncate text-xs text-[var(--color-text-tertiary)]">{modeLabel}</p>
        </div>
      </div>
    </aside>
  );
}
