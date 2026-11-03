import { useEffect, useRef } from "react";

const rows: { items: string[]; speed: number; accentIndex?: number }[] = [
  { items: ["SMART CAMPUS FOOD", "₹0 PLATFORM FEE", "FAST ORDERS"], speed: -1, accentIndex: 1 },
  { items: ["NO QUEUES", "LIVE TRACKING", "SMART CAMPUS"], speed: 0.6 },
  { items: ["HUNGRY", "₹0 PLATFORM FEE", "HUNGRY"], speed: -0.35, accentIndex: 1 },
];

export function Marquee() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const tracks = Array.from(el.querySelectorAll<HTMLElement>("[data-track]"));
    const offsets = tracks.map(() => 0);
    let last = window.scrollY;
    let velocity = 0;
    let raf = 0;
    let visible = false;
    // Measure once (and on resize) instead of every frame — reading scrollWidth
    // inside the animation loop forced a layout on every frame.
    let halves = tracks.map((t) => t.scrollWidth / 2);
    const ro = new ResizeObserver(() => {
      halves = tracks.map((t) => t.scrollWidth / 2);
    });
    tracks.forEach((t) => ro.observe(t));

    const onScroll = () => {
      velocity += (window.scrollY - last) * 0.35;
      last = window.scrollY;
    };

    const loop = () => {
      velocity *= 0.9;
      tracks.forEach((track, i) => {
        const base = Number(track.dataset["speed"] ?? 1);
        offsets[i] = (offsets[i] ?? 0) - base * (0.7 + Math.abs(velocity) * 0.05) - velocity * base * 0.35;
        const half = halves[i] ?? 0;
        if (half > 0) {
          if ((offsets[i] as number) <= -half) offsets[i] = (offsets[i] as number) + half;
          if ((offsets[i] as number) > 0) offsets[i] = (offsets[i] as number) - half;
        }
        track.style.transform = `translate3d(${offsets[i]}px,0,0)`;
      });
      raf = visible ? requestAnimationFrame(loop) : 0;
    };

    // Only animate while the marquee is on screen.
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      if (visible && !raf) {
        last = window.scrollY;
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(el);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section
      ref={root}
      aria-label="HUNGRY highlights"
      className="relative isolate overflow-hidden border-y border-border bg-ink py-10 grain sm:py-14"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent sm:w-48"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent sm:w-48"
      />
      <div className="flex flex-col gap-3 sm:gap-5">
        {rows.map((row, ri) => (
          <div key={ri} className="overflow-hidden">
            <div data-track data-speed={row.speed} className="marquee-track">
              {[0, 1].map((dup) => (
                <div key={dup} className="flex shrink-0">
                  {row.items.map((item, i) => {
                    const accent = row.accentIndex === i;
                    return (
                      <span
                        key={`${item}-${i}`}
                        className={
                          "display px-6 text-[clamp(1.9rem,6vw,5rem)] whitespace-nowrap sm:px-10 " +
                          (accent
                            ? "text-primary-bright text-glow"
                            : ri === 1
                              ? "text-foreground/25"
                              : "text-foreground/70")
                        }
                      >
                        {item}
                        <span className="px-6 text-primary/40 sm:px-10">/</span>
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
