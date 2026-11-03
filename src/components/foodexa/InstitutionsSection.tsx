import { useGsap } from "./use-gsap";
import { cn } from "@/lib/utils";

const kpis = [
  ["Orders today", "1,284", "sample"],
  ["Active canteens", "6", "sample"],
  ["Avg. pickup", "5m 42s", "sample"],
  ["Platform fee", "₹0", "always"],
];

const queue = [
  ["#HG-2471", "Masala Dosa Thali", "Preparing"],
  ["#HG-2470", "Campus Black Burger", "Ready"],
  ["#HG-2468", "Paneer Rice Bowl", "Collected"],
  ["#HG-2465", "Masala Chai ×2", "Ready"],
];

const bars = [34, 52, 41, 78, 96, 62, 48, 71, 88, 55, 39, 64];

export function InstitutionsSection() {
  const ref = useGsap(({ gsap, root }) => {
    const q = gsap.utils.selector(root);

    gsap.from(q("[data-headline] span span"), {
      yPercent: 115,
      duration: 1.2,
      stagger: 0.07,
      ease: "expo.out",
      scrollTrigger: { trigger: root, start: "top 70%" },
    });

    gsap.fromTo(
      q("[data-dash]"),
      { rotateX: 26, y: 90, scale: 0.9, opacity: 0 },
      {
        rotateX: 0,
        y: 0,
        scale: 1,
        opacity: 1,
        duration: 1.6,
        ease: "expo.out",
        scrollTrigger: { trigger: (q("[data-dash]")[0] as Element), start: "top 88%" },
      },
    );

    gsap.fromTo(
      q("[data-bar]"),
      { scaleY: 0, transformOrigin: "bottom" },
      {
        scaleY: 1,
        transformOrigin: "bottom",
        duration: 1.1,
        stagger: 0.05,
        ease: "expo.out",
        immediateRender: false,
        scrollTrigger: { trigger: (q("[data-chart]")[0] as Element), start: "top 92%" },
      },
    );


    const path = q("[data-line-path]")[0] as SVGPathElement | undefined;
    if (path) {
      const len = path.getTotalLength();
      gsap.fromTo(
        path,
        { strokeDasharray: len, strokeDashoffset: len },
        {
          strokeDashoffset: 0,
          duration: 2,
          ease: "power2.inOut",
          scrollTrigger: { trigger: path, start: "top 90%" },
        },
      );
    }

    gsap.from(q("[data-card]"), {
      y: 60,
      opacity: 0,
      duration: 1,
      stagger: 0.08,
      ease: "expo.out",
      scrollTrigger: { trigger: (q("[data-cards]")[0] as Element), start: "top 85%" },
    });
  });

  return (
    <section id="institutions" ref={ref} className="relative isolate overflow-hidden py-24 sm:py-36">
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-20%] top-1/4 -z-10 h-[60vh] w-[70vw] ember opacity-55"
      />
      <div className="mx-auto max-w-7xl px-5">
        <p className="mb-8 text-[10px] tracking-[0.34em] text-muted-foreground">FOR INSTITUTIONS</p>
        <h2 data-headline className="display max-w-4xl text-[clamp(2.4rem,7.4vw,6rem)]">
          {["ONE PLATFORM.", "ONE CAMPUS.", "TOTAL CONTROL."].map((l, i) => (
            <span key={l} className="block overflow-hidden pb-[0.06em]">
              <span className={i === 2 ? "block text-primary-bright" : "block"}>{l}</span>
            </span>
          ))}
        </h2>

        <div className="mt-14 [perspective:1600px]">
          <div
            data-dash
            className="glass-red overflow-hidden rounded-3xl p-4 sm:p-6"
            style={{ transformStyle: "preserve-3d" }}
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-primary text-[10px] font-black text-primary-foreground">
                  H
                </span>
                <span className="display text-[11px] tracking-[0.24em]">
                  HUNGRY CAMPUS CONSOLE
                </span>
              </div>
              <span className="rounded-full border border-border px-2.5 py-1 text-[9px] tracking-[0.16em] text-muted-foreground">
                SAMPLE DATA · DEMO VIEW
              </span>
            </div>

            <div data-cards className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {kpis.map(([label, value, tag]) => (
                <div
                  key={label}
                  data-card
                  className="rounded-2xl border border-border bg-ink-soft/70 p-4"
                >
                  <p className="text-[9.5px] tracking-[0.18em] text-muted-foreground uppercase">
                    {label}
                  </p>
                  <p
                    className={cn(
                      "display mt-2 text-2xl sm:text-3xl",
                      label === "Platform fee" && "text-primary-bright text-glow",
                    )}
                  >
                    {value}
                  </p>
                  <p className="mt-1 text-[9px] text-muted-foreground/70">{tag}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[1.5fr_1fr]">
              <div
                data-chart
                className="rounded-2xl border border-border bg-ink-soft/70 p-4 sm:p-5"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] tracking-[0.2em] text-muted-foreground">
                    ORDER DEMAND · BY HOUR
                  </p>
                  <p className="text-[10px] text-primary-bright">Peak 1PM</p>
                </div>
                <div className="mt-5 flex h-40 items-end gap-1.5 sm:gap-2.5">
                  {bars.map((b, i) => (
                    <div key={i} className="flex-1">
                      <div
                        data-bar
                        className="w-full rounded-t-md"
                        style={{
                          height: `${b}%`,
                          background:
                            i === 4
                              ? "linear-gradient(to top, var(--primary-deep), var(--primary-bright))"
                              : "linear-gradient(to top, oklch(0.2 0.02 25), oklch(0.42 0.13 28))",
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between text-[9px] text-muted-foreground">
                  <span>8 AM</span>
                  <span>1 PM</span>
                  <span>8 PM</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="rounded-2xl border border-border bg-ink-soft/70 p-4">
                  <p className="text-[10px] tracking-[0.2em] text-muted-foreground">
                    REVENUE TREND
                  </p>
                  <svg viewBox="0 0 200 70" className="mt-3 h-20 w-full">
                    <path
                      data-line-path
                      d="M2 60 C 30 52, 44 26, 66 34 S 104 58, 126 30 S 170 12, 198 8"
                      fill="none"
                      stroke="var(--primary-bright)"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                  </svg>
                  <p className="text-[9px] text-muted-foreground/70">sample weekly view</p>
                </div>
                <div className="flex-1 rounded-2xl border border-border bg-ink-soft/70 p-4">
                  <p className="text-[10px] tracking-[0.2em] text-muted-foreground">LIVE QUEUE</p>
                  <div className="mt-3 flex flex-col gap-2.5">
                    {queue.map(([id, item, status]) => (
                      <div key={id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-semibold">{item}</p>
                          <p className="text-[9px] text-muted-foreground">{id}</p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-[3px] text-[8.5px] font-semibold",
                            status === "Ready"
                              ? "bg-primary/18 text-primary-bright"
                              : status === "Preparing"
                                ? "border border-border text-foreground/70"
                                : "text-muted-foreground",
                          )}
                        >
                          {status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {["Menu control", "Canteen roster", "Student accounts", "Order status rules"].map(
                (m) => (
                  <div
                    key={m}
                    data-card
                    className="rounded-2xl border border-border bg-ink-soft/50 px-4 py-3 text-[11px] font-medium"
                  >
                    {m}
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
        <p className="mt-5 text-[11px] text-muted-foreground">
          Interface preview with sample information for illustration only.
        </p>
      </div>
    </section>
  );
}
