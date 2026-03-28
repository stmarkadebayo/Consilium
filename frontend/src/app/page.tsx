import AuthPanel from "@/components/auth/AuthPanel";

export default function Home() {
  return (
    <main className="h-screen overflow-hidden bg-[var(--color-brand-primary)] text-[var(--color-brand-text)]">
      <div className="grid h-full lg:grid-cols-[minmax(0,3fr)_minmax(420px,2fr)]">
        <section className="relative flex h-full items-center overflow-hidden border-r border-[var(--color-brand-text)]/8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,168,76,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(250,248,245,0.08),transparent_30%)]" />
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(250,248,245,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(250,248,245,0.06)_1px,transparent_1px)] [background-size:88px_88px]" />
          <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col gap-10 px-8 py-12 md:px-14 lg:px-18">
            <div className="inline-flex w-fit items-center gap-3 rounded-full border border-[var(--color-brand-accent)]/25 bg-[var(--color-brand-accent)]/10 px-4 py-2 text-xs font-mono uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">
              Consilium
            </div>

            <div className="max-w-3xl space-y-6">
              <h1 className="font-serif text-5xl font-semibold leading-[0.95] tracking-tight md:text-7xl">
                Build the council,
                <br />
                then ask the question.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-[var(--color-brand-text)]/68 md:text-lg">
                Create two to five personas. Let the profiling agent build each advisor from public material
                and recurring themes. Then send one prompt and watch the full council respond in parallel,
                followed by a synthesis you can act on.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[2rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-text)]/4 p-5">
                <p className="text-xs font-mono uppercase tracking-[0.24em] text-[var(--color-brand-accent)]">
                  01
                </p>
                <p className="mt-4 text-lg font-semibold">Profile personas</p>
                <p className="mt-2 text-sm leading-6 text-[var(--color-brand-text)]/62">
                  Add advisors one by one and approve the generated profile before they join the council.
                </p>
              </div>
              <div className="rounded-[2rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-text)]/4 p-5">
                <p className="text-xs font-mono uppercase tracking-[0.24em] text-[var(--color-brand-accent)]">
                  02
                </p>
                <p className="mt-4 text-lg font-semibold">Ask once</p>
                <p className="mt-2 text-sm leading-6 text-[var(--color-brand-text)]/62">
                  Every active persona gets the same prompt and reasons independently at the same time.
                </p>
              </div>
              <div className="rounded-[2rem] border border-[var(--color-brand-text)]/10 bg-[var(--color-brand-text)]/4 p-5">
                <p className="text-xs font-mono uppercase tracking-[0.24em] text-[var(--color-brand-accent)]">
                  03
                </p>
                <p className="mt-4 text-lg font-semibold">Read the synthesis</p>
                <p className="mt-2 text-sm leading-6 text-[var(--color-brand-text)]/62">
                  Compare agreement, disagreement, and the smallest concrete next step worth taking.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex h-full items-center justify-center bg-[color-mix(in_srgb,var(--color-brand-surface)_72%,var(--color-brand-primary))] px-6 py-8">
          <AuthPanel />
        </section>
      </div>
    </main>
  );
}
