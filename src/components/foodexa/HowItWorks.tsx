import { useGsap } from "./use-gsap";
import { Phone } from "./Phone";
import type { ScreenKey } from "./Phone";

const steps: { n: string; title: string; screen: ScreenKey }[] = [
  { n: "01", title: "DISCOVER.", screen: "menu" },
  { n: "02", title: "CHOOSE.", screen: "detail" },
  { n: "03", title: "ORDER.", screen: "cart" },
  { n: "04", title: "TRACK.", screen: "track" },
  { n: "05", title: "PICK UP.", screen: "qr" },
];

export function HowItWorks() {
  const ref = useGsap(({ gsap, root }) => {
    const track = root.querySelector<HTMLElement>("[data-hscroll]");
    if (!track) return;

    const distance = () => track.scrollWidth - window.innerWidth;

    const hTween = gsap.to(track, {
      x: () => -distance(),
      ease: "none",
      scrollTrigger: {
        trigger: root,
        start: "top top",
        end: () => `+=${distance() + window.innerHeight * 0.6}`,
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });

    gsap.utils.toArray<HTMLElement>("[data-slide]", root).forEach((slide) => {
      gsap.fromTo(
        slide.querySelectorAll("[data-slide-anim]"),
        { opacity: 0.15, y: 60, filter: "blur(12px)" },
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 1,
          stagger: 0.06,
          ease: "expo.out",
          scrollTrigger: {
            trigger: slide,
            containerAnimation: hTween,
            start: "left 78%",
            toggleActions: "play none none reverse",
          },
        },
      );
    });
  });

  return (
    <section ref={ref} className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/3 -z-10 w-[70vw] ember opacity-45"
      />
      <div className="flex h-[100svh] items-center">
        <div data-hscroll className="flex items-center will-change-transform">
          <div className="flex h-[100svh] w-[86vw] shrink-0 flex-col justify-center px-6 sm:w-[60vw] sm:px-16">
            <p className="text-[10px] tracking-[0.34em] text-muted-foreground">HOW IT WORKS</p>
            <h2 className="display mt-6 text-[clamp(2.4rem,8vw,6rem)]">
              FIVE MOVES
              <br />
              <span className="text-primary-bright">FROM HUNGRY</span>
              <br />
              TO DONE.
            </h2>
            <p className="mt-6 max-w-xs text-sm text-muted-foreground">Keep scrolling →</p>
          </div>

          {steps.map((s) => (
            <div
              key={s.n}
              data-slide
              className="flex h-[100svh] w-[92vw] shrink-0 items-center gap-8 px-6 sm:w-[70vw] sm:gap-16 sm:px-16"
            >
              <div className="flex-1">
                <p
                  data-slide-anim
                  className="display text-[clamp(4.5rem,17vw,13rem)] leading-none text-foreground/12"
                >
                  {s.n}
                </p>
                <h3
                  data-slide-anim
                  className="display -mt-4 text-[clamp(2.2rem,7vw,5.4rem)] text-primary-bright text-glow"
                >
                  {s.title}
                </h3>
              </div>
              <div data-slide-anim className="hidden shrink-0 sm:block">
                <Phone screen={s.screen} glow={false} />
              </div>
            </div>
          ))}

          <div className="flex h-[100svh] w-[80vw] shrink-0 flex-col justify-center px-6 sm:w-[50vw] sm:px-16">
            <p className="display text-[clamp(2rem,6vw,4.4rem)]">
              AND THE FEE?
              <br />
              <span className="text-primary-bright text-glow">₹0.</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
