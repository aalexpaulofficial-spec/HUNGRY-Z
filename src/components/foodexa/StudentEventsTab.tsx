import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, MapPin, Ticket, X } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { issueFacultyEventToken, listPublishedFacultyEventCards, verifyFacultyEventAccessCode } from "@/lib/hungry.functions";
import { EventLogoImage } from "@/components/foodexa/FacultyEventLogo";
import { SocialIconLinks } from "@/components/foodexa/SocialIconLinks";
import { formatFacultyEventSerial } from "@/lib/faculty-event-serial";
import { createFacultyEventTokenQrUrl } from "@/lib/faculty-event-token-qr";

type EventCard = {
  id: string;
  serial_number: number;
  name: string;
  description: string;
  event_date: string | null;
  venue: string;
  event_logo_url: string | null;
};
type SelectedEvent = Pick<EventCard, "id" | "serial_number">;
type EventToken = { id: string; token_number: string; status: string };
type VerifiedEvent = {
  id: string;
  name: string;
  serial_number: number;
  description: string;
  event_date: string | null;
  venue: string;
  tokens_remaining: number | null;
  is_event_creator: boolean;
  capacity_available: boolean;
  my_tokens: EventToken[];
  event_logo_url: string | null;
};

export function StudentEventsTab({ canteenId, canteenName, userId }: { canteenId: string; canteenName: string; userId: string }) {
  const [events, setEvents] = useState<EventCard[]>([]);
  const [selected, setSelected] = useState<SelectedEvent | null>(null);
  const [opened, setOpened] = useState<VerifiedEvent | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [verifiedCode, setVerifiedCode] = useState("");
  const [error, setError] = useState("");
  const [loadingError, setLoadingError] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const listEvents = useServerFn(listPublishedFacultyEventCards);
  const verifyCode = useServerFn(verifyFacultyEventAccessCode);
  const issueToken = useServerFn(issueFacultyEventToken);
  const openedEventId = opened?.id;
  const openedEventSerial = opened?.serial_number;

  const load = useCallback(async () => {
    try {
      const rows = await listEvents({ data: { canteenId } });
      setEvents(rows);
      setLoadingError("");
    } catch {
      setLoadingError("Could not load published events. Reconnecting…");
    } finally {
      setLoading(false);
    }
  }, [canteenId, listEvents]);

  useEffect(() => {
    void load();
    const retry = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(retry);
  }, [load, userId]);

  // Refresh only after access has been verified. This keeps each open dialog's
  // token and capacity information current without exposing it in the listing.
  useEffect(() => {
    if (!openedEventId || openedEventSerial === undefined || !verifiedCode) return;
    let active = true;
    const refresh = async () => {
      try {
        const details = await verifyCode({ data: { eventId: openedEventId, eventCode: verifiedCode } });
        if (active) setOpened(details);
      } catch {
        if (active) {
          setOpened(null);
          setVerifiedCode("");
          setSelected({ id: openedEventId, serial_number: openedEventSerial });
          setError("This event is no longer available. Enter the access code again.");
        }
      }
    };
    const retry = window.setInterval(() => void refresh(), 15000);
    return () => { active = false; window.clearInterval(retry); };
  }, [openedEventId, openedEventSerial, verifiedCode, verifyCode]);

  function closeDialogs() {
    setSelected(null);
    setOpened(null);
    setAccessCode("");
    setVerifiedCode("");
    setError("");
  }

  async function verifyEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    if (!/^[0-9]{7}$/.test(accessCode)) {
      setError("Enter the complete 7-digit Event Access Code.");
      return;
    }
    setError("");
    setVerifying(true);
    try {
      const details = await verifyCode({ data: { eventId: selected.id, eventCode: accessCode } });
      setOpened(details);
      setVerifiedCode(accessCode);
      setSelected(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid Event Access Code. Check the 7-digit code and try again.");
    } finally {
      setVerifying(false);
    }
  }

  async function generateToken() {
    if (!opened || !verifiedCode) return;
    setError("");
    setIssuing(true);
    try {
      await issueToken({ data: { eventId: opened.id, eventCode: verifiedCode } });
      const details = await verifyCode({ data: { eventId: opened.id, eventCode: verifiedCode } });
      setOpened(details);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate the event token. Please try again.");
    } finally {
      setIssuing(false);
    }
  }

  return <section className="space-y-5 pt-2" aria-label="Faculty Events">
    <div><h2 className="display text-2xl">Faculty Events</h2><p className="mt-1 text-sm text-muted-foreground">Choose a published event and enter its access code to view details and generate a participation token.</p></div>
    {loading && <p role="status" className="text-sm text-muted-foreground">Loading events…</p>}
    {loadingError && <p role="alert" className="rounded-2xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary-bright">{loadingError}</p>}
    {!loading && !loadingError && events.length === 0 && <p className="rounded-3xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">No published events for this canteen yet.</p>}
    {events.length > 0 && <div className="grid min-w-0 gap-3 sm:grid-cols-2">{events.map((event) => <article key={event.id} className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-5">
      {event.event_logo_url
        ? <EventLogoImage src={event.event_logo_url} alt={`${event.name} event image`} className="min-h-0 max-h-44 sm:min-h-0" />
        : <div aria-hidden="true" className="grid h-28 place-items-center rounded-2xl border border-border bg-ink-soft text-primary"><Ticket className="h-8 w-8" /></div>}
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-[10px] font-black tracking-[0.18em] text-primary">{formatFacultyEventSerial(event.serial_number)}</span>
        <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">Published event</span>
      </div>
      <h3 data-no-translate className="mt-2 break-words text-lg font-bold leading-tight text-foreground">{event.name}</h3>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {event.event_date && <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 shrink-0 text-primary" />{new Date(`${event.event_date}T00:00:00`).toLocaleDateString()}</span>}
        {event.venue && <span data-no-translate className="flex items-center gap-1.5"><MapPin className="h-4 w-4 shrink-0 text-primary" />{event.venue}</span>}
      </div>
      {event.description && <p data-no-translate className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{event.description}</p>}
      <button type="button" onClick={() => { setSelected(event); setAccessCode(""); setError(""); }} aria-label={`View event ${formatFacultyEventSerial(event.serial_number)}`} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">View Event</button>
    </article>)}</div>}

    {selected && !opened && <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/65 p-3 sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialogs(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="event-code-dialog-title" className="relative my-auto w-full max-w-md rounded-3xl border border-primary/30 bg-card p-5 sm:p-6">
        <button type="button" aria-label="Close event" onClick={closeDialogs} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground"><X className="h-4 w-4" /></button>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Ticket className="h-6 w-6" /></div>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{formatFacultyEventSerial(selected.serial_number)}</p>
        <h3 id="event-code-dialog-title" className="display mt-1 pr-9 text-2xl">Verify Event Access</h3>
        <p className="mt-2 text-sm text-muted-foreground">Enter the event’s 7-digit Event Access Code to view its details and generate a token.</p>
        <form className="mt-5 space-y-3" onSubmit={(event) => void verifyEvent(event)}>
          <label htmlFor="faculty-event-access-code" className="block text-xs font-bold uppercase tracking-wide">7-digit Event Access Code</label>
          <input id="faculty-event-access-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{7}" maxLength={7} required value={accessCode} onChange={(event) => setAccessCode(event.currentTarget.value.replace(/\D/g, "").slice(0, 7))} placeholder="1234567" aria-describedby={error ? "event-access-code-error" : undefined} className="w-full rounded-2xl border border-input bg-ink-soft px-4 py-3 text-center font-mono text-xl tracking-[0.35em] text-foreground placeholder:text-sm placeholder:tracking-[0.15em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
          {error && <p id="event-access-code-error" role="alert" className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary-bright">{error}</p>}
          <button type="submit" disabled={verifying || accessCode.length !== 7} className="w-full rounded-full bg-primary py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-50">{verifying ? "Verifying…" : "Verify Code"}</button>
        </form>
      </section>
    </div>}

    {opened && <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/65 p-3 sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialogs(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="event-dialog-title" className="relative my-auto max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-primary/30 bg-card p-5 sm:p-6">
        <button type="button" aria-label="Close event" onClick={closeDialogs} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground"><X className="h-4 w-4" /></button>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Ticket className="h-6 w-6" /></div>
        {opened.event_logo_url && <EventLogoImage src={opened.event_logo_url} alt={`${opened.name} event logo`} className="mt-4 max-h-52" />}
        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Event details</p>
        <p className="mt-2 text-xs font-black tracking-[0.18em] text-primary">{formatFacultyEventSerial(opened.serial_number)}</p>
        <h3 data-no-translate id="event-dialog-title" className="display mt-1 pr-9 text-2xl">{opened.name}</h3>
        {opened.description && <p data-no-translate className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{opened.description}</p>}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          {opened.event_date && <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-primary" />{new Date(`${opened.event_date}T00:00:00`).toLocaleDateString()}</span>}
          {opened.venue && <span data-no-translate className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" />{opened.venue}</span>}
          {opened.is_event_creator && opened.tokens_remaining !== null && <span>{opened.tokens_remaining} places remaining</span>}
        </div>
        {opened.is_event_creator && !opened.capacity_available && opened.my_tokens.length === 0 && <p role="status" className="mt-4 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-3 text-sm font-semibold text-amber-800 dark:text-amber-200">This event has reached its token capacity.</p>}
        <div className="mt-5 rounded-2xl bg-ink-soft p-3 text-center text-xs text-muted-foreground"><span data-no-translate>{canteenName}</span> · Published event</div>
        {opened.my_tokens.length > 0 ? <div className="mt-5 space-y-3">
          <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-primary">Your event tokens</p>
          <div className="grid gap-3 sm:grid-cols-2">{opened.my_tokens.map((item) => <div key={item.id} className="rounded-2xl border border-primary/30 bg-card p-4 text-center shadow-[0_12px_36px_-24px_var(--primary-bright)]">
            <p className="text-xs font-black tracking-[0.22em] text-primary">FOLLOW US</p>
            <SocialIconLinks className="mt-2 gap-2" />
            <p className="mt-4 text-[10px] font-black tracking-[0.18em] text-primary">{formatFacultyEventSerial(opened.serial_number)}</p>
            <p aria-label="Your event token number" className="display mt-1 text-5xl font-black leading-none tracking-[0.18em] text-foreground sm:text-6xl">{item.token_number}</p>
            <p className="mt-3 text-xs font-semibold text-muted-foreground">Show this token number at <span data-no-translate>{canteenName}</span> when you attend.</p>
            <div className="mx-auto mt-3 grid w-fit place-items-center rounded-2xl bg-white p-2"><QRCodeCanvas value={createFacultyEventTokenQrUrl(item.id)} size={160} level="M" title="Scan to view secure HUNGRY Z event token details" /></div>
          </div>)}</div>
        </div> : <button type="button" disabled={issuing || (opened.is_event_creator && !opened.capacity_available)} onClick={() => void generateToken()} className="mt-5 w-full rounded-full bg-primary py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-50">{issuing ? "Generating…" : opened.is_event_creator && !opened.capacity_available ? "EVENT FULL" : "Generate Token"}</button>}
        {error && <p role="alert" className="mt-4 rounded-2xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary-bright">{error}</p>}
      </section>
    </div>}
  </section>;
}
