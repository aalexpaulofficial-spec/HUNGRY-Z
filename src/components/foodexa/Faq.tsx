import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { faqs } from "@/content/foodexa";


export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative isolate overflow-hidden py-24 sm:py-36">
      <div className="mx-auto max-w-5xl px-5">
        <p className="mb-8 text-[10px] tracking-[0.34em] text-muted-foreground">FAQ</p>
        <h2 className="display text-[clamp(2.2rem,6.6vw,5rem)]">
          EVERYTHING,
          <br />
          <span className="text-primary-bright">ANSWERED.</span>
        </h2>

        <div className="mt-14 border-t border-border">
          {faqs.map(([q, a], i) => {
            const active = open === i;
            return (
              <div key={q} className="border-b border-border">
                <button
                  type="button"
                  onClick={() => setOpen(active ? null : i)}
                  aria-expanded={active}
                  className="group flex w-full items-center justify-between gap-6 py-6 text-left"
                >
                  <span
                    className={cn(
                      "display text-[clamp(1rem,3vw,1.6rem)] transition-colors duration-300",
                      active ? "text-primary-bright" : "text-foreground group-hover:text-foreground/80",
                    )}
                  >
                    {q}
                  </span>
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-all duration-500",
                      active
                        ? "rotate-45 border-primary text-primary-bright"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    +
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {active && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="max-w-2xl pb-7 text-sm leading-relaxed text-muted-foreground">
                        {a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
