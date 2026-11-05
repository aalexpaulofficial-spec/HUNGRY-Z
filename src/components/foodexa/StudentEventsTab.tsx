import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, MapPin, Minus, Plus, Ticket, X } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { issueFacultyEventToken, requestAdditionalFacultyEventTokens } from "@/lib/hungry.functions";
import { getFacultyEventLogoUrls } from "@/lib/faculty-event-logos";
import { EventLogoImage } from "@/components/foodexa/FacultyEventLogo";

type EventRow = {
  id: string; name: string; event_code: string; description: string;
  event_date: string | null; venue: string; approved_capacity: number; status: string; event_logo_path: string | null;
};
type EventView = EventRow & { issued_tokens: number; tokens_remaining: number; capacity_available: boolean; event_logo_url?: string };
type IssuedToken = { token_number: string; approved_capacity: number; issued_tokens: number; tokens_remaining: number; already_issued: boolean };
type ParticipantToken = { id: string; event_id: string; token_number: string; status: string };
type TokenRequest = { id: string; event_id: string; requested_count: number; status: string; canteen_note: string; created_at: string };

export function StudentEventsTab({ canteenId, canteenName, userId }: { canteenId: string; canteenName: string; userId: string }) {
  const [events, setEvents] = useState<EventView[]>([]);
  const [picked, setPicked] = useState<EventView | null>(null);
  const [opened, setOpened] = useState<EventView | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestedCount, setRequestedCount] = useState(1);
  const [token, setToken] = useState<IssuedToken | null>(null);
  const [participantTokens, setParticipantTokens] = useState<ParticipantToken[]>([]);
  const [tokenRequests, setTokenRequests] = useState<TokenRequest[]>([]);
  const issueToken = useServerFn(issueFacultyEventToken);
  const requestTokens = useServerFn(requestAdditionalFacultyEventTokens);

  const load = useCallback(async () => {
    const { data, error: queryError } = await supabase.from("faculty_events")
      .select("id,name,event_code,description,event_date,venue,approved_capacity,status,event_logo_path")
      .eq("canteen_id", canteenId).eq("status", "published").order("created_at", { ascending: false });
    if (queryError) { setError("Could not load events. Reconnecting…"); setLoading(false); return; }
    const next: EventView[] = [];
    let capacityFailed = false;
    for (const row of (data ?? []) as EventRow[]) {
      const { data: stats, error: statsError } = await supabase.rpc("hungry_get_event_capacity", { p_event_id: row.id }).maybeSingle();
      if (statsError || !stats) capacityFailed = true;
      next.push({ ...row, issued_tokens: stats?.issued_tokens ?? 0, tokens_remaining: stats?.tokens_remaining ?? 0, capacity_available: !statsError && !!stats });
    }
    const [tokenResult, requestResult] = await Promise.all([
      supabase.from("faculty_event_tokens").select("id,event_id,token_number,status").eq("customer_id", userId).neq("status", "cancelled").order("sequence_number"),
      supabase.from("faculty_event_token_requests").select("id,event_id,requested_count,status,canteen_note,created_at").eq("requester_user_id", userId).order("created_at", { ascending: false }),
    ]);
    setParticipantTokens((tokenResult.data ?? []) as ParticipantToken[]);
    setTokenRequests((requestResult.data ?? []) as TokenRequest[]);
    const logoUrls = await getFacultyEventLogoUrls(next.map((event) => event.event_logo_path));
    const withLogos = next.map((event) => ({ ...event, event_logo_url: event.event_logo_path ? logoUrls[event.event_logo_path] : undefined }));
    setEvents(withLogos);
    setPicked((current) => current ? withLogos.find((event) => event.id === current.id) ?? null : null);
    setOpened((current) => current ? withLogos.find((event) => event.id === current.id) ?? null : null);
    setError(capacityFailed ? "Event availability is temporarily unavailable. Refreshing automatically…" : "");
    setLoading(false);
  }, [canteenId, userId]);

  useEffect(() => {
    void load();
    const channel = supabase.channel(`student-events-${canteenId}-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "faculty_events", filter: `canteen_id=eq.${canteenId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "faculty_event_tokens", filter: `canteen_id=eq.${canteenId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "faculty_event_token_requests" }, load)
      .subscribe();
    const retry = window.setInterval(() => void load(), 15000);
    return () => { window.clearInterval(retry); void supabase.removeChannel(channel); };
  }, [canteenId, load, userId]);

  function openEvent(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault(); setError(""); setToken(null); setRequestedCount(1);
    const found = events.find((row) => row.event_code === code && row.id === picked?.id);
    if (!found) { setError("That Event Code is invalid or this event is not published for the canteen."); return; }
    if (!found.capacity_available) { setError("Event availability is temporarily unavailable. Please try again shortly."); return; }
    if (found.tokens_remaining < 1 && !participantTokens.some((item) => item.event_id === found.id)) { setError("EVENT FULL"); return; }
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

  async function requestMoreTokens() {
    if (!opened) return;
    setError(""); setRequesting(true);
    try {
      await requestTokens({ data: { eventId: opened.id, requestedCount } });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not request additional tokens.");
    } finally { setRequesting(false); }
  }

  return <section className="space-y-5 pt-2" aria-label="Faculty Events">
    <div><h2 className="display text-2xl">Faculty Events</h2><p className="mt-1 text-sm text-muted-foreground">Enter the seven-digit Event Code to view event details and generate your participation token.</p></div>
    {loading && <p role="status" className="text-sm text-muted-foreground">Loading events…</p>}
    {!loading && events.length === 0 && <p className="rounded-3xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">No published events for this canteen yet.</p>}
    {events.length > 0 && <div className="grid min-w-0 gap-3 sm:grid-cols-2">{events.map((event) => <button key={event.id} type="button" onClick={() => { setPicked(event); setOpened(null); setToken(null); setCode(""); setError(""); }} className={`min-w-0 rounded-2xl border p-3 text-left sm:p-4 ${picked?.id === event.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}>{event.event_logo_url && <EventLogoImage src={event.event_logo_url} alt={`${event.name} event logo`} className="mb-3 min-h-24 max-h-36 sm:min-h-28" />}<span data-no-translate className="block font-semibold">{event.name}</span><span className="mt-1 block text-xs text-muted-foreground">{event.capacity_available ? `${event.tokens_remaining} tokens remaining` : "Availability refreshing"}</span></button>)}</div>}
    {!!events.length && <form onSubmit={openEvent} className="flex gap-2">
      <input required inputMode="numeric" pattern="[0-9]{7}" maxLength={7} value={code} onChange={(event) => setCode(event.currentTarget.value.replace(/\D/g, "").slice(0, 7))} placeholder="7-digit Event Code" aria-label="7-digit Event Code" className="min-w-0 flex-1 rounded-full border border-input bg-ink-soft px-4 py-3 text-center font-mono tracking-[0.3em]" />
      <button disabled={!picked} className="rounded-full bg-primary px-5 py-3 text-xs font-semibold text-primary-foreground disabled:opacity-50">Open Event</button>
    </form>}
    {error && <p role="alert" className="rounded-2xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary-bright">{error}</p>}
    {opened && <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/65 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setOpened(null); setToken(null); } }}>
      <section role="dialog" aria-modal="true" aria-labelledby="event-dialog-title" className="relative my-auto max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-primary/30 bg-card p-5 sm:p-6">
        <button type="button" aria-label="Close event" onClick={() => { setOpened(null); setToken(null); }} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground"><X className="h-4 w-4" /></button>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Ticket className="h-6 w-6" /></div>
        {opened.event_logo_url && <EventLogoImage src={opened.event_logo_url} alt={`${opened.name} event logo`} className="mt-4 max-h-52" />}
        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Event details</p>
        <h3 data-no-translate id="event-dialog-title" className="display mt-1 pr-9 text-2xl">{opened.name}</h3>
        {opened.description && <p data-no-translate className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{opened.description}</p>}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          {opened.event_date && <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-primary" />{new Date(`${opened.event_date}T00:00:00`).toLocaleDateString()}</span>}
          {opened.venue && <span data-no-translate className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" />{opened.venue}</span>}
          <span>{opened.tokens_remaining} places remaining</span>
        </div>
        <div className="mt-5 rounded-2xl bg-ink-soft p-3 text-center text-xs text-muted-foreground"><span data-no-translate>{canteenName}</span> · Event Code verified</div>
        {(() => {
          const tokens = participantTokens.filter((item) => item.event_id === opened.id);
          if (token && !tokens.some((item) => item.token_number === token.token_number)) tokens.unshift({ id: token.token_number, event_id: opened.id, token_number: token.token_number, status: "issued" });
          return tokens.length > 0 ? <div className="mt-5 space-y-3">
            <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-primary">Your event tokens</p>
            <div className="grid gap-3 sm:grid-cols-2">{tokens.map((item) => <div key={item.id} className="rounded-2xl border border-border p-3 text-center"><p className="display text-4xl tracking-[0.2em]">{item.token_number}</p><p className="mt-1 text-xs text-muted-foreground">Show this token at {canteenName} when you attend.</p><div className="mx-auto mt-3 grid w-fit place-items-center rounded-2xl bg-white p-2"><QRCodeCanvas value={`${opened.id}:${item.token_number}`} size={128} /></div></div>)}</div>
          </div> : <button type="button" disabled={issuing || !opened.capacity_available || opened.tokens_remaining < 1} onClick={() => void generateToken()} className="mt-5 w-full rounded-full bg-primary py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-50">{issuing ? "Generating…" : opened.tokens_remaining < 1 ? "EVENT FULL" : "Generate Token"}</button>;
        })()}
        <div className="mt-5 rounded-2xl border border-border p-4">
          <h4 className="text-sm font-bold">Additional tokens</h4>
          <p className="mt-1 text-xs text-muted-foreground">Request extra event entry tokens. No food selection or order is involved. {opened.tokens_remaining} places remain available.</p>
          <div className="mt-3 flex items-center gap-2 sm:gap-3">
            <button type="button" aria-label="Remove one additional token" disabled={requestedCount <= 1 || requesting} onClick={() => setRequestedCount((current) => Math.max(1, current - 1))} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border disabled:opacity-40"><Minus className="h-4 w-4" /></button>
            <output aria-label="Additional token quantity" className="min-w-8 text-center text-lg font-bold tabular-nums">{requestedCount}</output>
            <button type="button" aria-label="Add one additional token" disabled={requestedCount >= Math.min(9999, opened.tokens_remaining) || requesting} onClick={() => setRequestedCount((current) => Math.min(9999, opened.tokens_remaining, current + 1))} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"><Plus className="h-4 w-4" /></button>
            <button type="button" disabled={requesting || !opened.capacity_available || opened.tokens_remaining < requestedCount || tokenRequests.some((request) => request.event_id === opened.id && request.status === "pending")} onClick={() => void requestMoreTokens()} className="min-h-10 min-w-0 flex-1 rounded-full border border-primary/50 px-3 py-2 text-[11px] font-bold leading-tight text-primary disabled:opacity-50 sm:text-xs">{requesting ? "Sending request…" : "Request Additional Tokens"}</button>
          </div>
          {tokenRequests.filter((request) => request.event_id === opened.id).map((request) => <p key={request.id} className="mt-3 rounded-xl bg-ink-soft p-3 text-xs text-muted-foreground">{request.requested_count} additional token{request.requested_count === 1 ? "" : "s"} · <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${tokenRequestStatusClass(request.status)}`}>{request.status.toUpperCase()}</span>{request.canteen_note ? <span data-no-translate>{` — ${request.canteen_note}`}</span> : ""}</p>)}
        </div>
      </section>
    </div>}
  </section>;
}

function tokenRequestStatusClass(status: string) {
  if (status === "pending") return "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300";
  if (status === "approved") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (status === "rejected" || status === "cancelled") return "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300";
  return "border-border bg-ink-soft text-muted-foreground";
}
