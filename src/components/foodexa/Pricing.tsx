import { useGsap } from "./use-gsap";
import { Phone } from "./Phone";

export const GENERAL_ENQUIRY_HREF = `mailto:hungryofficialx@gmail.com?subject=${encodeURIComponent("HUNGRY — General Enquiry")}`;

export function Pricing() {
  const ref = useGsap(({ gsap, root }) => {
    const q = gsap.utils.selector(root);
    gsap.from(q("[data-headline] span span"), {
      yPercent: 115,
      duration: 1.2,
      stagger: 0.07,
      ease: "expo.out",
      scrollTrigger: { trigger: root, start: "top 72%" },
    });
    gsap.fromTo(
      q("[data-panel]"),
      { y: 80, opacity: 0, rotateX: 14 },
      {
        y: 0,
        opacity: 1,
        rotateX: 0,
        duration: 1.3,
        stagger: 0.12,
        ease: "expo.out",
        scrollTrigger: { trigger: (q("[data-panels]")[0] as Element), start: "top 85%" },
      },
    );
  });

  return (
    <section id="pricing" ref={ref} className="relative isolate overflow-hidden py-24 sm:py-36">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[55vh] w-[80vw] -translate-x-1/2 -translate-y-1/2 ember opacity-45"
      />
      <div className="mx-auto max-w-7xl px-5">
        <p className="mb-8 text-[10px] tracking-[0.34em] text-muted-foreground">PRICING</p>
        <h2 data-headline className="display text-[clamp(2.4rem,7.4vw,6rem)]">
          {["SIMPLE.", "TRANSPARENT.", "SMART."].map((l, i) => (
            <span key={l} className="block overflow-hidden pb-[0.06em]">
              <span className={i === 2 ? "block text-primary-bright" : "block"}>{l}</span>
            </span>
          ))}
        </h2>

        <div
          data-panels
          className="mt-16 grid gap-4 [perspective:1400px] lg:grid-cols-[1.25fr_1fr]"
        >
          <div
            data-panel
            className="relative overflow-hidden rounded-[2rem] border border-primary/25 bg-ink/60 p-7 sm:p-12"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -left-1/3 top-0 h-full w-1/3 anim-sweep bg-gradient-to-r from-transparent via-primary/20 to-transparent"
            />
            <p className="text-[10px] tracking-[0.3em] text-muted-foreground">FOR STUDENTS</p>
            <div className="mt-6 flex flex-wrap items-end gap-5">
              <span className="display text-[clamp(5rem,20vw,12rem)] leading-none text-primary-bright text-glow">
                ₹0
              </span>
              <span className="display pb-4 text-[clamp(1rem,3vw,1.8rem)] tracking-[0.18em]">
                PLATFORM
                <br />
                FEE
              </span>
            </div>
            <p className="mt-4 text-lg text-foreground/80">Always.</p>
            <ul className="mt-9 flex flex-col gap-3 text-sm text-muted-foreground">
              {[
                "Unlimited orders across campus canteens",
                "Live order status and pickup QR",
                "Digital receipts and order history",
                "No hidden charges at checkout",
              ].map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="/auth"
              className="group mt-10 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_44px_-6px_var(--primary-bright)]"
            >
              Start with HUNGRY
              <span className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1">
                ↗
              </span>
            </a>
          </div>

          <div
            data-panel
            className="flex flex-col justify-between gap-8 rounded-[2rem] border border-border bg-ink-soft/50 p-7 sm:p-10"
          >
            <div>
              <p className="text-[10px] tracking-[0.3em] text-muted-foreground">
                FOR INSTITUTIONS
              </p>
              <p className="display mt-6 text-[clamp(1.8rem,5vw,3rem)]">Built for campuses.</p>
              <p className="mt-5 text-sm text-muted-foreground">
                Multi-canteen setup, menu control, order rules and campus analytics. We scope
                deployment with your team — talk to us for details.
              </p>
              <div className="mt-8 flex justify-center lg:justify-start">
                <Phone screen="history" glow={false} className="w-[170px]" />
              </div>
            </div>
            <a
              href={GENERAL_ENQUIRY_HREF}
              aria-label="Talk to HUNGRY by email"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/40 px-6 py-3.5 text-sm font-semibold text-foreground transition-all duration-300 hover:bg-primary/12"
            >
              Talk to HUNGRY
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
