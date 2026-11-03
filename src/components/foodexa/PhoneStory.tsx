import { useState } from "react";
import { Phone, type ScreenKey } from "./Phone";
import { useGsap } from "./use-gsap";

const steps: {
  step: string;
  title: string;
  body: string;
  screen: ScreenKey;
  rotate: number;
}[] = [
  { step: "STEP 01", title: "DISCOVER", body: "Browse your campus food.", screen: "menu", rotate: -8 },
  { step: "STEP 02", title: "ORDER", body: "Choose your meal in seconds.", screen: "detail", rotate: 6 },
  { step: "STEP 03", title: "TRACK", body: "See your order status live.", screen: "track", rotate: -5 },
  { step: "STEP 04", title: "PICK UP", body: "Scan. Collect. Go.", screen: "qr", rotate: 9 },
  { step: "STEP 05", title: "PAY ₹0", body: "No platform fee.", screen: "pay", rotate: 0 },
];

export function PhoneStory() {
  const [active, setActive] = useState(0);

  const ref = useGsap(({ gsap, root }) => {
    const q = gsap.utils.selector(root);
    const phone = (q("[data-phone]")[0] as Element);

    steps.forEach((s, i) => {
      const panel = (q(`[data-panel="${i}"]`)[0] as Element);
      if (!panel) return;
      gsap.timeline({
        scrollTrigger: {
          trigger: panel,
          start: "top 60%",
          end: "bottom 40%",
          onEnter: () => setActive(i),
          onEnterBack: () => setActive(i),
        },
      });
      gsap.fromTo(
        panel.querySelectorAll("[data-anim]"),
        { opacity: 0, y: 40, filter: "blur(10px)" },
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 1,
          stagger: 0.08,
          ease: "expo.out",
          scrollTrigger: { trigger: panel, start: "top 75%" },
        },
      );
      if (phone) {
        gsap.to(phone, {
          rotateY: s.rotate,
          rotateZ: s.rotate / 4,
          scale: i === 4 ? 1.06 : 1,
          ease: "power2.out",
          duration: 1,
          scrollTrigger: { trigger: panel, start: "top 60%", toggleActions: "play none none reverse" },
        });
      }
    });
  });

  return (
    <section ref={ref} className="relative isolate">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/4 -z-10 h-[70vh] ember opacity-50 transition-opacity duration-700"
      />
      <div className="mx-auto max-w-7xl px-5">
        <div className="grid lg:grid-cols-[1fr_auto_1fr] lg:gap-10">
          {/* left column: panels */}
          <div className="lg:col-span-1">
            {steps.map((s, i) => (
              <div
                key={s.step}
                data-panel={i}
                className="flex min-h-[80svh] flex-col justify-center py-14 lg:min-h-screen"
              >
                <p data-anim className="text-[10px] tracking-[0.34em] text-primary-bright">
                  {s.step}
                </p>
                <h3
                  data-anim
                  className="display mt-5 text-[clamp(2.6rem,9vw,5.6rem)] leading-[0.92]"
                >
                  {s.title}
                </h3>
                <p data-anim className="mt-5 max-w-sm text-base text-muted-foreground">
                  {s.body}
                </p>
                {/* mobile inline phone */}
                <div className="mt-10 flex justify-center lg:hidden">
                  <Phone screen={s.screen} />
                </div>
              </div>
            ))}
          </div>

          {/* pinned phone (desktop) */}
          <div className="sticky top-0 hidden h-screen items-center justify-center lg:flex lg:col-start-2">
            <div className="[perspective:1500px]">
              <div
                data-phone
                className="transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{ transformStyle: "preserve-3d" }}
              >
                <Phone screen={steps[active]?.screen ?? "menu"} />
              </div>
            </div>
          </div>

          <div className="hidden lg:block lg:col-start-3">
            <div className="sticky top-0 flex h-screen flex-col justify-center gap-4">
              {steps.map((s, i) => (
                <div
                  key={s.step}
                  className={
                    "flex items-center gap-4 border-l pl-5 transition-all duration-500 " +
                    (i === active
                      ? "border-primary text-foreground"
                      : "border-border text-muted-foreground/50")
                  }
                >
                  <span className="display text-2xl">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-[11px] tracking-[0.24em]">{s.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
