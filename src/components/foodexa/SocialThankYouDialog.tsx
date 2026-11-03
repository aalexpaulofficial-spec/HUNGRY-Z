import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Instagram, Linkedin, MessageCircle, X } from "lucide-react";

export const HUNGRY_SOCIAL_LINKS = {
  instagram: "https://www.instagram.com/hungryz___?obrf=MTBoOHp3ZjJzZW9tdg==",
  whatsapp: "https://chat.whatsapp.com/LlhEK43VNYE6zWZBX9hYqM",
  linkedin: "https://www.linkedin.com/company/hungryz/",
} as const;

function WhatsAppMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M12 2a9.8 9.8 0 0 0-8.4 14.8L2.3 22l5.3-1.4A10 10 0 1 0 12 2Zm0 17.9a8 8 0 0 1-4.1-1.1l-.3-.2-3.1.8.8-3-.2-.3A8 8 0 1 1 12 19.9Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1-.2.2-.6.8-.8 1-.1.2-.3.2-.5.1-1.4-.7-2.3-1.3-3.2-2.9-.2-.3.2-.3.7-1.3.1-.2 0-.4 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.2-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.2.2-.6.2-1.1.2-1.2-.1-.2-.3-.3-.5-.4Z" /></svg>;
}

const socialActions = [
  { label: "Instagram", href: HUNGRY_SOCIAL_LINKS.instagram, Icon: Instagram },
  { label: "WhatsApp", href: HUNGRY_SOCIAL_LINKS.whatsapp, Icon: WhatsAppMark },
  { label: "LinkedIn", href: HUNGRY_SOCIAL_LINKS.linkedin, Icon: Linkedin },
] as const;

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
        <div className="mt-4 flex items-center justify-center gap-4">
          {socialActions.map(({ label, href, Icon }) => <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Follow HUNGRY Z on ${label}`} className="grid h-12 w-12 place-items-center rounded-full border border-border bg-background/50 text-foreground transition hover:border-primary hover:bg-primary/10 hover:text-primary-bright"><Icon /></a>)}
        </div>
        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">Join us, comment &quot;HUNGRYZ&quot; and stay connected for exclusive coupon announcements!</p>
      </motion.section>
    </motion.div>}
  </AnimatePresence>;
}
