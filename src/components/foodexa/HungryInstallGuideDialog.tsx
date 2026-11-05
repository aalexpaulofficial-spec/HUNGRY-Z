import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { LogoMark } from "@/components/foodexa/LogoMark";
import { getInstallFallback } from "@/lib/pwa-install";

export function HungryInstallGuideDialog({ onClose, dismissed = false }: { onClose: () => void; dismissed?: boolean }) {
  const instructions = getInstallFallback("student");

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
        <div aria-label="HUNGRY Z" className="pwa-installed-logo-wrap" role="img">
          <LogoMark className="pwa-installed-logo" />
        </div>
        <h2 className="pwa-installed-title" id="pwa-install-guide-title">Install HUNGRY Z</h2>
        <p className="pwa-installed-message">{dismissed ? "The installation prompt was dismissed, so HUNGRY Z was not installed. You can install it later using the browser steps below." : "Your browser has not offered an installation prompt. Follow the steps for your browser below."}</p>
        <div className="rounded-2xl border border-primary/25 bg-card px-4 py-4 text-left text-sm leading-relaxed text-card-foreground">
          <p className="font-semibold">{instructions}</p>
          <p className="mt-2 text-xs text-muted-foreground">After installation, open HUNGRY Z from your Home Screen or app launcher.</p>
        </div>
        <button className="pwa-installed-secondary" onClick={onClose} type="button">Got it</button>
      </section>
    </div>,
    document.body,
  );
}
