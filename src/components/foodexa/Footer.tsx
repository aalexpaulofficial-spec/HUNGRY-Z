import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/foodexa/LogoMark";
import { LegalDialog } from "@/components/foodexa/LegalDialog";
import { privacyPolicy, termsConditions } from "@/content/legal";

const groups = [
  ["Platform", ["For Students", "For Faculty", "Institutions", "Analytics"]],
  ["Company", ["Pricing", "FAQ", "Login", "Contact"]],
  ["Legal", ["Privacy Policy", "Terms & Conditions"]],
] as const;

const hrefMap: Record<string, string> = {
  "For Students": "#students",
  "For Faculty": "#faculty",
  Institutions: "#institutions",
  Analytics: "#analytics",
  Pricing: "#pricing",
  FAQ: "#faq",
  Login: "/auth?mode=login",
  Contact: "#start",
};

export function Footer() {
  const navigate = useNavigate();
  const [legalPage, setLegalPage] = useState<"privacy" | "terms" | null>(null);
  const logoClicks = useRef(0);
  const clickReset = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (clickReset.current) clearTimeout(clickReset.current);
  }, []);

  function onFooterLogoClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    logoClicks.current += 1;
    if (clickReset.current) clearTimeout(clickReset.current);

    if (logoClicks.current === 3) {
      logoClicks.current = 0;
      clickReset.current = null;
      void navigate({ to: "/admin" });
      return;
    }

    clickReset.current = setTimeout(() => {
      logoClicks.current = 0;
      clickReset.current = null;
    }, 1500);
  }

  return (
    <footer className="relative isolate overflow-hidden border-t border-border bg-ink py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -bottom-40 -z-10 h-72 ember opacity-40"
      />
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,0.6fr)]">
        <div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onFooterLogoClick}
              aria-label="HUNGRY Z"
              className="grid h-9 w-9 place-items-center rounded-full border-0 bg-primary p-0 text-[12px] transition hover:scale-110"
            >
              <LogoMark className="h-9 w-9" />
            </button>
            <span className="display text-[14px] tracking-[0.3em]">HUNGRY Z</span>
          </div>
          <p className="mt-4 text-[10px] tracking-[0.3em] text-muted-foreground">
            SMART CAMPUS FOOD ORDERING
          </p>
          <p className="mt-8 display text-2xl text-primary-bright">₹0 platform fee. Always.</p>
        </div>

        {groups.map(([title, items]) => (
          <nav key={title} aria-label={title}>
            <p className="text-[10px] tracking-[0.24em] text-muted-foreground/70 uppercase">
              {title}
            </p>
            <ul className="mt-5 flex flex-col gap-3">
              {items.map((item) => (
                <li key={item}>
                  {item === "Privacy Policy" || item === "Terms & Conditions" ? (
                    <button
                      type="button"
                      onClick={() => setLegalPage(item === "Privacy Policy" ? "privacy" : "terms")}
                      className="text-left text-[13px] text-foreground/70 transition-colors duration-300 hover:text-primary-bright"
                    >
                      {item}
                    </button>
                  ) : (
                    <a
                      href={hrefMap[item] ?? "#top"}
                      className="text-[13px] text-foreground/70 transition-colors duration-300 hover:text-primary-bright"
                    >
                      {item}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto mt-14 flex max-w-7xl flex-col gap-2 px-5 text-[11px] text-muted-foreground/60 sm:flex-row sm:justify-between">
        <span>© {new Date().getFullYear()} HUNGRY Z. All rights reserved.</span>
        
      </div>
      {legalPage && (
        <LegalDialog
          legalDocument={legalPage === "privacy" ? privacyPolicy : termsConditions}
          onClose={() => setLegalPage(null)}
        />
      )}
    </footer>
  );
}
