import { useGsap } from "./use-gsap";
import faculty from "@/assets/faculty-campus.jpg";
import cafeteria from "@/assets/campus-cafeteria.jpg";

const features = [
  ["Easy ordering", "Order between classes in a few taps."],
  ["Scheduled meals", "Set your lunch slot ahead of time."],
  ["Digital receipts", "Every order archived, nothing printed."],
  ["Faster pickup", "Walk in, scan, walk out."],
  ["Live order tracking", "Know the moment your food is ready."],
];

export function FacultySection() {
  const ref = useGsap(({ gsap, root }) => {
    const q = gsap.utils.selector(root);
    gsap.to(q("[data-parallax-slow]"), {
      yPercent: -14,
      ease: "none",
      scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: 1 },
    });
    gsap.to(q("[data-parallax-fast]"), {
      yPercent: 18,
      ease: "none",
      scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: 1 },
    });
    gsap.fromTo(
      q("[data-mask]"),
      { clipPath: "inset(12% 12% 12% 12% round 2rem)" },
      {
        clipPath: "inset(0% 0% 0% 0% round 2rem)",
        ease: "none",
        scrollTrigger: { trigger: root, start: "top 80%", end: "center center", scrub: 1 },
      },
    );
    gsap.from(q("[data-line]"), {
      opacity: 0,
      x: -30,
      duration: 0.9,
      stagger: 0.08,
      ease: "expo.out",
      scrollTrigger: { trigger: (q("[data-list]")[0] as Element), start: "top 80%" },
    });
    gsap.from(q("[data-headline] span span"), {
      yPercent: 115,
      duration: 1.2,
      stagger: 0.07,
      ease: "expo.out",
      scrollTrigger: { trigger: root, start: "top 70%" },
    });
  });

  return (
    <section id="faculty" ref={ref} className="relative isolate overflow-hidden py-24 sm:py-36">
      <div className="mx-auto max-w-7xl px-5">
        <p className="mb-8 text-[10px] tracking-[0.34em] text-muted-foreground">FOR FACULTY</p>
        <div className="grid gap-14 lg:grid-cols-[1fr_1fr] lg:items-end">
          <h2 data-headline className="display text-[clamp(2.6rem,8vw,6.4rem)]">
            {["MADE FOR", "CAMPUS LIFE."].map((l, i) => (
              <span key={l} className="block overflow-hidden pb-[0.06em]">
                <span className={i === 1 ? "block text-primary-bright" : "block"}>{l}</span>
              </span>
            ))}
          </h2>
          <div data-list className="flex flex-col">
            {features.map(([title, body]) => (
              <div
                key={title}
                data-line
                className="group flex items-baseline justify-between gap-6 border-b border-border py-5 transition-colors duration-500 hover:border-primary/60"
              >
                <span className="display text-lg sm:text-xl">{title}</span>
                <span className="max-w-[16rem] text-right text-[12px] text-muted-foreground">
                  {body}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 grid gap-5 sm:mt-24 lg:grid-cols-[1.4fr_1fr]">
          <figure data-mask className="relative overflow-hidden rounded-3xl border border-border">
            <img
              data-parallax-slow
              src={faculty}
              alt="Faculty and students sharing a meal in a modern campus cafe"
              loading="lazy"
              width={1500}
              height={1100}
              className="h-[42vh] w-full scale-110 object-cover sm:h-[60vh]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
            <figcaption className="absolute bottom-6 left-6 max-w-xs">
              <p className="display text-xl">Lunch, without the logistics.</p>
              <p className="mt-2 text-[12px] text-muted-foreground">
                Pre-order in the morning. Collect between classes.
              </p>
            </figcaption>
          </figure>
          <figure className="relative overflow-hidden rounded-3xl border border-border">
            <img
              data-parallax-fast
              src={cafeteria}
              alt="Students collecting food at a campus canteen counter"
              loading="lazy"
              width={1600}
              height={1008}
              className="h-[42vh] w-full scale-110 object-cover sm:h-[60vh]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
            <figcaption className="absolute bottom-6 left-6">
              <p className="display text-xl">No queue. No cash. No fee.</p>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
