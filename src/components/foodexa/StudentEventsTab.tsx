import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { MenuItem } from "@/lib/access";
import { foodImage } from "@/lib/foodexa-images";

type EventRow = { id: string; name: string; event_code: string; description: string; approved_capacity: number; status: string; food_confirmation: { quantities?: Record<string, number>; prices?: Record<string, number> } };
type EventView = EventRow & { issued_tokens: number; tokens_remaining: number; capacity_available: boolean };
type CartItem = { item: MenuItem; qty: number };

export function StudentEventsTab({ canteenId, canteenName, menu, cart, userId, onAdd, onGetToken }: {
  canteenId: string; canteenName: string; menu: MenuItem[]; cart: CartItem[]; userId: string;
  onAdd: (item: MenuItem, delta: number) => void; onGetToken: (event: EventRow) => void;
}) {
  const [events, setEvents] = useState<EventView[]>([]);
  const [picked, setPicked] = useState<EventView | null>(null);
  const [selected, setSelected] = useState<EventView | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error: queryError } = await supabase.from("faculty_events").select("id,name,event_code,description,approved_capacity,status,food_confirmation").eq("canteen_id", canteenId).eq("status", "published").order("created_at", { ascending: false });
    if (queryError) { setError("Could not load events. Reconnecting…"); setLoading(false); return; }
    const next: EventView[] = [];
    let capacityFailed = false;
    for (const row of (data ?? []) as EventRow[]) {
      const { data: stats, error: statsError } = await supabase.rpc("hungry_get_event_capacity", { p_event_id: row.id }).maybeSingle();
      if (statsError || !stats) capacityFailed = true;
      next.push({ ...row, issued_tokens: stats?.issued_tokens ?? 0, tokens_remaining: stats?.tokens_remaining ?? 0, capacity_available: !statsError && !!stats });
    }
    setEvents(next);
    setSelected((current) => current ? (next.find((event) => event.id === current.id) ?? null) : null);
    setError(capacityFailed ? "Event availability is temporarily unavailable. Refreshing automatically…" : ""); setLoading(false);
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

  function checkCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const found = events.find((row) => row.event_code === code && row.id === picked?.id);
    if (!found) { setError("That Event Code is invalid or the event is not published for this canteen."); return; }
    if (!found.capacity_available) { setError("Event availability is temporarily unavailable. Please try again shortly."); return; }
    if (found.tokens_remaining < 1) { setSelected(found); setError("EVENT FULL"); return; }
    setSelected(found);
  }

  const cartCount = cart.reduce((sum, entry) => sum + entry.qty, 0);
  const cartTotal = cart.reduce((sum, entry) => sum + entry.item.price * entry.qty, 0);
  return <section className="space-y-5 pt-2" aria-label="Faculty Events">
    <div><h2 className="display text-2xl">Faculty Events</h2><p className="mt-1 text-sm text-muted-foreground">Events for {canteenName}. Enter the 7-digit Event Code to open its menu.</p></div>
    {loading && <p role="status" className="text-sm text-muted-foreground">Loading events…</p>}
    {!loading && events.length === 0 && <p className="rounded-3xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">No published events for this canteen yet.</p>}
    {events.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{events.map((event) => <button key={event.id} type="button" onClick={() => { setPicked(event); setSelected(null); setCode(""); setError(""); }} className={`rounded-2xl border p-4 text-left ${picked?.id === event.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}><span className="block font-semibold">{event.name}</span><span className="mt-1 block text-xs text-muted-foreground">{event.capacity_available ? `${event.tokens_remaining} tokens remaining` : "Availability refreshing"}</span></button>)}</div>}
    {!!events.length && <form onSubmit={checkCode} className="flex gap-2">
      <input required inputMode="numeric" pattern="[0-9]{7}" maxLength={7} value={code} onChange={(event) => setCode(event.currentTarget.value.replace(/\D/g, "").slice(0, 7))} placeholder="7-digit Event Code" aria-label="7-digit Event Code" className="min-w-0 flex-1 rounded-full border border-input bg-ink-soft px-4 py-3 text-center font-mono tracking-[0.3em]" />
      <button disabled={!picked} className="rounded-full bg-primary px-5 py-3 text-xs font-semibold text-primary-foreground disabled:opacity-50">Open Event</button>
    </form>}
    {error && <p role="alert" className="rounded-2xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary-bright">{error}</p>}
    {selected && selected.tokens_remaining > 0 && <div className="space-y-4 rounded-3xl border border-border bg-card p-5">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-bright">{canteenName}</p><h3 className="display mt-1 text-xl">{selected.name}</h3><p className="mt-1 text-xs text-muted-foreground">Event Code confirmed · {selected.tokens_remaining} tokens remaining</p>{selected.description && <p className="mt-3 text-sm text-muted-foreground">{selected.description}</p>}</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{menu.filter((item) => item.available && item.stock !== 0 && Object.hasOwn(selected.food_confirmation.quantities ?? {}, item.name)).map((item) => <article key={item.id} className="overflow-hidden rounded-2xl border border-border bg-background">
        <img src={foodImage(item.image)} alt="" className="aspect-[4/3] w-full object-cover" />
        <div className="p-3"><p data-no-translate className="line-clamp-2 text-sm font-semibold">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">₹{item.price}</p><button type="button" onClick={() => onAdd(item, 1)} className="mt-2 w-full rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">Add food</button></div>
      </article>)}</div>
      <button type="button" disabled={cartCount === 0} onClick={() => onGetToken(selected)} className="w-full rounded-full bg-primary py-4 text-sm font-bold text-primary-foreground disabled:opacity-50">{cartCount ? `GET TOKEN · ${cartCount} items · ₹${cartTotal}` : "Add food to continue"}</button>
    </div>}
  </section>;
}
