import { useIsDesktop } from "./use-gsap";
import { useEffect, useRef } from "react";

export function Cursor() {
  const desktop = useIsDesktop();
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!desktop) return;
    let rx = window.innerWidth / 2;
    let ry = window.innerHeight / 2;
    let tx = rx;
    let ty = ry;
    let raf = 0;

    const move = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (dot.current) dot.current.style.transform = `translate3d(${tx}px,${ty}px,0)`;
      const interactive = (e.target as HTMLElement)?.closest("a,button");
      if (ring.current) ring.current.dataset["hot"] = interactive ? "1" : "0";
      if (!raf) raf = requestAnimationFrame(loop);
    };
    // The ring eases toward the pointer and the loop sleeps once it has caught up.
    const loop = () => {
      rx += (tx - rx) * 0.22;
      ry += (ty - ry) * 0.22;
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px,${ry}px,0)`;
      raf = Math.abs(tx - rx) + Math.abs(ty - ry) > 0.5 ? requestAnimationFrame(loop) : 0;
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.body.style.cursor = "none";
    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(raf);
      document.body.style.cursor = "";
    };
  }, [desktop]);

  if (!desktop) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[100]">
      <div
        ref={ring}
        data-hot="0"
        className="absolute -ml-5 -mt-5 h-10 w-10 rounded-full border border-primary/60 transition-[width,height,margin,opacity] duration-300 data-[hot='1']:-ml-8 data-[hot='1']:-mt-8 data-[hot='1']:h-16 data-[hot='1']:w-16 data-[hot='1']:border-primary-bright"
      />
      <div ref={dot} className="absolute -ml-[3px] -mt-[3px] h-1.5 w-1.5 rounded-full bg-primary-bright" />
    </div>
  );
}
