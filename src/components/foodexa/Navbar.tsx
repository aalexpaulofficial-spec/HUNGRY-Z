import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { BackButton, useBackNavigationEnabled } from "@/lib/back-nav";
import { ThemeToggle } from "@/components/ThemeToggle";

const links = [
  { label: "For Students", href: "#students" },
  { label: "For Faculty", href: "#faculty" },
  { label: "Institutions", href: "#institutions" },
  { label: "Analytics", href: "#analytics" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
  { label: "Login", href: "/auth?mode=login" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const siteNavigationEnabled = useBackNavigationEnabled();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const brand = (
    <>
      <img src="/HUNGRY%20Z%20Q%20LOGO.png" alt="HUNGRY Z" className="h-7 w-7 shrink-0 rounded-full object-contain shadow-[0_0_24px_-4px_var(--primary)]" />
      <span
        aria-hidden={scrolled}
        data-brand-text
        className={cn(
          "display max-w-32 overflow-hidden whitespace-nowrap tracking-[0.3em] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          scrolled ? "max-w-0 translate-x-1 opacity-0" : "translate-x-0 opacity-100",
          scrolled ? "text-[12px]" : "text-[14px]",
        )}
      >
        HUNGRY Z
      </span>
    </>
  );

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:px-5 sm:pt-5">
        <nav
          className={cn(
            "flex w-full items-center justify-between transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            scrolled
              ? "max-w-5xl rounded-full glass-red px-3 py-2 sm:px-4"
              : "max-w-7xl rounded-3xl border border-transparent px-2 py-3 sm:px-4",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            {siteNavigationEnabled && <BackButton inline />}
            {siteNavigationEnabled ? (
              <a href="#top" aria-label="HUNGRY Z home" className={cn("group flex min-w-0 items-center transition-all duration-500", scrolled ? "gap-0" : "gap-2.5")}>
                {brand}
              </a>
            ) : (
              <span className={cn("group flex min-w-0 items-center transition-all duration-500", scrolled ? "gap-0" : "gap-2.5")} aria-label="HUNGRY Z">
                {brand}
              </span>
            )}
          </div>

          {siteNavigationEnabled && (
            <div className="hidden items-center gap-1 lg:flex">
              {links.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  className="whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors duration-300 hover:text-foreground"
                >
                  {l.label}
                </a>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {siteNavigationEnabled && (
              <>
                <a
                  href="/register-canteen"
                  className="group hidden items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/60 bg-background px-4 py-2 text-[12px] font-semibold text-foreground transition-all duration-300 hover:scale-[1.04] hover:border-primary hover:shadow-[0_0_30px_-4px_var(--primary-bright)] sm:inline-flex"
                >
                  Register & Login Canteen
                </a>
                <a
                  href="/auth"
                  className="group hidden items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground transition-all duration-300 hover:scale-[1.04] hover:shadow-[0_0_30px_-4px_var(--primary-bright)] sm:inline-flex"
                >
                  Start with HUNGRY
                  <span className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                    ↗
                  </span>
                </a>
                <button
                  type="button"
                  aria-label="Open menu"
                  onClick={() => setOpen(true)}
                  className="flex h-10 w-10 flex-col items-center justify-center gap-[5px] rounded-full border border-border lg:hidden"
                >
                  <span className="h-[1.5px] w-4 bg-foreground" />
                  <span className="h-[1.5px] w-4 bg-foreground" />
                </button>
              </>
            )}
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {siteNavigationEnabled && open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[60] flex flex-col bg-background/98 px-6 py-6 backdrop-blur-xl lg:hidden"
          >
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/3 h-72 ember" />
            <div className="relative flex items-center justify-between">
              <span className="display text-[13px] tracking-[0.3em]">HUNGRY Z</span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full border border-border text-lg"
              >
                ✕
              </button>
            </div>

            <div className="relative mt-14 flex flex-col gap-1">
              {links.map((l, i) => (
                <motion.a
                  key={l.label}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ delay: 0.06 * i + 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="display text-[10vw] leading-[1.1] text-foreground/90"
                >
                  {l.label}
                </motion.a>
              ))}
            </div>

            <motion.a
              href="/auth"
              onClick={() => setOpen(false)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.5 }}
              className="relative mt-auto flex items-center justify-center gap-2 rounded-full bg-primary py-4 text-sm font-semibold text-primary-foreground"
            >
              Start with HUNGRY ↗
            </motion.a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
