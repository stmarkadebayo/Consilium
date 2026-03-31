import { AuthProvider } from "@/hooks/useAuth";
import { AuthPanel } from "@/components/auth/AuthPanel";

export default function LandingPage() {
  return (
    <AuthProvider>
      <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-primary)] p-6">
        <div className="glass max-w-md w-full rounded-[2.5rem] p-10 border border-[var(--color-border)] shadow-2xl relative overflow-hidden">
          {/* Subtle noise inside the card */}
          <div className="absolute inset-0 opacity-[0.02] mix-blend-soft-light pointer-events-none" 
               style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />
          
          <div className="relative z-10 flex flex-col items-center text-center">
            <h1 className="font-serif text-4xl italic text-white mb-2 tracking-tight">Consilium</h1>
            <p className="text-sm font-mono text-[var(--color-text-secondary)] mb-10 tracking-widest uppercase">
              Private Advisory Protocol
            </p>
            
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-10 max-w-[280px]">
              Assemble a council of minds. Gather parallel perspective. Emerge with rigorous clarity.
            </p>

            <AuthPanel />
          </div>
        </div>
      </main>
    </AuthProvider>
  );
}
