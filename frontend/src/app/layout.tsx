import { Inter, Playfair_Display, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { SupabaseAuthProvider } from '@/components/auth/SupabaseAuthProvider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  style: ['normal', 'italic'],
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata = {
  title: 'Consilium — Private Council of Minds',
  description: 'Assemble a council of AI advisors. Get structured perspective, visible disagreement, and actionable synthesis.',
};

export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <body className="antialiased bg-[var(--color-brand-primary)] text-[var(--color-brand-text)] overscroll-none" suppressHydrationWarning>
        
        {/* Global Noise Overlay */}
        <svg
          className="pointer-events-none fixed isolate z-50 opacity-5 w-full h-full mix-blend-soft-light"
          style={{ width: "100vw", height: "100vh" }}
        >
          <filter id="pedroduarteisalegend">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.80"
              numOctaves="4"
              stitchTiles="stitch"
            ></feTurbulence>
          </filter>
          <rect width="100%" height="100%" filter="url(#pedroduarteisalegend)"></rect>
        </svg>

        <SupabaseAuthProvider>
          {children}
          {modal}
        </SupabaseAuthProvider>
      </body>
    </html>
  );
}
