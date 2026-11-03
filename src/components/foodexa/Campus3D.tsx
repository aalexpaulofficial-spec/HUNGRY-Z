import { useGsap } from "./use-gsap";

const chain = [
  { label: "CAMPUS", detail: "Every block, one system" },
  { label: "CANTEEN", detail: "Menus, live" },
  { label: "FOOD", detail: "Freshly prepared" },
  { label: "STUDENT", detail: "One tap order" },
  { label: "ORDER", detail: "Tracked end to end" },
  { label: "PICKUP", detail: "Scan. Collect. Go." },
];

export function Campus3D() {
  const ref = useGsap(({ gsap, root }) => {
    const q = gsap.utils.selector(root);

    gsap.to(q("[data-scene]"), {
      rotateX: -14,
      rotateY: 16,
      ease: "none",
      scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: 1 },
    });

    q("[data-node]").forEach((el, i) => {
      gsap.fromTo(
        el,
        { z: -600, opacity: 0, rotateY: 30 },
        {
          z: i * 40 - 100,
          opacity: 1,
          rotateY: 0,
          duration: 1.4,
          ease: "expo.out",
          scrollTrigger: { trigger: el, start: "top 90%" },
        },
      );
    });

    gsap.to(q("[data-cube]"), {
      rotateY: 360,
      rotateX: 25,
      ease: "none",
      scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: 1 },
    });
  });

  return (
    <section ref={ref} className="relative isolate overflow-hidden py-24 grain sm:py-36">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-[60vh] -translate-y-1/2 ember opacity-60"
      />
      <div className="mx-auto max-w-7xl px-5">
        <p className="mb-8 text-[10px] tracking-[0.34em] text-muted-foreground">
          THE HUNGRY LOOP
        </p>
        <h2 className="display max-w-3xl text-[clamp(2.2rem,6.6vw,5rem)]">
          ONE CAMPUS, <span className="text-primary-bright">RENDERED END TO END.</span>
        </h2>

        <div className="mt-16 grid items-center gap-14 lg:grid-cols-[1fr_0.8fr]">
          <div
            data-scene
            className="flex flex-col gap-3 [perspective:1400px]"
            style={{ transformStyle: "preserve-3d" }}
          >
            {chain.map((c, i) => (
              <div
                key={c.label}
                data-node
                className="relative flex items-center justify-between gap-6 rounded-2xl border border-border bg-ink/70 px-5 py-4 backdrop-blur-md sm:px-7 sm:py-5"
                style={{ transformStyle: "preserve-3d" }}
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-[2px] rounded-full"
                  style={{
                    background: `linear-gradient(to bottom, transparent, color-mix(in oklab, var(--primary-bright) ${
                      40 + i * 10
                    }%, transparent), transparent)`,
                  }}
                />
                <span className="display text-[clamp(1.4rem,4.4vw,2.6rem)]">{c.label}</span>
                <span className="text-right text-[11px] text-muted-foreground">{c.detail}</span>
              </div>
            ))}
          </div>

          {/* CSS 3D objects: food container, QR cube, order ticket */}
          <div className="relative mx-auto flex h-[46vh] w-full max-w-sm items-center justify-center [perspective:1000px] sm:h-[60vh]">
            <div
              data-cube
              className="relative h-40 w-40 anim-float"
              style={{ transformStyle: "preserve-3d" }}
            >
              {[
                { t: "translateZ(80px)", label: "QR" },
                { t: "rotateY(180deg) translateZ(80px)", label: "FX" },
                { t: "rotateY(90deg) translateZ(80px)", label: "₹0" },
                { t: "rotateY(-90deg) translateZ(80px)", label: "HUNGRY" },
                { t: "rotateX(90deg) translateZ(80px)", label: "PICKUP" },
                { t: "rotateX(-90deg) translateZ(80px)", label: "ORDER" },
              ].map((f) => (
                <div
                  key={f.t}
                  className="absolute inset-0 grid place-items-center rounded-2xl border border-primary/30 bg-ink/60 backdrop-blur-sm"
                  style={{
                    transform: f.t,
                    boxShadow: "0 0 60px -20px color-mix(in oklab, var(--primary) 60%, transparent)",
                  }}
                >
                  <span className="display text-lg text-primary-bright">{f.label}</span>
                </div>
              ))}
            </div>
            <div
              aria-hidden
              className="absolute bottom-6 h-10 w-48 rounded-[50%] bg-primary/25 blur-2xl"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
