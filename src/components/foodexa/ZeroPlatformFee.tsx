import { useGsap } from "./use-gsap";
import { Phone } from "./Phone";

export function ZeroPlatformFee() {
  const ref = useGsap(({ gsap, root }) => {
    const q = gsap.utils.selector(root);

    gsap.timeline({
      scrollTrigger: {
        trigger: root,
        start: "top top",
        end: "+=200%",
        pin: (q("[data-stage]")[0] as Element),
        scrub: 1,
      },
    })
      .fromTo(
        q("[data-why]"),
        { opacity: 0, scale: 1.35, filter: "blur(14px)" },
        { opacity: 1, scale: 1, filter: "blur(0px)", duration: 1 },
      )
      .to(q("[data-why]"), { opacity: 0, scale: 0.85, filter: "blur(10px)", duration: 0.8 }, 1.2)
      .fromTo(
        q("[data-zero]"),
        { opacity: 0, scale: 0.35, z: -900 },
        { opacity: 1, scale: 1, z: 0, duration: 2, ease: "power2.out" },
        1.4,
      )
      .fromTo(q("[data-zero-sub]"), { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1 }, 2.6)
      .to(q("[data-zero]"), { scale: 1.6, opacity: 0.08, filter: "blur(6px)", duration: 1.6 }, 3.6)
      .to(q("[data-zero-sub]"), { opacity: 0, y: -30, duration: 0.8 }, 3.6)
      .fromTo(
        q("[data-yes]"),
        { opacity: 0, scale: 0.7, filter: "blur(18px)" },
        { opacity: 1, scale: 1, filter: "blur(0px)", duration: 1.4 },
        4.2,
      )
      .fromTo(q("[data-cta]"), { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1 }, 5)
      .to(q("[data-glow]"), { scale: 1.8, opacity: 1, duration: 5 }, 0);

    gsap.to(q("[data-floatphone]"), {
      yPercent: -30,
      rotateZ: -6,
      ease: "none",
      scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: 1 },
    });
  });

  return (
    <section ref={ref} id="fee" className="relative h-[320svh]">
      <div
        data-stage
        className="relative flex h-[100svh] items-center justify-center overflow-hidden grain"
      >
        <div
          aria-hidden
          data-glow
          className="pointer-events-none absolute left-1/2 top-1/2 h-[70vh] w-[95vw] -translate-x-1/2 -translate-y-1/2 ember opacity-60"
        />

        <div
          data-floatphone
          className="pointer-events-none absolute left-[4%] top-[16%] hidden opacity-70 lg:block"
        >
          <Phone screen="pay" glow={false} className="w-[190px] rotate-[8deg]" />
        </div>
        <div
          data-floatphone
          className="pointer-events-none absolute right-[4%] bottom-[12%] hidden opacity-70 lg:block"
        >
          <Phone screen="confirm" glow={false} className="w-[190px] rotate-[-10deg]" />
        </div>

        <div className="relative z-10 px-5 text-center [perspective:1200px]">
          <h2 data-why className="display text-[clamp(2.6rem,11vw,9rem)]">
            WHY PAY MORE?
          </h2>

          <div
            data-zero
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ transformStyle: "preserve-3d" }}
          >
            <span className="display text-[clamp(7rem,32vw,26rem)] leading-none text-primary-bright text-glow">
              ₹0
            </span>
            <span className="display mt-2 text-[clamp(1rem,4vw,2.6rem)] tracking-[0.22em]">
              PLATFORM FEE
            </span>
            <span className="mt-3 text-[clamp(0.7rem,2.4vw,1.1rem)] tracking-[0.3em] text-muted-foreground">
              EVERY ORDER.
            </span>
            <p
              data-zero-sub
              className="mx-auto mt-8 max-w-md px-6 text-sm text-muted-foreground"
            >
              Simple campus food ordering without unnecessary platform charges.
            </p>
          </div>


          <div
            data-yes
            className="absolute inset-0 flex flex-col items-center justify-center opacity-0"
          >
            <span className="display text-[clamp(3.4rem,15vw,12rem)] leading-[0.86]">
              YES.
              <br />
              <span className="text-primary-bright text-glow">ZERO.</span>
            </span>
            <a
              data-cta
              href="/auth"
              className="group mt-10 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-4 text-sm font-semibold text-primary-foreground transition-all duration-300 hover:scale-[1.04] hover:shadow-[0_0_50px_-6px_var(--primary-bright)]"
            >
              Start with HUNGRY
              <span className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1">
                ↗
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
