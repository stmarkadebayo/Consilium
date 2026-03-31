"use client";

import { CouncilSetup } from "@/components/onboarding/CouncilSetup";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-[var(--color-primary)]">
      <div className="absolute inset-0 opacity-[0.02] mix-blend-soft-light pointer-events-none" 
           style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />
      
      <div className="relative z-10 w-full flex justify-center">
         <CouncilSetup onComplete={() => router.push("/app/chat")} />
      </div>
    </main>
  );
}
