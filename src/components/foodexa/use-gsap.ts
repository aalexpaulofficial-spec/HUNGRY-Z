import { useEffect, useRef, useState } from "react";

/** Registers GSAP + ScrollTrigger on the client and runs a scoped setup fn. */
export function useGsap(
  setup: (ctx: {
    gsap: typeof import("gsap").gsap;
    ScrollTrigger: typeof import("gsap/ScrollTrigger").ScrollTrigger;
    root: HTMLElement;
  }) => void,
  deps: unknown[] = [],
) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const ctx = gsap.context(() => setup({ gsap, ScrollTrigger, root }), root);
      // Images/fonts settle after triggers are created; recompute start positions.
      ScrollTrigger.refresh();
      const onLoad = () => ScrollTrigger.refresh();
      window.addEventListener("load", onLoad);
      const t = window.setTimeout(onLoad, 1200);
      cleanup = () => {
        window.removeEventListener("load", onLoad);
        window.clearTimeout(t);
        ctx.revert();
      };

    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px) and (pointer: fine)");
    setDesktop(mq.matches);
    const on = () => setDesktop(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desktop;
}
