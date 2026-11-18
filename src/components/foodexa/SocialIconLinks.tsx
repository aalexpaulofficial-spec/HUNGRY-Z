import { HUNGRY_SOCIAL_LINKS } from "@/lib/social-links";

const socialLinks = [
  { label: "Instagram", href: HUNGRY_SOCIAL_LINKS.instagram, src: "/INSTAGRAM%201.png" },
  { label: "WhatsApp", href: HUNGRY_SOCIAL_LINKS.whatsapp, src: "/WHATSAPP%202.png" },
  { label: "LinkedIn", href: HUNGRY_SOCIAL_LINKS.linkedin, src: "/LINKEDIN%203.png" },
] as const;

export function SocialIconLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`}>
      {socialLinks.map(({ label, href, src }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Follow HUNGRY Z on ${label}`}
          className="grid h-11 w-11 place-items-center overflow-hidden rounded-full border border-border bg-background/70 transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[0_0_20px_-6px_var(--primary-bright)] sm:h-12 sm:w-12"
        >
          <img src={src} alt="" aria-hidden="true" draggable={false} className="h-6 w-6 object-contain sm:h-7 sm:w-7" />
        </a>
      ))}
    </div>
  );
}
