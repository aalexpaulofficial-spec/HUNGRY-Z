import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { LogoMark } from "@/components/foodexa/LogoMark";

export function HungryInstallGuideDialog({ onClose }: { onClose: () => void }) {
  const isAndroid = /android/i.test(navigator.userAgent);
  const isChrome = /chrome|chromium|edg/i.test(navigator.userAgent);
  const instructions = isAndroid
    ? "In Chrome, open the ⋮ menu and choose Install app. If that option is not shown, choose Add to Home screen."
    : isChrome
      ? "In Chrome, select the install icon in the address bar, or open the ⋮ menu and choose Install HUNGRY."
      : "Open this page in Chrome, then choose Install app or Add to Home screen from the browser menu.";

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="pwa-installed-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section aria-modal="true" aria-labelledby="pwa-install-guide-title" className="pwa-installed-dialog" role="dialog">
        <button aria-label="Close install guide" className="pwa-installed-close" onClick={onClose} type="button"><X aria-hidden="true" className="h-5 w-5" /></button>
        <div aria-label="HUNGRY" className="pwa-installed-logo-wrap" role="img">
          <LogoMark className="pwa-installed-logo" />
        </div>
        <h2 className="pwa-installed-title" id="pwa-install-guide-title">Install HUNGRY</h2>
        <p className="pwa-installed-message">Chrome has not offered its install prompt yet. You can install HUNGRY from your browser menu.</p>
        <div className="rounded-2xl border border-primary/25 bg-black/35 px-4 py-4 text-left text-sm leading-relaxed text-white/80">
          <p className="font-semibold text-white">{instructions}</p>
          <p className="mt-2 text-xs text-white/55">After installation, open HUNGRY from your Home Screen or app launcher.</p>
        </div>
        <button className="pwa-installed-secondary" onClick={onClose} type="button">Got it</button>
      </section>
    </div>,
    document.body,
  );
}
