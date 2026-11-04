import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { SocialIconLinks } from "@/components/foodexa/SocialIconLinks";
export { HUNGRY_SOCIAL_LINKS } from "@/lib/social-links";

export function SocialThankYouDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open, onClose]);

  return <AnimatePresence>
    {open && <motion.div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.section role="dialog" aria-modal="true" aria-labelledby="social-thank-you-title" className="glass-red relative my-auto w-full max-w-md overflow-hidden rounded-[2rem] p-6 text-center shadow-[var(--shadow-cinema)] sm:p-9" initial={{ y: 18, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 10, scale: 0.98 }} transition={{ type: "spring", stiffness: 260, damping: 24 }}>
        <button ref={closeButton} type="button" aria-label="Close thank-you message" onClick={onClose} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        <p className="mt-4 text-3xl" aria-hidden="true">❤️</p>
        <h2 id="social-thank-you-title" className="display mt-4 text-2xl leading-tight">THANK YOU FOR CHOOSING HUNGRY Z! ❤️</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Enjoyed your experience? Follow us and join our community for exclusive updates and announcements about FREE discount coupons when available.</p>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.22em] text-primary-bright">Follow &amp; Join HUNGRY Z</p>
        <SocialIconLinks className="mt-4 gap-4" />
        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">Join us, comment &quot;HUNGRYZ&quot; and stay connected for exclusive coupon announcements!</p>
      </motion.section>
    </motion.div>}
  </AnimatePresence>;
}
