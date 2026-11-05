import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, List, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { collectFacultyEventToken, createFacultyEvent, publishFacultyEvent, requestFacultyEventCapacity, resolveFacultyEventCapacity, reviewFacultyEventQuotation, reviewFacultyEventRequest, submitFacultyEventQuotation, updateFacultyEvent, updateFacultyEventServedQuantities } from "@/lib/hungry.functions";

type EventRow = {
  id: string; faculty_user_id: string; canteen_id: string; name: string; event_code: string; token_prefix: string;
  description: string; event_date: string | null; venue: string; food_request_message: string; faculty_note: string;
  food_requirements: Record<string, number>; initial_capacity: number; approved_capacity: number; estimated_budget: number;
  served_food_quantities: Record<string, number>; status: string; canteen_note: string;
  food_confirmation: { quantities?: Record<string, number>; prices?: Record<string, number> }; created_at: string;
};
type RequestRow = {
  id: string; event_id: string; additional_tokens: number; proposed_capacity: number; revised_food_quantities: Record<string, number>;
  status: string; canteen_note: string; created_at: string;
};
type TokenRow = { id: string; event_id: string; status: string; token_number: string; customer_id: string; created_at: string };
type EventMenuItem = { id: string; name: string; price: number; image: string | null; category: string; stock: number | null };

