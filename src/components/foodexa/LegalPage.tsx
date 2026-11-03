import { Link } from "@tanstack/react-router";
import { BackButton } from "@/lib/back-nav";

export type LegalSection = { title: string; paragraphs: string[] };

export function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: LegalSection[] }) {
  return <main className="grain relative min-h-screen overflow-hidden bg-background px-4 py-8 sm:px-6 sm:py-12">
    <div aria-hidden="true" className="ember pointer-events-none absolute -top-44 left-1/2 h-[520px] w-[520px] -translate-x-1/2 opacity-40" />
    <div className="relative mx-auto max-w-4xl">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link to="/" className="display text-[15px] tracking-[0.3em]" aria-label="HUNGRY Z home">HUNGRY Z</Link>
        <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5">
          <BackButton inline />
          <span className="pr-1 text-xs font-semibold text-muted-foreground">Back</span>
        </div>
      </header>
      <section className="glass-red mt-10 rounded-[2rem] p-6 sm:mt-14 sm:p-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary-bright">HUNGRY Z · Legal</p>
        <h1 className="display mt-3 text-3xl sm:text-4xl">{title}</h1>
        <p className="mt-3 text-xs text-muted-foreground">Last updated: November 2, 2026</p>
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-foreground/80">{intro}</p>
        <div className="mt-8 divide-y divide-border border-y border-border">
          {sections.map((section) => <section key={section.title} className="py-6">
            <h2 className="display text-xl text-primary-bright">{section.title}</h2>
            {section.paragraphs.map((paragraph, index) => <p key={index} className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">{paragraph}</p>)}
          </section>)}
        </div>
        <p className="mt-8 text-sm text-muted-foreground">Questions, privacy requests, order or payment support: <a className="font-semibold text-primary-bright underline" href="mailto:hungryofficialx@gmail.com">hungryofficialx@gmail.com</a></p>
        <nav aria-label="Legal pages" className="mt-6 flex flex-wrap gap-3 text-xs"><Link to="/privacy" className="rounded-full border border-border px-4 py-2 text-muted-foreground hover:text-foreground">Privacy Policy</Link><Link to="/terms" className="rounded-full border border-border px-4 py-2 text-muted-foreground hover:text-foreground">Terms &amp; Conditions</Link></nav>
      </section>
    </div>
  </main>;
}
