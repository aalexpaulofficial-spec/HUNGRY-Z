import { HUNGRY_SOCIAL_LINKS } from "@/lib/social-links";

const socialLinks = [
  { label: "Instagram", href: HUNGRY_SOCIAL_LINKS.instagram, src: "/social-instagram-email.png?v=3" },
  { label: "WhatsApp", href: HUNGRY_SOCIAL_LINKS.whatsapp, src: "/social-whatsapp-email.png?v=3" },
  { label: "LinkedIn", href: HUNGRY_SOCIAL_LINKS.linkedin, src: "/social-linkedin-email.png?v=3" },
] as const;

export function SocialIconLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex w-full items-center justify-center gap-3 ${className}`}>
      {socialLinks.map(({ label, href, src }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Follow HUNGRY Z on ${label}`}
          className="grid h-12 w-12 place-items-center overflow-hidden rounded-[18px] border border-border bg-background/70 transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[0_0_20px_-6px_var(--primary-bright)] sm:h-14 sm:w-14"
        >
          <img src={src} alt="" aria-hidden="true" draggable={false} className="h-10 w-10 rounded-[13px] object-contain sm:h-12 sm:w-12" />
        </a>
      ))}
    </div>
  );
}
