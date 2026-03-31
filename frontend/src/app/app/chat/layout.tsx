"use client";

import { ReactNode, useState } from "react";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";

export default function ChatLayout({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen w-full bg-[var(--color-primary)] overflow-hidden">
      <ConversationSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((current) => !current)}
      />
      <main className="flex-1 relative flex flex-col h-full border-l border-[var(--color-border)] bg-[var(--color-primary)]">
        {/* subtle noise */}
        <div className="absolute inset-0 opacity-[0.02] mix-blend-soft-light pointer-events-none" 
             style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />
        
        <div className="relative z-10 flex-1 flex flex-col h-full w-full">
          <header className="flex h-12 flex-none items-center justify-center border-b border-[var(--color-border-strong)] bg-[rgba(13,13,18,0.78)] px-6 backdrop-blur-xl">
            <h1 className="font-serif text-2xl italic tracking-tight text-[var(--color-accent)]">
              Consilium
            </h1>
          </header>
          <div className="flex-1 min-h-0">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
