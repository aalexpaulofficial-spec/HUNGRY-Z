import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { LegalSection } from "@/content/legal";
import { useModalDismiss } from "@/lib/use-modal-dismiss";

type LegalDocument = { title: string; intro: string; sections: LegalSection[] };

export function LegalDialog({ legalDocument, onClose }: { legalDocument: LegalDocument; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const close = useModalDismiss(onClose);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close]);

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-background/80 px-3 py-3 backdrop-blur-md sm:px-6 sm:py-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="hungry-legal-dialog-title"
        className="glass-red relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[1.5rem] shadow-[var(--shadow-cinema)] sm:max-h-[calc(100dvh-3rem)] sm:rounded-[2rem]"
      >
        <header className="relative shrink-0 border-b border-border px-5 pb-4 pr-16 pt-5 sm:px-8 sm:pb-5 sm:pr-20 sm:pt-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary-bright">HUNGRY Z · Legal</p>
          <h2 id="hungry-legal-dialog-title" className="display mt-2 text-2xl sm:text-3xl">{legalDocument.title}</h2>
          <p className="mt-2 text-xs text-muted-foreground">Last updated: November 5, 2026</p>
          <button
            ref={closeButton}
            type="button"
            onClick={close}
            aria-label="Close legal information"
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-border bg-card/70 text-muted-foreground transition hover:border-primary/50 hover:text-foreground sm:right-6 sm:top-6"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-7">
          <p className="max-w-3xl text-sm leading-relaxed text-foreground/80">{legalDocument.intro}</p>
          <div className="mt-5 divide-y divide-border border-y border-border">
            {legalDocument.sections.map((section) => (
              <section key={section.title} className="py-5 first:pt-5 last:pb-5">
                <h3 className="display text-lg text-primary-bright sm:text-xl">{section.title}</h3>
                {section.paragraphs.map((paragraph, index) => (
                  <p key={index} className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">{paragraph}</p>
                ))}
              </section>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Questions or requests: <a className="font-semibold text-primary-bright underline" href="mailto:hungryofficialx@gmail.com">hungryofficialx@gmail.com</a>
          </p>
        </div>
      </section>
    </div>
  );
}
