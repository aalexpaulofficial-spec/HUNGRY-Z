import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, LoaderCircle, MapPin, Ticket } from "lucide-react";
import { EventLogoImage } from "@/components/foodexa/FacultyEventLogo";
import { getPublicFacultyEventTokenDetails } from "@/lib/hungry.functions";
import { formatFacultyEventSerial } from "@/lib/faculty-event-serial";

type PublicTokenDetails = {
  token_id: string;
  token_number: string;
  token_status: string;
  event_name: string;
  event_serial_number: number;
  event_description: string;
  event_date: string | null;
  venue: string;
  canteen_name: string;
  event_logo_url: string | null;
};

export const Route = createFileRoute("/event-token/$tokenId")({
  head: () => ({ meta: [{ title: "Event Token — HUNGRY Z" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: PublicEventTokenPage,
});

function PublicEventTokenPage() {
  const { tokenId } = Route.useParams();
  const getToken = useServerFn(getPublicFacultyEventTokenDetails);
  const [token, setToken] = useState<PublicTokenDetails | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void getToken({ data: { tokenId } }).then((result) => {
      if (active) setToken(result);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "This event token could not be loaded.");
    });
    return () => { active = false; };
  }, [getToken, tokenId]);

  return <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
    <section className="w-full max-w-lg rounded-3xl border border-primary/25 bg-card p-5 shadow-[var(--shadow-cinema)] sm:p-8">
      <a href="/" className="flex items-center justify-center gap-2 text-xs font-bold tracking-[0.2em] text-muted-foreground">
        <img src="/HUNGRY%20Z%20Q%20LOGO.png" alt="" className="h-8 w-8 rounded-full object-contain" />HUNGRY Z
      </a>
      {!token && !error && <p role="status" className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />Loading secure event token…</p>}
      {error && <div role="alert" className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-5 text-center"><Ticket className="mx-auto h-8 w-8 text-primary" /><h1 className="mt-3 text-xl font-bold text-foreground">Token unavailable</h1><p className="mt-2 text-sm text-muted-foreground">{error}</p></div>}
      {token && <div className="mt-7 text-center">
        {token.event_logo_url && <EventLogoImage src={token.event_logo_url} alt={`${token.event_name} event logo`} className="max-h-48" />}
        <p className="mt-5 text-[10px] font-black tracking-[0.2em] text-primary">{formatFacultyEventSerial(token.event_serial_number)}</p>
        <h1 data-no-translate className="display mt-2 break-words text-2xl text-foreground sm:text-3xl">{token.event_name}</h1>
        {token.event_description && <p data-no-translate className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{token.event_description}</p>}
        <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          {token.event_date && <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-primary" />{new Date(`${token.event_date}T00:00:00`).toLocaleDateString()}</span>}
          {token.venue && <span data-no-translate className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" />{token.venue}</span>}
        </div>
        <div className="mt-7 rounded-3xl border border-primary/30 bg-background p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Event token</p>
          <p aria-label="Event token number" className="display mt-2 text-6xl font-black leading-none tracking-[0.2em] text-foreground">{token.token_number}</p>
          <p className="mt-3 text-xs text-muted-foreground">Show this token number at <span data-no-translate>{token.canteen_name}</span> when you attend.</p>
          <p className="mt-3 inline-flex rounded-full border border-border px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{token.token_status}</p>
        </div>
        <a href="/" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground">Open HUNGRY Z</a>
      </div>}
    </section>
  </main>;
}
