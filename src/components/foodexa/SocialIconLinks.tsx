import { HUNGRY_SOCIAL_LINKS } from "@/lib/social-links";

const socialLinks = [
  { label: "Instagram", href: HUNGRY_SOCIAL_LINKS.instagram },
  { label: "WhatsApp", href: HUNGRY_SOCIAL_LINKS.whatsapp },
  { label: "LinkedIn", href: HUNGRY_SOCIAL_LINKS.linkedin },
] as const;

const sprite = "/Instagram%2C%20WhatsApp%2C%20and%20LinkedIn%20Icons.png";

export function SocialIconLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`}>
      {socialLinks.map(({ label, href }, index) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Follow HUNGRY Z on ${label}`}
          className="grid h-11 w-11 place-items-center overflow-hidden rounded-full border border-border bg-background/70 transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[0_0_20px_-6px_var(--primary-bright)] sm:h-12 sm:w-12"
        >
          <span aria-hidden="true" className="relative block h-11 w-11 overflow-hidden sm:h-12 sm:w-12">
            <img
              src={sprite}
              alt=""
              draggable={false}
              className="absolute left-0 top-0 h-full w-[300%] max-w-none"
              style={{ left: `${-index * 100}%` }}
            />
          </span>
        </a>
      ))}
    </div>
  );
}
