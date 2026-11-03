import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, X } from "lucide-react";
import { LogoMark } from "@/components/foodexa/LogoMark";

const message = "HUNGRY Z is already installed on your device. You can launch it anytime from your home screen or desktop, or start ordering right now!";

export function AlreadyInstalledDialog({ onClose }: { onClose: () => void }) {
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
      <section aria-modal="true" aria-labelledby="pwa-installed-title" className="pwa-installed-dialog" role="dialog">
        <button aria-label="Close dialog" className="pwa-installed-close" onClick={onClose} type="button"><X aria-hidden="true" className="h-5 w-5" /></button>
        <div aria-label="HUNGRY Z" className="pwa-installed-logo-wrap" role="img">
          <LogoMark className="pwa-installed-logo" />
        </div>
        <h2 className="pwa-installed-title" id="pwa-installed-title">Already Installed</h2>
        <p className="pwa-installed-message">{message}</p>
        <button
          className="pwa-installed-primary border-0 font-[inherit] cursor-default disabled:opacity-100"
          disabled
          type="button"
        >
          Start Ordering in App<ArrowRight aria-hidden="true" className="h-5 w-5" />
        </button>
        <button className="pwa-installed-secondary" onClick={onClose} type="button">Close</button>
      </section>
    </div>,
    document.body,
  );
}
