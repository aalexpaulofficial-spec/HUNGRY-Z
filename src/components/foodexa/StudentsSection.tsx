import { Phone } from "./Phone";
import { useGsap } from "./use-gsap";
import burger from "@/assets/food-burger.jpg";
import indian from "@/assets/food-indian.jpg";
import pizza from "@/assets/food-pizza.jpg";
import bowl from "@/assets/food-bowl.jpg";
import coffee from "@/assets/food-coffee.jpg";

const gallery = [
  { src: indian, label: "Masala Dosa Thali", depth: 0.22 },
  { src: burger, label: "Campus Black Burger", depth: -0.16 },
  { src: pizza, label: "Wood-Fired Margherita", depth: 0.3 },
  { src: bowl, label: "Paneer Rice Bowl", depth: -0.24 },
  { src: coffee, label: "Masala Chai", depth: 0.14 },
];

export function StudentsSection() {
  const ref = useGsap(({ gsap, root }) => {
    const q = gsap.utils.selector(root);

    q("[data-word]").forEach((el, i) => {
      gsap.from(el, {
        yPercent: 120,
        opacity: 0,
        duration: 1.2,
        ease: "expo.out",
        delay: i * 0.06,
        scrollTrigger: { trigger: root, start: "top 70%" },
      });
    });

    q("[data-food]").forEach((el) => {
      const depth = Number((el as HTMLElement).dataset["depth"] ?? 0);
      gsap.fromTo(
        el,
        { clipPath: "inset(0% 0% 100% 0%)", scale: 1.15 },
        {
          clipPath: "inset(0% 0% 0% 0%)",
          scale: 1,
          duration: 1.5,
          ease: "expo.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
        },
      );
      gsap.to(el, {
        yPercent: depth * 100,
        ease: "none",
        scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: 1 },
      });
    });

    gsap.to(q("[data-phone]"), {
      yPercent: -12,
      rotateY: -12,
      ease: "none",
      scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: 1 },
    });
  });

  return (
    <section
      id="students"
      ref={ref}
      className="relative isolate overflow-hidden py-24 sm:py-36"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-1/4 top-1/3 -z-10 h-[60vh] w-[80vw] ember opacity-60"
      />
      <div className="mx-auto max-w-7xl px-5">
        <div className="grid items-center gap-16 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <p className="mb-8 text-[10px] tracking-[0.34em] text-muted-foreground">FOR STUDENTS</p>
            <h2 className="display text-[clamp(2.6rem,8vw,6.4rem)]">
              {["FOOD,", "WITHOUT", "THE WAIT."].map((w, i) => (
                <span key={w} className="block overflow-hidden pb-[0.06em]">
                  <span data-word className={i === 2 ? "block text-primary-bright" : "block"}>
                    {w}
                  </span>
                </span>
              ))}
            </h2>
            <p className="mt-8 max-w-md text-base text-muted-foreground">
              Your campus food experience, redesigned.
            </p>
            <div className="mt-10 flex flex-wrap gap-8">
              {[
                ["₹0", "Platform fee"],
                ["6 min", "Typical pickup"],
                ["Live", "Order status"],
              ].map(([big, small]) => (
                <div key={small}>
                  <p className="display text-3xl text-foreground">{big}</p>
                  <p className="mt-1 text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                    {small}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div data-phone className="mx-auto [perspective:1200px]">
            <Phone screen="menu" />
          </div>
        </div>

        <div className="mt-24 grid grid-cols-2 gap-4 sm:mt-36 sm:gap-6 lg:grid-cols-5">
          {gallery.map((g, i) => (
            <figure
              key={g.label}
              data-food
              data-depth={g.depth}
              className={
                "group relative overflow-hidden rounded-3xl border border-border " +
                (i === 0 ? "col-span-2 lg:col-span-2" : "")
              }
            >
              <img
                src={g.src}
                alt={g.label}
                loading="lazy"
                width={1100}
                height={1400}
                className="h-56 w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 sm:h-72"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/10 to-transparent" />
              <figcaption className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-2">
                <span className="text-[11px] font-semibold tracking-wide">{g.label}</span>
                <span className="text-[10px] text-primary-bright">₹0 fee</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
