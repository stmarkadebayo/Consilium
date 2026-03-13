"use client";

export default function Footer() {
  return (
    <footer className="w-full bg-[#050508] text-[rgba(250,248,245,0.5)] py-16 px-8 md:px-16 rounded-t-[4rem] border-t border-[rgba(250,248,245,0.05)] mt-32">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
        
        {/* Brand */}
        <div className="md:col-span-2">
          <div className="font-serif italic text-2xl font-bold text-[var(--color-brand-text)] tracking-wide mb-4">
            Consilium
          </div>
          <p className="max-w-sm text-sm">
            Your private council of minds. <br />
            Assemble advisors. Get structured perspective.
          </p>
          
          <div className="mt-8 flex items-center gap-3">
             <div className="relative flex h-3 w-3">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-brand-accent)] opacity-75"></span>
               <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--color-brand-accent)]"></span>
             </div>
             <span className="text-xs font-mono uppercase tracking-widest text-[rgba(250,248,245,0.4)]">Systems Operational</span>
          </div>
        </div>

        {/* Links */}
        <div>
          <h4 className="text-[var(--color-brand-text)] font-sans font-bold mb-6 text-sm">Product</h4>
          <ul className="space-y-4 text-sm font-medium">
            <li><a href="#features" className="hover:text-[var(--color-brand-text)] transition-colors">Features</a></li>
            <li><a href="#philosophy" className="hover:text-[var(--color-brand-text)] transition-colors">Philosophy</a></li>
            <li><a href="#pricing" className="hover:text-[var(--color-brand-text)] transition-colors">Pricing</a></li>
          </ul>
        </div>

        <div>
           <h4 className="text-[var(--color-brand-text)] font-sans font-bold mb-6 text-sm">Legal</h4>
           <ul className="space-y-4 text-sm font-medium">
             <li><a href="#" className="hover:text-[var(--color-brand-text)] transition-colors">Privacy Policy</a></li>
             <li><a href="#" className="hover:text-[var(--color-brand-text)] transition-colors">Terms of Service</a></li>
             <li><a href="#" className="hover:text-[var(--color-brand-text)] transition-colors">Data Ethics</a></li>
           </ul>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto mt-24 pt-8 border-t border-[rgba(250,248,245,0.05)] flex flex-col md:flex-row items-center justify-between text-xs">
         <span>&copy; {new Date().getFullYear()} Consilium. All rights reserved.</span>
         <span className="mt-4 md:mt-0 opacity-50 font-mono">v1.0.0.alpha</span>
      </div>
    </footer>
  );
}
