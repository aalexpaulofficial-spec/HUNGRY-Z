import { Phone } from "./Phone";
import { useGsap } from "./use-gsap";
import { HeroInstallButton } from "./HeroInstallButton";

export function Hero() {
  const ref = useGsap(({ gsap, root }) => {
    const q = gsap.utils.selector(root);
    gsap.set(q("[data-reveal]"), { yPercent: 110 });
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.to(q("[data-reveal]"), { yPercent: 0, duration: 1.4, stagger: 0.09 })
      .from(q("[data-eyebrow]"), { opacity: 0, y: 14, duration: 1 }, 0.1)
      .from(q("[data-sub]"), { opacity: 0, y: 24, duration: 1.1, stagger: 0.08 }, 0.7)
      .from(
        q("[data-device]"),
        { opacity: 0, y: 120, rotateX: 22, rotateY: -16, duration: 1.8 },
        0.5,
      )
      .from(q("[data-fee]"), { opacity: 0, scale: 0.86, filter: "blur(18px)", duration: 1.6 }, 0.9);

    // On stacked (mobile/tablet) layouts the phone is the last thing in the hero, so a big
    // upward drift would open an empty gap beneath it — keep that drift subtle there.
    const wide = window.matchMedia("(min-width: 1024px)").matches;
    gsap.to(q("[data-device]"), {
      yPercent: wide ? -18 : -4,
      rotateZ: 4,
      rotateY: 14,
      scale: wide ? 0.94 : 0.98,
      ease: "none",
      scrollTrigger: { trigger: root, start: "top top", end: "bottom top", scrub: 1 },
    });
    gsap.to(q("[data-heroglow]"), {
      yPercent: 30,
      scale: 1.3,
      ease: "none",
      scrollTrigger: { trigger: root, start: "top top", end: "bottom top", scrub: 1 },
    });
    gsap.to(q("[data-headline]"), {
      yPercent: -40,
      opacity: 0.15,
      ease: "none",
      scrollTrigger: { trigger: root, start: "top top", end: "bottom top", scrub: 1 },
    });
  });

  return (
    <section
      id="top"
      ref={ref}
      className="relative isolate flex flex-col justify-center overflow-hidden grain pt-28 pb-10 lg:min-h-[100svh] lg:pb-16"
    >
      {/* atmospheric red light */}
      <div
        aria-hidden
        data-heroglow
        className="pointer-events-none absolute left-1/2 top-[42%] -z-10 h-[80vh] w-[130vw] -translate-x-1/2 -translate-y-1/2 ember anim-pulse-glow"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_120%,color-mix(in_oklab,var(--primary)18%,transparent),transparent_60%)]"
      />
      {/* light rays */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-40">
        {[18, 38, 62, 84].map((l, i) => (
          <span
            key={l}
            className="absolute top-[-20%] h-[140%] w-[1px] anim-drift"
            style={{
              left: `${l}%`,
              animationDelay: `${i * 1.4}s`,
              background:
                "linear-gradient(to bottom, transparent, color-mix(in oklab, var(--primary) 40%, transparent), transparent)",
            }}
          />
        ))}
      </div>
      {/* particles */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {Array.from({ length: 26 }).map((_, i) => (
          <span
            key={i}
            className="absolute h-[3px] w-[3px] rounded-full bg-primary-bright/70 anim-float"
            style={{
              left: `${(i * 37) % 97}%`,
              top: `${(i * 53) % 92}%`,
              animationDelay: `${(i % 7) * 0.8}s`,
              animationDuration: `${5 + (i % 5)}s`,
              opacity: 0.15 + ((i % 5) / 10),
            }}
          />
        ))}
      </div>

      <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-5 lg:grid-cols-[1.15fr_0.85fr] lg:gap-8">
        <div>
          <div
            data-eyebrow
            className="mb-7 flex flex-wrap items-center gap-3 text-[10px] tracking-[0.34em] text-muted-foreground"
          >
            <span className="rounded-full border border-primary/40 px-3 py-1 text-primary-bright">
              HUNGRY
            </span>
            <span>SMART CAMPUS FOOD ORDERING</span>
          </div>

          <h1 data-headline className="display text-[clamp(2.7rem,8.4vw,7.4rem)]">
            {["THE FUTURE OF", "CAMPUS FOOD", "IS HERE."].map((line, i) => (
              <span key={line} className="block overflow-hidden pb-[0.08em]">
                <span
                  data-reveal
                  className={i === 1 ? "block text-primary-bright text-glow" : "block"}
                >
                  {line}
                </span>
              </span>
            ))}
          </h1>

          <p
            data-sub
            className="mt-8 max-w-sm text-[15px] leading-relaxed text-muted-foreground sm:text-base"
          >
            Order faster. Skip the queue. Track your food. Enjoy your campus.
          </p>

          <div data-sub className="mt-9 flex flex-wrap items-center gap-3">
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
              <a
                href="/auth"
                className="group inline-flex min-w-0 shrink items-center justify-center gap-2 whitespace-nowrap rounded-full bg-primary px-4 py-3.5 text-[13px] font-semibold sm:px-6 sm:text-sm text-primary-foreground transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_44px_-6px_var(--primary-bright)]"
              >
                Start with HUNGRY
                <span className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1">
                  ↗
                </span>
              </a>
              <HeroInstallButton app="student" />
              <HeroInstallButton app="canteen" />
            </div>
            <a
              href="#students"
              className="group inline-flex items-center gap-2 rounded-full border border-border px-6 py-3.5 text-sm font-medium text-foreground/80 transition-colors duration-300 hover:border-primary/50 hover:text-foreground"
            >
              Explore HUNGRY
              <span className="transition-transform duration-300 group-hover:translate-y-1">↓</span>
            </a>
          </div>

          {/* ₹0 platform fee — premium product feature */}
          <div
            data-fee
            className="relative mt-14 flex items-center gap-6 overflow-hidden rounded-3xl border border-primary/20 bg-ink/50 px-6 py-6 backdrop-blur-sm"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -left-1/3 top-0 h-full w-1/3 anim-sweep bg-gradient-to-r from-transparent via-primary/25 to-transparent"
            />
            <span className="display text-[clamp(3.4rem,11vw,6.5rem)] leading-none text-primary-bright text-glow">
              ₹0
            </span>
            <span className="display text-[clamp(0.8rem,2.4vw,1.15rem)] leading-[1.25] tracking-[0.16em] text-foreground/85">
              PLATFORM
              <br />
              FEE
              <br />
              <span className="text-muted-foreground">EVERY ORDER</span>
            </span>
          </div>
        </div>

        <div
          data-device
          className="relative mx-auto flex justify-center [perspective:1400px]"
          style={{ transformStyle: "preserve-3d" }}
        >
          <Phone screen="home" className="rotate-[-4deg]" />
        </div>
      </div>
    </section>
  );
}