export function EventCapacityPanel({ mode, canteenId, canteenName }: { mode: "faculty" | "canteen"; canteenId: string; canteenName: string }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [name, setName] = useState("");
  const [eventCode, setEventCode] = useState("");
  const [capacity, setCapacity] = useState("100");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [venue, setVenue] = useState("");
  const [foodRequestMessage, setFoodRequestMessage] = useState("");
  const [additional, setAdditional] = useState<Record<string, string>>({});
  const [foodSelection, setFoodSelection] = useState<Record<string, number>>({});
  const [editFoodSelection, setEditFoodSelection] = useState<Record<string, Record<string, number>>>({});
  const [additionalFoodSelection, setAdditionalFoodSelection] = useState<Record<string, Record<string, number>>>({});
  const [confirmedFoodSelection, setConfirmedFoodSelection] = useState<Record<string, Record<string, number>>>({});
  const [confirmedPrices, setConfirmedPrices] = useState<Record<string, Record<string, string>>>({});
  const [servedFoodSelection, setServedFoodSelection] = useState<Record<string, Record<string, number>>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [menuPrices, setMenuPrices] = useState<Record<string, number>>({});
  const [menuItems, setMenuItems] = useState<EventMenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuDialogOpen, setMenuDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const create = useServerFn(createFacultyEvent);
  const requestCapacity = useServerFn(requestFacultyEventCapacity);
  const resolve = useServerFn(resolveFacultyEventCapacity);
  const review = useServerFn(reviewFacultyEventRequest);
  const publish = useServerFn(publishFacultyEvent);
  const updateDetails = useServerFn(updateFacultyEvent);
  const quoteEvent = useServerFn(submitFacultyEventQuotation);
  const reviewQuotation = useServerFn(reviewFacultyEventQuotation);
  const collectToken = useServerFn(collectFacultyEventToken);
  const saveServed = useServerFn(updateFacultyEventServedQuantities);

  const load = useCallback(async () => {
    const [eventResult, requestResult, tokenResult, menuResult] = await Promise.all([
      supabase.from("faculty_events").select("*").eq("canteen_id", canteenId).order("created_at", { ascending: false }),
      supabase.from("faculty_event_capacity_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("faculty_event_tokens").select("id,event_id,status,token_number,customer_id,created_at").eq("canteen_id", canteenId),
      supabase.from("menu_items").select("id,name,price,image,category,stock").eq("canteen_id", canteenId).eq("available", true).order("category").order("name"),
    ]);
    if (eventResult.data) setEvents(eventResult.data as EventRow[]);
    if (requestResult.data) setRequests(requestResult.data as RequestRow[]);
    if (tokenResult.data) setTokens(tokenResult.data as TokenRow[]);
    if (menuResult.data) {
      const items = menuResult.data as EventMenuItem[];
      setMenuItems(items);
      setMenuPrices(Object.fromEntries(items.map((item) => [item.name, item.price])));
    }
    setMenuLoading(false);
    if (eventResult.error || requestResult.error || tokenResult.error || menuResult.error) setError("Event information could not be refreshed. Retrying automatically.");
    else setError("");
  }, [canteenId]);

  useEffect(() => {
    void load();
    const channel = supabase.channel(`event-capacity-${mode}-${canteenId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "faculty_events", filter: `canteen_id=eq.${canteenId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "faculty_event_capacity_requests" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "faculty_event_tokens", filter: `canteen_id=eq.${canteenId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items", filter: `canteen_id=eq.${canteenId}` }, load)
      .subscribe();
    const retry = window.setInterval(() => void load(), 15000);
    return () => { window.clearInterval(retry); void supabase.removeChannel(channel); };
  }, [canteenId, load, mode]);

  const requestsByEvent = useMemo(() => {
    const grouped = new Map<string, RequestRow[]>();
    for (const request of requests) grouped.set(request.event_id, [...(grouped.get(request.event_id) ?? []), request]);
    return grouped;
  }, [requests]);

  async function createEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    const food = Object.fromEntries(Object.entries(foodSelection).filter(([, quantity]) => quantity > 0));
    if (!Object.keys(food).length) return setError("Select at least one available food item and set its quantity.");
    setBusy(true);
    try {
      const result = await create({ data: { name, eventCode, description, eventDate, venue, foodRequestMessage, initialCapacity: Number(capacity), foodRequirements: food } });
      setMessage(`Event request sent to ${canteenName}. Event Code: ${result.event_code}. The canteen will review the request and send a quotation.`); setName(""); setEventCode(""); setDescription(""); setEventDate(""); setVenue(""); setFoodRequestMessage(""); setFoodSelection({});
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create the event."); }
    finally { setBusy(false); }
  }

  async function sendCapacityRequest(event: React.FormEvent<HTMLFormElement>, item: EventRow) {
    event.preventDefault(); setError(""); setMessage("");
    const food = Object.fromEntries(Object.entries(additionalFoodSelection[item.id] ?? item.food_requirements).filter(([, quantity]) => quantity > 0));
    if (!Object.keys(food).length) return setError("Select at least one food item and set its revised quantity.");
    setBusy(true);
    try {
      const result = await requestCapacity({ data: { eventId: item.id, additionalTokens: Number(additional[item.id]), revisedFoodQuantities: food } });
      setMessage(`Additional capacity request sent. Proposed capacity: ${result.proposedCapacity}.`);
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not send the capacity request."); }
    finally { setBusy(false); }
  }

  async function respond(request: RequestRow, approve: boolean) {
    setError(""); setMessage(""); setBusy(true);
    try {
      let confirmedFoodQuantities: Record<string, number> = {};
      let confirmedFoodPrices: Record<string, number> = {};
      if (approve) {
        confirmedFoodQuantities = Object.fromEntries(Object.entries(confirmedFoodSelection[request.id] ?? request.revised_food_quantities).filter(([, quantity]) => quantity > 0));
        confirmedFoodPrices = Object.fromEntries(Object.keys(confirmedFoodQuantities).map((food) => [food, Number(confirmedPrices[request.id]?.[food] ?? menuPrices[food] ?? 0)]));
        if (Object.keys(confirmedFoodQuantities).length !== Object.keys(request.revised_food_quantities).length || Object.values(confirmedFoodQuantities).some((quantity) => !Number.isInteger(quantity) || quantity < 1) || Object.values(confirmedFoodPrices).some((price) => !Number.isFinite(price) || price < 0)) {
          throw new Error("Set a valid quantity and price for every requested food item.");
        }
      }
      const result = await resolve({ data: { requestId: request.id, approve, note: notes[request.id] ?? "", confirmedFoodQuantities, confirmedFoodPrices } });
      setMessage(result.status === "approved" ? "Additional capacity approved and activated." : "Capacity request rejected.");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update this request."); }
    finally { setBusy(false); }
  }

  async function reviewEvent(event: EventRow, accept: boolean) {
    setError(""); setMessage(""); setBusy(true);
    try {
      const result = await review({ data: { eventId: event.id, accept, note: notes[event.id] ?? "" } });
      setMessage(result.status === "accepted" ? "Event accepted. Confirm quantities and prices, then publish it." : "Event request rejected.");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not review this event."); }
    finally { setBusy(false); }
  }

  async function sendQuotation(event: EventRow) {
    setError(""); setMessage(""); setBusy(true);
    try {
      const quantities = Object.fromEntries(Object.entries(confirmedFoodSelection[event.id] ?? event.food_requirements).filter(([, quantity]) => Number.isInteger(quantity) && quantity > 0));
      const prices = Object.fromEntries(Object.keys(quantities).map((food) => [food, Number(confirmedPrices[event.id]?.[food] ?? menuPrices[food] ?? 0)]));
      if (!Object.keys(quantities).length || Object.values(prices).some((price) => !Number.isInteger(price) || price < 0)) throw new Error("Select at least one item and enter a valid price for each item.");
      const result = await quoteEvent({ data: { eventId: event.id, quantities, prices, note: notes[event.id] ?? "" } });
      setMessage(`Quotation sent to Faculty. Estimated budget: ₹${result.estimatedBudget}.`);
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not send this quotation."); }
    finally { setBusy(false); }
  }

  async function respondToQuotation(event: EventRow, approve: boolean) {
    setError(""); setMessage(""); setBusy(true);
    try {
      const result = await reviewQuotation({ data: { eventId: event.id, approve, note: notes[event.id] ?? "" } });
      setMessage(result.status === "approved" ? "Quotation approved. The canteen can now confirm and publish the event." : "Change request sent to the canteen.");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update the quotation."); }
    finally { setBusy(false); }
  }

  async function publishEvent(event: EventRow) {
    setError(""); setMessage(""); setBusy(true);
    try {
      const confirmedFoodQuantities = event.food_confirmation.quantities ?? {};
      const confirmedFoodPrices = event.food_confirmation.prices ?? {};
      const result = await publish({ data: { eventId: event.id, confirmedFoodQuantities, confirmedFoodPrices, note: notes[event.id] ?? "" } });
      setMessage(result.status === "published" ? "Event published. Students can now generate event tokens." : "Event publication updated.");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not publish this event."); }
    finally { setBusy(false); }
  }

  async function markTokenCollected(token: TokenRow) {
    setError(""); setMessage(""); setBusy(true);
    try { await collectToken({ data: { tokenId: token.id } }); setMessage(`Token ${token.token_number} verified and marked served.`); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not verify this token."); }
    finally { setBusy(false); }
  }

  async function saveServedQuantities(event: EventRow) {
    setError(""); setMessage(""); setBusy(true);
    try {
      const quantities = servedFoodSelection[event.id] ?? event.served_food_quantities ?? {};
      await saveServed({ data: { eventId: event.id, quantities } });
      setMessage("Served food quantities saved."); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save served quantities."); }
    finally { setBusy(false); }
  }

  async function saveDetails(event: EventRow, formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault(); setError(""); setMessage("");
    const form = new FormData(formEvent.currentTarget);
    const food = Object.fromEntries(Object.entries(editFoodSelection[event.id] ?? event.food_requirements).filter(([, quantity]) => quantity > 0));
    if (!Object.keys(food).length) return setError("Select at least one food item and set its quantity.");
    setBusy(true);
    try {
      await updateDetails({ data: { eventId: event.id, name: String(form.get("name")), description: String(form.get("description")), eventDate: String(form.get("eventDate")), venue: String(form.get("venue")), foodRequestMessage: String(form.get("foodRequestMessage")), foodRequirements: food } });
      setEditingEvent(null); setMessage("Event details updated."); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update event details."); }
    finally { setBusy(false); }
  }

  return (
    <section className="space-y-5" aria-label="Event token management">
      {mode === "faculty" ? (
        <div>
          <h2 className="display text-2xl">Manage My Events</h2>
          <p className="mt-1 text-sm text-muted-foreground">Create an event request, review the canteen quotation and track participation through serving.</p>
        </div>
      ) : (
        <div className="rounded-3xl border border-primary/25 bg-primary/[0.04] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="display text-2xl">Faculty Event Requests</h2>
              <p className="mt-1 text-sm text-muted-foreground">Review event details and instructions, confirm food and pricing, then publish after faculty approval.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 font-semibold text-amber-700">
                {events.filter((event) => event.status === "requested").length} pending
              </span>
              <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-semibold text-primary">
                {events.filter((event) => event.status === "accepted" || event.status === "changes_requested").length} quotations due
              </span>
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-700">
                {events.filter((event) => event.status === "approved").length} approved to publish
              </span>
            </div>
          </div>
        </div>
      )}
      {mode === "faculty" && <form onSubmit={createEvent} className="glass-red space-y-3 rounded-3xl p-5">
        <h2 className="display text-xl">Create a Faculty Event</h2>
        <p className="text-xs text-muted-foreground">Follow these steps to submit your event for canteen review.</p>
        <section className="space-y-2"><p className="text-xs font-bold uppercase tracking-wider text-primary">1 · Event information</p>
          <input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.currentTarget.value)} placeholder="Event name" aria-label="Event name" className="w-full rounded-2xl border border-input bg-ink-soft px-4 py-3 text-sm" />
          <label htmlFor="faculty-event-details" className="block space-y-2 rounded-2xl border border-primary/45 bg-primary/[0.06] p-3 shadow-[0_0_24px_hsl(var(--primary)/0.06)] focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <span className="block text-xs font-bold tracking-[0.14em] text-primary">FACULTY EVENT DETAILS</span>
            <textarea id="faculty-event-details" maxLength={1000} value={description} onChange={(event) => setDescription(event.currentTarget.value)} placeholder="Describe the event" aria-label="Faculty event details" className="min-h-20 w-full resize-y rounded-xl border border-primary/25 bg-background/75 px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" rows={2} />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-xs text-muted-foreground">Event date<input required type="date" value={eventDate} onChange={(event) => setEventDate(event.currentTarget.value)} aria-label="Event date" className="mt-1 w-full rounded-xl border border-input bg-ink-soft px-3 py-3 text-sm text-foreground" /></label>
            <label className="block text-xs text-muted-foreground">Venue<input required minLength={2} maxLength={200} value={venue} onChange={(event) => setVenue(event.currentTarget.value)} placeholder="Building, hall or location" aria-label="Event venue" className="mt-1 w-full rounded-xl border border-input bg-ink-soft px-3 py-3 text-sm text-foreground" /></label>
          </div>
        </section>
        <label className="block text-xs text-muted-foreground"><span className="font-bold uppercase tracking-wider text-primary">2 · Expected participants</span>
          <input required type="number" min={1} max={9999} value={capacity} onChange={(event) => setCapacity(event.currentTarget.value)} aria-label="Expected participants" className="mt-1 w-full rounded-2xl border border-input bg-ink-soft px-4 py-3 text-sm text-foreground" />
        </label>
        <label className="block text-xs text-muted-foreground"><span className="font-bold uppercase tracking-wider text-primary">3 · Seven-digit Event Access Code</span>
          <input required inputMode="numeric" pattern="[0-9]{7}" maxLength={7} value={eventCode} onChange={(event) => setEventCode(event.currentTarget.value.replace(/\D/g, "").slice(0, 7))} aria-label="7-digit Event Code" placeholder="1234567" className="mt-1 w-full rounded-2xl border border-input bg-ink-soft px-4 py-3 font-mono tracking-[0.3em] text-foreground" />
        </label>
        <p className="text-xs text-muted-foreground">This event will be sent privately to {canteenName}. It becomes visible to users after approval and publication.</p>
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">4 · Food menu selection</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="text-sm font-semibold text-foreground">Food preparation request</h3><p className="mt-1 text-xs text-muted-foreground">Selected canteen: <strong className="font-semibold text-foreground">{canteenName}</strong></p></div>
            <button type="button" onClick={() => setMenuDialogOpen(true)} aria-label={`Open ${canteenName} menu`} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-4 py-2 text-sm font-bold tracking-wide text-foreground transition hover:border-primary hover:bg-primary/10"><List className="h-4 w-4 text-primary" /> MENU</button>
          </div>
          <FoodQuantitySummary quantities={foodSelection} title="Selected items" />
        </div>
        <label className="block space-y-1 text-xs text-muted-foreground"><span className="font-bold uppercase tracking-wider text-primary">5 · Message to Canteen (Optional)</span><textarea maxLength={500} value={foodRequestMessage} onChange={(event) => setFoodRequestMessage(event.currentTarget.value)} placeholder="Special instructions or notes for the canteen" aria-label="Message to Canteen (Optional)" rows={2} className="w-full rounded-xl border border-input bg-ink-soft px-3 py-2 text-sm text-foreground" /></label>
        <button disabled={busy} className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">{busy ? "Sending…" : "6. Submit Food Request"}</button>
      </form>}

      {(error || message) && <p role={error ? "alert" : "status"} className={`rounded-2xl border p-3 text-sm ${error ? "border-red-500/40 bg-red-500/10 text-red-500" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"}`}>{error || message}</p>}
      {!events.length && <p className="rounded-3xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">No events for {canteenName} yet.</p>}

      {events.map((event) => {
        const eventTokens = tokens.filter((token) => token.event_id === event.id);
        const issued = eventTokens.filter((token) => token.status !== "cancelled").length;
        const collected = eventTokens.filter((token) => token.status === "collected").length;
        const cancelled = eventTokens.filter((token) => token.status === "cancelled").length;
        const quotationQuantities = event.food_confirmation.quantities ?? {};
        const quotationPrices = event.food_confirmation.prices ?? {};
        const finalExpenditure = Object.entries(event.served_food_quantities ?? {}).reduce((sum, [food, quantity]) => sum + quantity * (quotationPrices[food] ?? 0), 0);
        const eventRequests = requestsByEvent.get(event.id) ?? [];
        const pending = eventRequests.some((request) => request.status === "pending");
        return <article key={event.id} className="rounded-3xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${eventStatusClass(event.status)}`}>{eventStatusLabel(event.status)}</span><p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{canteenName}</p><h3 className="display mt-1 text-xl">{event.name}</h3><p className="mt-1 text-xs text-muted-foreground">Event Code: <span className="font-mono font-bold tracking-widest text-foreground">{event.event_code}</span></p></div>
            <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold">{eventTokens.length}/{event.approved_capacity} tokens</span>
          </div>
          {event.description && <p className="mt-3 text-sm text-muted-foreground">{event.description}</p>}
          <div className="mt-3 grid gap-2 rounded-2xl bg-ink-soft p-3 text-xs sm:grid-cols-3"><p><CalendarDays className="mr-1 inline h-3.5 w-3.5 text-primary" />{event.event_date ? new Date(`${event.event_date}T00:00:00`).toLocaleDateString() : "Date not set"}</p><p><strong>Venue:</strong> {event.venue || "Not set"}</p><p><strong>Expected participants:</strong> {event.initial_capacity}</p></div>
          {mode === "canteen" && event.food_request_message && <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/10 p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-primary">Faculty instructions</p><p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{event.food_request_message}</p></div>}
          {mode === "canteen" && event.faculty_note && <div className="mt-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3"><p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Faculty response</p><p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{event.faculty_note}</p></div>}
          {mode === "faculty" && event.faculty_note && <p className="mt-3 rounded-xl bg-ink-soft p-3 text-xs text-muted-foreground">Your note to canteen: {event.faculty_note}</p>}
          {mode === "faculty" && <button type="button" onClick={() => { if (editingEvent !== event.id) setEditFoodSelection((current) => ({ ...current, [event.id]: event.food_requirements })); setEditingEvent((current) => current === event.id ? null : event.id); }} className="mt-3 rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted-foreground">{editingEvent === event.id ? "Close event editor" : "Change event details"}</button>}
          {mode === "faculty" && editingEvent === event.id && <form onSubmit={(formEvent) => saveDetails(event, formEvent)} className="mt-3 space-y-2 rounded-2xl border border-border p-4">
            <input name="name" defaultValue={event.name} required minLength={2} maxLength={120} aria-label="Edit event name" className="w-full rounded-xl border border-input bg-ink-soft px-3 py-2 text-sm" />
            <textarea name="description" defaultValue={event.description} maxLength={1000} aria-label="Edit event details" className="w-full rounded-xl border border-input bg-ink-soft px-3 py-2 text-sm" rows={2} />
            <input name="eventDate" type="date" defaultValue={event.event_date ?? ""} required aria-label="Edit event date" className="w-full rounded-xl border border-input bg-ink-soft px-3 py-2 text-sm" />
            <input name="venue" defaultValue={event.venue} required minLength={2} maxLength={200} aria-label="Edit event venue" className="w-full rounded-xl border border-input bg-ink-soft px-3 py-2 text-sm" />
            <textarea name="foodRequestMessage" defaultValue={event.food_request_message} maxLength={500} aria-label="Edit message to canteen" placeholder="Message to Canteen (Optional)" className="w-full rounded-xl border border-input bg-ink-soft px-3 py-2 text-sm" rows={2} />
            <MenuQuantityPicker items={menuItems} loading={menuLoading} quantities={editFoodSelection[event.id] ?? event.food_requirements} onChange={(value) => setEditFoodSelection((current) => ({ ...current, [event.id]: value }))} label="Requested food items" />
            <button disabled={busy} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">Save event details</button>
          </form>}
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <Metric label="Expected participants" value={event.initial_capacity} />
            <Metric label="Approved capacity" value={event.approved_capacity} />
            <Metric label="Tokens issued" value={issued} />
            <Metric label="Tokens remaining" value={Math.max(0, event.approved_capacity - eventTokens.length)} />
            <Metric label="Tokens collected" value={collected} />
            <Metric label="Cancelled tokens" value={cancelled} />
            <Metric label="Canteen allocation" value={`${eventTokens.length} / ${event.approved_capacity}`} />
            <Metric label="Estimated budget" value={`₹${event.estimated_budget || 0}`} />
            <Metric label="Final expenditure" value={`₹${finalExpenditure}`} />
          </div>
          <div className="mt-3"><FoodQuantitySummary quantities={event.food_requirements} title="Faculty food request" /></div>
          {Object.keys(quotationQuantities).length > 0 && <div className="mt-2"><FoodQuantitySummary quantities={quotationQuantities} prices={quotationPrices} title="Canteen quotation and confirmed food" /></div>}
          {event.canteen_note && <p className="mt-2 rounded-xl bg-ink-soft p-3 text-xs text-muted-foreground">Canteen response: {event.canteen_note}</p>}

          {mode === "canteen" && event.status === "published" && <section className="mt-4 space-y-3 rounded-2xl border border-border p-4" aria-label={`Serving progress for ${event.name}`}>
            <h4 className="text-sm font-bold">Token verification and serving progress</h4>
            <p className="text-xs text-muted-foreground">{collected} of {issued} issued tokens served · {Math.max(0, event.approved_capacity - eventTokens.length)} tokens remain available.</p>
            <div className="max-h-52 space-y-2 overflow-y-auto">{eventTokens.map((token) => <div key={token.id} className="flex items-center justify-between gap-3 rounded-xl bg-ink-soft p-3"><div><p className="font-mono text-sm font-bold tracking-widest">{token.token_number}</p><p className="text-[10px] text-muted-foreground">{token.status.toUpperCase()}</p></div>{token.status === "issued" && <button type="button" disabled={busy} onClick={() => markTokenCollected(token)} className="rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">Verify &amp; mark served</button>}</div>)}</div>
            <div className="rounded-xl border border-border p-3"><p className="mb-2 text-xs font-semibold">Actual food quantities served</p><MenuServedEditor items={menuItems} planned={quotationQuantities} quantities={servedFoodSelection[event.id] ?? event.served_food_quantities ?? {}} onChange={(value) => setServedFoodSelection((current) => ({ ...current, [event.id]: value }))} /></div>
            <button type="button" disabled={busy} onClick={() => saveServedQuantities(event)} className="rounded-full border border-primary/40 px-4 py-2 text-xs font-semibold text-primary disabled:opacity-50">Save served quantities</button>
          </section>}

          {mode === "canteen" && event.status === "requested" && <div className="mt-4 space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <h4 className="text-sm font-bold">Faculty event request</h4>
            <p className="text-xs text-muted-foreground">Accept or reject this request. Accepted events stay private until you confirm quantities and pricing and publish.</p>
            <textarea maxLength={500} placeholder="Note for faculty (optional)" aria-label={`Review note for ${event.name}`} value={notes[event.id] ?? ""} onChange={(formEvent) => setNotes({ ...notes, [event.id]: formEvent.currentTarget.value })} className="w-full rounded-xl border border-input bg-ink-soft px-3 py-2 text-sm" />
            <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => reviewEvent(event, true)} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">Accept event request</button><button type="button" disabled={busy} onClick={() => reviewEvent(event, false)} className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted-foreground disabled:opacity-50">Reject request</button></div>
          </div>}
          {mode === "canteen" && ["accepted", "changes_requested"].includes(event.status) && <div className="mt-4 space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <h4 className="text-sm font-bold">Prepare event quotation</h4>
            <p className="text-xs text-muted-foreground">Select requested dishes or alternatives, confirm quantities, and enter event prices. Faculty must approve before publishing.</p>
            <MenuConfirmationEditor items={menuItems} quantities={event.food_requirements} confirmedQuantities={confirmedFoodSelection[event.id] ?? event.food_requirements} prices={confirmedPrices[event.id] ?? {}} onQuantityChange={(food, quantity) => setConfirmedFoodSelection((current) => ({ ...current, [event.id]: { ...(current[event.id] ?? event.food_requirements), [food]: quantity } }))} onPriceChange={(food, price) => setConfirmedPrices((current) => ({ ...current, [event.id]: { ...(current[event.id] ?? {}), [food]: price } }))} />
            <QuotationBudget quantities={confirmedFoodSelection[event.id] ?? event.food_requirements} prices={confirmedPrices[event.id] ?? menuPrices} />
            <textarea maxLength={500} placeholder="Note for Faculty (optional)" aria-label={`Quotation note for ${event.name}`} value={notes[event.id] ?? ""} onChange={(formEvent) => setNotes({ ...notes, [event.id]: formEvent.currentTarget.value })} className="w-full rounded-xl border border-input bg-ink-soft px-3 py-2 text-sm" rows={2} />
            <button type="button" disabled={busy} onClick={() => sendQuotation(event)} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">Send quotation to Faculty</button>
          </div>}
          {mode === "faculty" && event.status === "quotation_received" && <div className="mt-4 space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <h4 className="text-sm font-bold">Canteen quotation received</h4>
            <FoodQuantitySummary quantities={quotationQuantities} prices={quotationPrices} title="Proposed food and prices" />
            <p className="text-sm font-semibold">Estimated budget: ₹{event.estimated_budget}</p>
            {event.canteen_note && <p className="whitespace-pre-wrap text-xs text-muted-foreground">Canteen note: {event.canteen_note}</p>}
            <textarea maxLength={500} placeholder="Request a change (optional note)" aria-label={`Quotation response note for ${event.name}`} value={notes[event.id] ?? ""} onChange={(formEvent) => setNotes({ ...notes, [event.id]: formEvent.currentTarget.value })} className="w-full rounded-xl border border-input bg-ink-soft px-3 py-2 text-sm" rows={2} />
            <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => respondToQuotation(event, false)} className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted-foreground disabled:opacity-50">Request changes</button><button type="button" disabled={busy} onClick={() => respondToQuotation(event, true)} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">Approve quotation</button></div>
          </div>}
          {mode === "canteen" && event.status === "approved" && <div className="mt-4 space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <h4 className="text-sm font-bold">Faculty approved the quotation</h4><p className="text-xs text-muted-foreground">Confirm preparation and publish when the event is ready for participants.</p>
            <button type="button" disabled={busy} onClick={() => publishEvent(event)} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">Confirm and Publish</button>
          </div>}

          {mode === "faculty" && event.status === "published" && <form onSubmit={(formEvent) => sendCapacityRequest(formEvent, event)} className="mt-4 space-y-2 border-t border-border pt-4">
            <h4 className="text-sm font-semibold">Request additional tokens</h4>
            {pending && <p className="text-xs text-amber-600">A request is waiting for the canteen to confirm food quantities.</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              <input required type="number" min={1} max={9999} placeholder="Additional tokens" aria-label={`Additional tokens for ${event.name}`} value={additional[event.id] ?? ""} onChange={(formEvent) => setAdditional({ ...additional, [event.id]: formEvent.currentTarget.value })} className="rounded-xl border border-input bg-ink-soft px-3 py-2 text-sm" />
            </div>
            <MenuQuantityPicker items={menuItems} loading={menuLoading} quantities={additionalFoodSelection[event.id] ?? event.food_requirements} onChange={(value) => setAdditionalFoodSelection((current) => ({ ...current, [event.id]: value }))} label="Revised food quantities" />
            <button disabled={busy || pending} className="rounded-full border border-primary/50 px-4 py-2 text-xs font-semibold text-primary-bright disabled:opacity-50">Send canteen confirmation request</button>
            {eventRequests.map((request) => <p key={request.id} className="text-xs text-muted-foreground">+{request.additional_tokens} requested · proposed {request.proposed_capacity} · {request.status}{request.canteen_note ? ` — ${request.canteen_note}` : ""}</p>)}
          </form>}

          {mode === "canteen" && eventRequests.filter((request) => request.status === "pending").map((request) => <div key={request.id} className="mt-4 space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <h4 className="text-sm font-bold">Additional quantity confirmation</h4>
            <p className="text-xs text-muted-foreground">Faculty requested +{request.additional_tokens} tokens. Proposed capacity: {request.proposed_capacity}. Currently approved: {event.approved_capacity}. Tokens issued: {issued}. Remaining: {Math.max(0, event.approved_capacity - eventTokens.length)}.</p>
            <FoodQuantitySummary quantities={request.revised_food_quantities} title="Faculty requested quantities" />
            <MenuConfirmationEditor items={menuItems} quantities={request.revised_food_quantities} confirmedQuantities={confirmedFoodSelection[request.id] ?? request.revised_food_quantities} prices={confirmedPrices[request.id] ?? {}} onQuantityChange={(food, quantity) => setConfirmedFoodSelection((current) => ({ ...current, [request.id]: { ...(current[request.id] ?? request.revised_food_quantities), [food]: quantity } }))} onPriceChange={(food, price) => setConfirmedPrices((current) => ({ ...current, [request.id]: { ...(current[request.id] ?? {}), [food]: price } }))} />
            <input maxLength={500} placeholder="Note for faculty (optional)" aria-label={`Confirmation note for ${event.name}`} value={notes[request.id] ?? ""} onChange={(formEvent) => setNotes({ ...notes, [request.id]: formEvent.currentTarget.value })} className="w-full rounded-xl border border-input bg-ink-soft px-3 py-2 text-sm" />
            <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => respond(request, true)} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">Confirm preparation capacity</button><button type="button" disabled={busy} onClick={() => respond(request, false)} className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted-foreground disabled:opacity-50">Reject request</button></div>
          </div>)}
        </article>;
      })}
      {mode === "faculty" && menuDialogOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setMenuDialogOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="faculty-canteen-menu-title" className="glass-red max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-3xl p-4 shadow-2xl sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3"><div><h3 id="faculty-canteen-menu-title" className="display text-xl">{canteenName} Menu</h3><p className="mt-1 text-xs text-muted-foreground">Choose available items and adjust each requested quantity.</p></div><button type="button" aria-label="Close canteen menu" onClick={() => setMenuDialogOpen(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button></div>
          <MenuQuantityPicker items={menuItems} loading={menuLoading} quantities={foodSelection} onChange={setFoodSelection} label="Available menu items" />
          <div className="sticky bottom-0 mt-4 flex justify-end bg-card/95 pt-3"><button type="button" onClick={() => setMenuDialogOpen(false)} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Done</button></div>
        </section>
      </div>}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl bg-ink-soft p-3"><p className="text-muted-foreground">{label}</p><p className="mt-1 font-bold text-foreground">{value}</p></div>;
}

function MenuQuantityPicker({ items, loading, quantities, onChange, label }: {
  items: EventMenuItem[];
  loading: boolean;
  quantities: Record<string, number>;
  onChange: (quantities: Record<string, number>) => void;
  label: string;
}) {
  const selected = Object.entries(quantities).filter(([, quantity]) => Number.isInteger(quantity) && quantity > 0);
  const update = (name: string, quantity: number) => {
    const next = { ...quantities };
    if (quantity <= 0) delete next[name];
    else next[name] = Math.min(100000, Math.floor(quantity));
    onChange(next);
  };

  if (loading) return <p role="status" className="rounded-2xl border border-border p-4 text-sm text-muted-foreground">Loading {label.toLowerCase()}…</p>;
  if (!items.length) return <p role="status" className="rounded-2xl border border-border p-4 text-sm text-muted-foreground">This canteen has no available menu items right now.</p>;

  return <div className="space-y-3" aria-label={label}>
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => {
        const quantity = quantities[item.name] ?? 0;
        return <article key={item.id} className={`flex min-w-0 items-center gap-3 rounded-2xl border p-3 transition-colors ${quantity ? "border-primary/50 bg-primary/5" : "border-border bg-card"}`}>
          {item.image && <img src={item.image} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl bg-ink-soft object-cover" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{item.category || "Menu item"} · ₹{Number(item.price).toFixed(0)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" disabled={!quantity} aria-label={`Remove one ${item.name}`} onClick={() => update(item.name, quantity - 1)} className="grid h-8 w-8 place-items-center rounded-full border border-border text-lg text-foreground disabled:opacity-40">−</button>
            <span aria-live="polite" aria-label={`${item.name} quantity`} className="w-7 text-center text-sm font-bold tabular-nums text-foreground">{quantity}</span>
            <button type="button" disabled={quantity >= 100000} aria-label={`Add one ${item.name}`} onClick={() => update(item.name, quantity + 1)} className="grid h-8 w-8 place-items-center rounded-full bg-primary text-lg text-primary-foreground disabled:opacity-40">+</button>
          </div>
        </article>;
      })}
    </div>
    <FoodQuantitySummary quantities={Object.fromEntries(selected)} title="Selected items" />
  </div>;
}

function MenuConfirmationEditor({ items, quantities, confirmedQuantities, prices, onQuantityChange, onPriceChange }: {
  items: EventMenuItem[];
  quantities: Record<string, number>;
  confirmedQuantities: Record<string, number>;
  prices: Record<string, string>;
  onQuantityChange: (name: string, quantity: number) => void;
  onPriceChange: (name: string, price: string) => void;
}) {
  return <div className="space-y-2" aria-label="Confirm food quantities and prices">
    {items.map((item) => {
      const quantity = confirmedQuantities[item.name] ?? 0;
      const requested = quantities[item.name];
      return <div key={item.id} className={`grid items-center gap-2 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_120px_130px] ${quantity ? "border-primary/40 bg-primary/5" : "border-border"}`}>
        <div className="flex min-w-0 items-center gap-2">
          {item.image && <img src={item.image} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg object-cover" />}
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{item.name}</p><p className="text-[11px] text-muted-foreground">{requested ? `Faculty requested: ${requested}` : "Alternative menu item"}</p></div>
        </div>
        <div className="flex items-center justify-center gap-2" aria-label={`${item.name} quotation quantity`}>
          <button type="button" aria-label={`Remove one quoted ${item.name}`} disabled={!quantity} onClick={() => onQuantityChange(item.name, Math.max(0, quantity - 1))} className="grid h-8 w-8 place-items-center rounded-full border border-border text-lg disabled:opacity-40">-</button>
          <span className="w-7 text-center text-sm font-bold tabular-nums">{quantity}</span>
          <button type="button" aria-label={`Add one quoted ${item.name}`} disabled={quantity >= 100000} onClick={() => onQuantityChange(item.name, quantity + 1)} className="grid h-8 w-8 place-items-center rounded-full bg-primary text-lg text-primary-foreground">+</button>
        </div>
        {quantity > 0 && <label className="text-[11px] text-muted-foreground">Event price (INR)
          <input type="number" min={0} max={10000000} step={1} required aria-label={`Price for ${item.name}`} value={prices[item.name] ?? String(item.price)} onChange={(event) => onPriceChange(item.name, event.currentTarget.value)} className="mt-1 w-full rounded-lg border border-input bg-ink-soft px-2 py-2 text-sm text-foreground" />
        </label>}
      </div>;
    })}
    {Object.keys(quantities).filter((name) => !items.some((item) => item.name === name)).map((name) => <div key={name} className="flex items-center justify-between rounded-xl border border-red-500/30 p-3 text-xs"><span>{name} is unavailable. Remove it from the quotation.</span><button type="button" onClick={() => onQuantityChange(name, 0)} className="rounded-full border border-border px-3 py-1">Remove</button></div>)}
  </div>;
}

function MenuServedEditor({ items, planned, quantities, onChange }: { items: EventMenuItem[]; planned: Record<string, number>; quantities: Record<string, number>; onChange: (value: Record<string, number>) => void }) {
  return <div className="space-y-2">{Object.entries(planned).map(([name, max]) => {
    const item = items.find((entry) => entry.name === name);
    const served = quantities[name] ?? 0;
    return <label key={name} className="grid grid-cols-[minmax(0,1fr)_100px] items-center gap-2 text-xs"><span className="truncate">{name} ? max {max}</span><input type="number" min={0} max={max} value={served} aria-label={`Served quantity for ${name}`} onChange={(event) => onChange({ ...quantities, [name]: Math.max(0, Math.min(max, Number(event.currentTarget.value))) })} className="w-full rounded-lg border border-input bg-ink-soft px-2 py-2 text-sm" />{!item && <span className="col-span-2 text-amber-600">This item is no longer on the menu.</span>}</label>;
  })}</div>;
}

function QuotationBudget({ quantities, prices }: { quantities: Record<string, number>; prices: Record<string, number | string> }) {
  const total = Object.entries(quantities).reduce((sum, [name, quantity]) => sum + (quantity > 0 ? quantity * Number(prices[name] ?? 0) : 0), 0);
  return <p className="rounded-xl bg-ink-soft p-3 text-sm font-semibold">Estimated quotation total: ?{total}</p>;
}

function eventStatusLabel(status: string) {
  const labels: Record<string, string> = { requested: "PENDING", accepted: "QUOTATION DUE", quotation_received: "QUOTATION RECEIVED", changes_requested: "CHANGES REQUESTED", approved: "APPROVED", published: "ACCEPTED & PUBLISHED", rejected: "REJECTED", closed: "CLOSED" };
  return labels[status] ?? status.toUpperCase().replaceAll("_", " ");
}

function eventStatusClass(status: string) {
  if (status === "requested") return "border-amber-500/40 bg-amber-500/10 text-amber-700";
  if (status === "quotation_received" || status === "changes_requested" || status === "accepted") return "border-primary/40 bg-primary/10 text-primary";
  if (status === "approved" || status === "published") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700";
  if (status === "rejected" || status === "closed") return "border-border bg-ink-soft text-muted-foreground";
  return "border-border bg-ink-soft text-foreground";
}

function FoodQuantitySummary({ quantities, prices, title }: { quantities: Record<string, number>; prices?: Record<string, number>; title: string }) {
  const entries = Object.entries(quantities).filter(([, quantity]) => quantity > 0);
  const total = entries.reduce((sum, [, quantity]) => sum + quantity, 0);
  return <div className="rounded-xl bg-ink-soft p-3">
    <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-foreground">{title}</p><p className="text-[11px] text-muted-foreground">{entries.length} items · {total} total</p></div>
    {entries.length ? <ul className="mt-2 flex flex-wrap gap-2">{entries.map(([name, quantity]) => <li key={name} className="rounded-full border border-border px-3 py-1 text-xs text-foreground">{name} × {quantity}{prices?.[name] !== undefined ? ` · ₹${prices[name]}` : ""}</li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">No items selected yet.</p>}
  </div>;
}
