import { useGsap } from "./use-gsap";

const metrics = [
  { label: "Orders this week", value: 8432, suffix: "" },
  { label: "Avg. pickup time", value: 5.7, suffix: " min" },
  { label: "Peak hour load", value: 96, suffix: "%" },
  { label: "Food waste saved", value: 21, suffix: "%" },
];

const popular = [
  ["Masala Dosa Thali", 92],
  ["Campus Black Burger", 78],
  ["Paneer Rice Bowl", 64],
  ["Masala Chai", 55],
  ["Wood-Fired Margherita", 41],
] as const;

export function AnalyticsSection() {
  const ref = useGsap(({ gsap, root }) => {
    const q = gsap.utils.selector(root);

    gsap.from(q("[data-headline] span span"), {
      yPercent: 115,
      duration: 1.2,
      stagger: 0.07,
      ease: "expo.out",
      scrollTrigger: { trigger: root, start: "top 70%" },
    });

    q("[data-count]").forEach((el) => {
      const target = Number((el as HTMLElement).dataset["count"] ?? 0);
      const decimals = target % 1 !== 0 ? 1 : 0;
      const obj = { v: 0 };
      gsap.to(obj, {
        v: target,
        duration: 2.2,
        ease: "power2.out",
        onUpdate: () => {
          el.textContent =
            decimals > 0
              ? obj.v.toFixed(1)
              : Math.round(obj.v).toLocaleString("en-IN");
        },
        scrollTrigger: { trigger: el, start: "top 90%" },
      });
    });

    gsap.from(q("[data-track-fill]"), {
      scaleX: 0,
      transformOrigin: "left",
      duration: 1.4,
      stagger: 0.08,
      ease: "expo.out",
      scrollTrigger: { trigger: (q("[data-popular]")[0] as Element), start: "top 85%" },
    });

    gsap.fromTo(
      q("[data-depth-card]"),
      { z: -400, opacity: 0, y: 80 },
      {
        z: 0,
        opacity: 1,
        y: 0,
        duration: 1.4,
        stagger: 0.1,
        ease: "expo.out",
        scrollTrigger: { trigger: (q("[data-cards]")[0] as Element), start: "top 85%" },
      },
    );

    const area = q("[data-area]")[0] as SVGPathElement | undefined;
    if (area) {
      const len = area.getTotalLength();
      gsap.fromTo(
        area,
        { strokeDasharray: len, strokeDashoffset: len },
        {
          strokeDashoffset: 0,
          duration: 2.4,
          ease: "power1.inOut",
          scrollTrigger: { trigger: area, start: "top 90%" },
        },
      );
    }

    gsap.to(q("[data-glow]"), {
      xPercent: 22,
      yPercent: -18,
      ease: "none",
      scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: 1 },
    });
  });

  return (
    <section id="analytics" ref={ref} className="relative isolate overflow-hidden py-24 sm:py-36">
      <div
        aria-hidden
        data-glow
        className="pointer-events-none absolute left-1/4 top-1/3 -z-10 h-[55vh] w-[70vw] ember opacity-50"
      />
      <div className="mx-auto max-w-7xl px-5">
        <p className="mb-8 text-[10px] tracking-[0.34em] text-muted-foreground">ANALYTICS</p>
        <h2 data-headline className="display max-w-3xl text-[clamp(2.4rem,7.4vw,6rem)]">
          {["SEE YOUR CAMPUS", "IN REAL TIME."].map((l, i) => (
            <span key={l} className="block overflow-hidden pb-[0.06em]">
              <span className={i === 1 ? "block text-primary-bright" : "block"}>{l}</span>
            </span>
          ))}
        </h2>

        <div data-cards className="mt-14 grid gap-3 [perspective:1200px] sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((m) => (
            <div
              key={m.label}
              data-depth-card
              className="tilt-card rounded-3xl border border-border bg-ink-soft/60 p-5"
              style={{ transformStyle: "preserve-3d" }}
            >
              <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                {m.label}
              </p>
              <p className="display mt-3 text-4xl">
                <span data-count={m.value}>0</span>
                {m.suffix}
              </p>
              <p className="mt-2 text-[9.5px] text-muted-foreground/70">sample campus figure</p>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-3xl border border-border bg-ink-soft/60 p-5 sm:p-7">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-[10px] tracking-[0.2em] text-muted-foreground">
                CANTEEN PERFORMANCE · PEAK HOURS
              </p>
              <p className="text-[10px] text-primary-bright">Live sample feed</p>
            </div>
            <svg viewBox="0 0 400 150" className="mt-6 w-full">
              {[0, 1, 2, 3].map((g) => (
                <line
                  key={g}
                  x1="0"
                  x2="400"
                  y1={20 + g * 35}
                  y2={20 + g * 35}
                  stroke="oklch(1 0 0 / 0.07)"
                  strokeWidth="1"
                />
              ))}
              <path
                data-area
                d="M4 130 C 50 110, 74 60, 108 78 S 168 128, 200 62 S 262 22, 300 54 S 356 96, 396 18"
                fill="none"
                stroke="var(--primary-bright)"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            </svg>
            <div className="mt-4 flex flex-wrap gap-6 text-[10px] text-muted-foreground">
              {["Block A", "Food Court", "Café 24", "Tea Point"].map((c) => (
                <span key={c} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div data-popular className="rounded-3xl border border-border bg-ink-soft/60 p-5 sm:p-7">
            <p className="text-[10px] tracking-[0.2em] text-muted-foreground">POPULAR MEALS</p>
            <div className="mt-6 flex flex-col gap-4">
              {popular.map(([name, pct]) => (
                <div key={name}>
                  <div className="flex items-baseline justify-between text-[11px]">
                    <span className="font-medium">{name}</span>
                    <span className="text-muted-foreground">{pct}</span>
                  </div>
                  <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-muted">
                    <div
                      data-track-fill
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background:
                          "linear-gradient(90deg, var(--primary-deep), var(--primary-bright))",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-[9.5px] text-muted-foreground/70">
              Demo distribution for illustration.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
