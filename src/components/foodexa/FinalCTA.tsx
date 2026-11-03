import { useGsap } from "./use-gsap";
import burger from "@/assets/food-burger.jpg";
import bowl from "@/assets/food-bowl.jpg";
import coffee from "@/assets/food-coffee.jpg";
import qr from "@/assets/qr-pickup.jpg";
import { Phone } from "./Phone";

export function FinalCTA() {
  const ref = useGsap(({ gsap, root }) => {
    const q = gsap.utils.selector(root);
    gsap.from(q("[data-headline] span span"), {
      yPercent: 118,
      duration: 1.4,
      stagger: 0.08,
      ease: "expo.out",
      scrollTrigger: { trigger: root, start: "top 65%" },
    });
    gsap.fromTo(
      q("[data-fee]"),
      { opacity: 0, scale: 0.7, filter: "blur(16px)" },
      {
        opacity: 1,
        scale: 1,
        filter: "blur(0px)",
        duration: 1.6,
        ease: "expo.out",
        scrollTrigger: { trigger: (q("[data-fee]")[0] as Element), start: "top 88%" },
      },
    );
    q("[data-float]").forEach((el, i) => {
      gsap.to(el, {
        yPercent: i % 2 === 0 ? -34 : 26,
        rotate: i % 2 === 0 ? -8 : 7,
        ease: "none",
        scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: 1 },
      });
    });
    gsap.to(q("[data-glow]"), {
      scale: 1.4,
      ease: "none",
      scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: 1 },
    });
  });

  const floats = [
    { src: burger, alt: "Campus burger", cls: "left-[3%] top-[12%] w-24 sm:w-40" },
    { src: bowl, alt: "Rice bowl", cls: "right-[5%] top-[18%] w-20 sm:w-36" },
    { src: coffee, alt: "Masala chai", cls: "left-[8%] bottom-[14%] w-20 sm:w-32" },
    { src: qr, alt: "QR pickup at the counter", cls: "right-[7%] bottom-[10%] w-28 sm:w-48" },
  ];

  return (
    <section
      id="start"
      ref={ref}
      className="relative isolate flex min-h-[100svh] items-center overflow-hidden grain py-28"
    >
      <div
        aria-hidden
        data-glow
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[75vh] w-[100vw] -translate-x-1/2 -translate-y-1/2 ember anim-pulse-glow opacity-70"
      />

      {floats.map((f) => (
        <img
          key={f.alt}
          data-float
          src={f.src}
          alt={f.alt}
          loading="lazy"
          width={400}
          height={400}
          className={`pointer-events-none absolute -z-10 rounded-2xl border border-border object-cover opacity-45 ${f.cls}`}
        />
      ))}

      <div className="mx-auto w-full max-w-6xl px-5 text-center">
        <h2 data-headline className="display text-[clamp(2.3rem,8vw,6.6rem)]">
          {["YOUR CAMPUS.", "YOUR FOOD.", "YOUR HUNGRY."].map((l, i) => (
            <span key={l} className="block overflow-hidden pb-[0.06em]">
              <span className={i === 2 ? "block text-primary-bright text-glow" : "block"}>{l}</span>
            </span>
          ))}
        </h2>
        <p className="mt-8 text-[11px] tracking-[0.32em] text-muted-foreground sm:text-xs">
          THE SMARTER WAY TO ORDER ON CAMPUS.
        </p>

        <div
          data-fee
          className="mx-auto mt-12 flex max-w-2xl flex-wrap items-center justify-center gap-4 rounded-[2rem] border border-primary/25 bg-ink/50 px-6 py-8 backdrop-blur-sm"
        >
          <span className="display text-[clamp(3.6rem,14vw,8rem)] leading-none text-primary-bright text-glow">
            ₹0
          </span>
          <span className="display text-left text-[clamp(0.9rem,3vw,1.6rem)] leading-[1.2] tracking-[0.18em]">
            PLATFORM
            <br />
            FEE
          </span>
        </div>

        <div id="login" className="mt-12 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/auth"
            className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-4 text-sm font-semibold text-primary-foreground transition-all duration-300 hover:scale-[1.04] hover:shadow-[0_0_50px_-6px_var(--primary-bright)]"
          >
            Start with HUNGRY
            <span className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1">
              ↗
            </span>
          </a>
          <a
            href="#institutions"
            className="inline-flex items-center gap-2 rounded-full border border-border px-7 py-4 text-sm font-medium text-foreground/85 transition-colors duration-300 hover:border-primary/50"
          >
            Talk to your institution
          </a>
        </div>

        <div className="mt-16 flex justify-center lg:hidden">
          <Phone screen="qr" glow={false} className="w-[190px]" />
        </div>
      </div>
    </section>
  );
}
