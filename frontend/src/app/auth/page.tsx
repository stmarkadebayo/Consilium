import { redirect } from "next/navigation";

import AuthModal from "@/components/auth/AuthModal";

export default function AuthPage() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    redirect("/app");
  }

  return (
    <div className="min-h-screen bg-[var(--color-brand-background)] flex items-center justify-center relative overflow-hidden">
      {/* Background organic glow strictly mapped to accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-[var(--color-brand-accent)] opacity-5 blur-[120px] rounded-[100%] pointer-events-none" />
      
      {/* Render the modal component directly inline here for hard navigation */}
      <AuthModal />
    </div>
  );
}
