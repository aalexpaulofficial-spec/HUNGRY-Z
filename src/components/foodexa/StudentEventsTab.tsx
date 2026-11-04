import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, MapPin, Ticket, X } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { issueFacultyEventToken } from "@/lib/hungry.functions";

type EventRow = {
  id: string;
  name: string;
  event_code: string;
  description: string;
  event_date: string | null;
  venue: string;
  approved_capacity: number;
  status: string;
};
type EventView = EventRow & { issued_tokens: number; tokens_remaining: number; capacity_available: boolean };
type IssuedToken = { token_number: string; approved_capacity: number; issued_tokens: number; tokens_remaining: number; already_issued: boolean };

export function StudentEventsTab({ canteenId, canteenName, userId }: { canteenId: string; canteenName: string; userId: string }) {
  const [events, setEvents] = useState<EventView[]>([]);
  const [picked, setPicked] = useState<EventView | null>(null);
  const [opened, setOpened] = useState<EventView | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [token, setToken] = useState<IssuedToken | null>(null);
  const issueToken = useServerFn(issueFacultyEventToken);

  const load = useCallback(async () => {
    const { data, error: queryError } = await supabase.from("faculty_events")
      .select("id,name,event_code,description,event_date,venue,approved_capacity,status")
      .eq("canteen_id", canteenId).eq("status", "published").order("created_at", { ascending: false });
    if (queryError) { setError("Could not load events. Reconnecting…"); setLoading(false); return; }
    const next: EventView[] = [];
    let capacityFailed = false;
    for (const row of (data ?? []) as EventRow[]) {
      const { data: stats, error: statsError } = await supabase.rpc("hungry_get_event_capacity", { p_event_id: row.id }).maybeSingle();
      if (statsError || !stats) capacityFailed = true;
      next.push({ ...row, issued_tokens: stats?.issued_tokens ?? 0, tokens_remaining: stats?.tokens_remaining ?? 0, capacity_available: !statsError && !!stats });
    }
    setEvents(next);
    setPicked((current) => current ? next.find((event) => event.id === current.id) ?? null : null);
    setOpened((current) => current ? next.find((event) => event.id === current.id) ?? null : null);
    setError(capacityFailed ? "Event availability is temporarily unavailable. Refreshing automatically…" : "");
    setLoading(false);
  }, [canteenId]);

  useEffect(() => {
    void load();
    const channel = supabase.channel(`student-events-${canteenId}-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "faculty_events", filter: `canteen_id=eq.${canteenId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "faculty_event_tokens", filter: `canteen_id=eq.${canteenId}` }, load)
      .subscribe();
    const retry = window.setInterval(() => void load(), 15000);
    return () => { window.clearInterval(retry); void supabase.removeChannel(channel); };
  }, [canteenId, load, userId]);

  function openEvent(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault(); setError(""); setToken(null);
    const found = events.find((row) => row.event_code === code && row.id === picked?.id);
    if (!found) { setError("That Event Code is invalid or this event is not published for the canteen."); return; }
    if (!found.capacity_available) { setError("Event availability is temporarily unavailable. Please try again shortly."); return; }
    if (found.tokens_remaining < 1) { setError("EVENT FULL"); return; }
    setOpened(found);
  }

  async function generateToken() {
    if (!opened) return;
    setError(""); setIssuing(true);
    try {
      const issued = await issueToken({ data: { eventId: opened.id, eventCode: code } });
      setToken(issued);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate the event token. Please try again.");
      await load();
    } finally { setIssuing(false); }
  }

  return <section className="space-y-5 pt-2" aria-label="Faculty Events">
    <div><h2 className="display text-2xl">Faculty Events</h2><p className="mt-1 text-sm text-muted-foreground">Enter the seven-digit Event Code to view event details and generate your participation token.</p></div>
    {loading && <p role="status" className="text-sm text-muted-foreground">Loading events…</p>}
    {!loading && events.length === 0 && <p className="rounded-3xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">No published events for this canteen yet.</p>}
    {events.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{events.map((event) => <button key={event.id} type="button" onClick={() => { setPicked(event); setOpened(null); setToken(null); setCode(""); setError(""); }} className={`rounded-2xl border p-4 text-left ${picked?.id === event.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}><span className="block font-semibold">{event.name}</span><span className="mt-1 block text-xs text-muted-foreground">{event.capacity_available ? `${event.tokens_remaining} tokens remaining` : "Availability refreshing"}</span></button>)}</div>}
    {!!events.length && <form onSubmit={openEvent} className="flex gap-2">
      <input required inputMode="numeric" pattern="[0-9]{7}" maxLength={7} value={code} onChange={(event) => setCode(event.currentTarget.value.replace(/\D/g, "").slice(0, 7))} placeholder="7-digit Event Code" aria-label="7-digit Event Code" className="min-w-0 flex-1 rounded-full border border-input bg-ink-soft px-4 py-3 text-center font-mono tracking-[0.3em]" />
      <button disabled={!picked} className="rounded-full bg-primary px-5 py-3 text-xs font-semibold text-primary-foreground disabled:opacity-50">Open Event</button>
    </form>}
    {error && <p role="alert" className="rounded-2xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary-bright">{error}</p>}
    {opened && <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/65 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setOpened(null); setToken(null); } }}>
      <section role="dialog" aria-modal="true" aria-labelledby="event-dialog-title" className="relative my-auto w-full max-w-lg rounded-3xl border border-primary/30 bg-card p-6 shadow-2xl">
        <button type="button" aria-label="Close event" onClick={() => { setOpened(null); setToken(null); }} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground"><X className="h-4 w-4" /></button>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Ticket className="h-6 w-6" /></div>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Event details</p>
        <h3 id="event-dialog-title" className="display mt-1 pr-9 text-2xl">{opened.name}</h3>
        {opened.description && <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{opened.description}</p>}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          {opened.event_date && <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-primary" />{new Date(`${opened.event_date}T00:00:00`).toLocaleDateString()}</span>}
          {opened.venue && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" />{opened.venue}</span>}
          <span>{opened.tokens_remaining} places remaining</span>
        </div>
        <div className="mt-5 rounded-2xl bg-ink-soft p-3 text-center text-xs text-muted-foreground">{canteenName} · Event Code verified</div>
        {token ? <div className="mt-5 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{token.already_issued ? "Your existing token" : "Your event token"}</p>
          <p className="display mt-1 text-5xl tracking-[0.2em]">{token.token_number}</p>
          <p className="mt-2 text-xs text-muted-foreground">Show this token at {canteenName} when you attend.</p>
          <div className="mx-auto mt-4 grid w-fit place-items-center rounded-2xl bg-white p-3"><QRCodeCanvas value={`${opened.id}:${token.token_number}`} size={156} /></div>
        </div> : <button type="button" disabled={issuing || !opened.capacity_available || opened.tokens_remaining < 1} onClick={() => void generateToken()} className="mt-5 w-full rounded-full bg-primary py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-50">{issuing ? "Generating…" : opened.tokens_remaining < 1 ? "EVENT FULL" : "Generate Token"}</button>}
      </section>
    </div>}
  </section>;
}
