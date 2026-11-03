import { useEffect, useState } from "react";
import { Clock3, Power, Save } from "lucide-react";
import {
  DEFAULT_WEEKLY_HOURS,
  WEEKDAYS,
  describeTodayHours,
  formatCanteenTime,
  isCanteenAcceptingOrders,
  joinOperatingTime,
  nextScheduledOpening,
  splitOperatingTime,
  type AvailabilityMode,
  type WeeklyHours,
} from "@/lib/canteen-availability";
import { cn } from "@/lib/utils";

export type AvailabilitySettings = {
  availability_mode: AvailabilityMode;
  operating_hours: WeeklyHours;
};

type Props = {
  isActive: boolean;
  visibility: string;
  settings: AvailabilitySettings;
  saving: boolean;
  onSave: (settings: AvailabilitySettings) => Promise<void>;
};

const modes: { value: AvailabilityMode; label: string; detail: string }[] = [
  { value: "open", label: "OPEN", detail: "Accept orders now" },
  { value: "closed", label: "CLOSED", detail: "Pause orders now" },
  { value: "schedule", label: "SCHEDULE", detail: "Use weekly hours" },
];
const hourOptions = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
const minuteOptions = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0"));

function TimeSelector({ day, label, value, onChange }: { day: string; label: "From" | "To"; value: string; onChange: (value: string) => void }) {
  const parts = splitOperatingTime(value);
  const groupName = `${day} ${label.toLowerCase()}`;
  const selectClass = "rounded-lg border border-input bg-ink-soft px-2 py-1.5 text-xs font-semibold text-foreground outline-none focus:border-primary";
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      {label}
      <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-card/60 p-1" aria-label={`${day} ${label} time`}>
        <select aria-label={`${groupName} hour`} value={parts.hour} onChange={(event) => onChange(joinOperatingTime(event.currentTarget.value, parts.minute, parts.period))} className={selectClass}>
          {hourOptions.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
        </select>
        <span aria-hidden="true" className="font-semibold text-foreground">:</span>
        <select aria-label={`${groupName} minute`} value={parts.minute} onChange={(event) => onChange(joinOperatingTime(parts.hour, event.currentTarget.value, parts.period))} className={selectClass}>
          {minuteOptions.map((minute) => <option key={minute} value={minute}>{minute}</option>)}
        </select>
        <select aria-label={`${groupName} AM/PM`} value={parts.period} onChange={(event) => onChange(joinOperatingTime(parts.hour, parts.minute, event.currentTarget.value as "AM" | "PM"))} className={selectClass}>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </span>
    </label>
  );
}

export function CanteenAvailabilityPanel({ isActive, visibility, settings, saving, onSave }: Props) {
  const [draft, setDraft] = useState<AvailabilitySettings>(settings);
  const [editingHours, setEditingHours] = useState(false);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => setDraft(settings), [settings]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const currentSettings = { ...settings, is_active: isActive, visibility };
  const open = isCanteenAcceptingOrders(currentSettings, now);
  const nextOpen = nextScheduledOpening(currentSettings, now);

  async function persist(next: AvailabilitySettings, successMessage: string) {
    setMessage("");
    try {
      await onSave(next);
      setDraft(next);
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save availability settings.");
    }
  }

  function updateDay(key: keyof WeeklyHours, value: WeeklyHours[keyof WeeklyHours]) {
    setDraft((current) => ({ ...current, operating_hours: { ...current.operating_hours, [key]: value } }));
    setMessage("");
  }

  function selectMode(mode: AvailabilityMode) {
    if (mode === "schedule") {
      if (settings.availability_mode === "schedule") {
        setEditingHours((expanded) => !expanded);
        return;
      }
      setEditingHours(true);
      void persist({ ...settings, availability_mode: "schedule" }, "Scheduled hours are active.");
      return;
    }
    setEditingHours(false);
    void persist({ ...settings, availability_mode: mode }, `Manual ${mode} status saved.`);
  }

  return (
    <section className="glass-red mt-5 rounded-3xl p-4 sm:p-5" aria-labelledby="canteen-availability-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Power className="h-4 w-4 text-primary-bright" />
            <h2 id="canteen-availability-title" className="display text-lg">Canteen Availability</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Control order availability and set your weekly operating hours.</p>
        </div>
        <div className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold tracking-wide", open ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" : "border-red-500/40 bg-red-500/10 text-red-500")}>
          <span className={cn("h-2 w-2 rounded-full", open ? "bg-emerald-500" : "bg-red-500")} />
          {open ? "OPEN — Accepting Orders" : "CLOSED — Not Accepting Orders"}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Canteen availability override">
          {modes.map((mode) => (
            <button
              key={mode.value}
              type="button"
              aria-pressed={settings.availability_mode === mode.value}
              aria-expanded={mode.value === "schedule" ? editingHours : undefined}
              aria-controls={mode.value === "schedule" ? "weekly-operating-hours" : undefined}
              disabled={saving}
              onClick={() => selectMode(mode.value)}
              className={cn("min-h-11 rounded-2xl border px-2 py-2 text-xs font-bold transition disabled:opacity-60", settings.availability_mode === mode.value ? mode.value === "closed" ? "border-red-500/50 bg-red-500/10 text-red-500" : "border-primary bg-primary/10 text-primary-bright" : "border-border text-muted-foreground hover:border-primary/50")}
            >
              {mode.label}
              <span className="mt-0.5 block text-[9px] font-normal">{mode.detail}</span>
            </button>
          ))}
        </div>
        <div className="min-w-0 text-xs text-muted-foreground sm:text-right">
          <p className="flex items-center gap-1.5 sm:justify-end"><Clock3 className="h-3.5 w-3.5 shrink-0" />Today: {describeTodayHours(currentSettings, now)}</p>
          {settings.availability_mode === "closed" && <p className="mt-1 text-red-500">The owner has temporarily closed the canteen.</p>}
          {settings.availability_mode === "schedule" && !open && nextOpen && <p className="mt-1">Opens next at {formatCanteenTime(nextOpen)}</p>}
        </div>
      </div>

      {editingHours && <div id="weekly-operating-hours" className="mt-4 border-t border-border pt-3">
        <h3 className="text-xs font-semibold text-primary-bright">Weekly operating hours</h3>
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-muted-foreground">All operating hours use India Standard Time (IST). For overnight hours, split the hours across the two days.</p>
          <div className="space-y-1.5">
            {WEEKDAYS.map(({ key, label }) => {
              const hours = draft.operating_hours[key];
              const allDay = hours?.open === "00:00" && hours.close === "24:00";
              return (
                <div key={key} className="grid gap-2 rounded-2xl border border-border/70 p-3 sm:grid-cols-[6rem_1fr] sm:items-center">
                  <span className="text-xs font-semibold">{label}</span>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-xs text-muted-foreground"><input aria-label={`${label} open`} type="checkbox" checked={hours !== null} onChange={(event) => updateDay(key, event.currentTarget.checked ? { open: "09:00", close: "17:00" } : null)} />Open</label>
                    {hours && <label className="inline-flex items-center gap-2 text-xs text-muted-foreground"><input aria-label={`${label} all day`} type="checkbox" checked={allDay} onChange={(event) => updateDay(key, event.currentTarget.checked ? { open: "00:00", close: "24:00" } : { open: "09:00", close: "17:00" })} />All day</label>}
                    {hours && !allDay && <>
                      <TimeSelector day={label} label="From" value={hours.open} onChange={(open) => updateDay(key, { ...hours, open })} />
                      <TimeSelector day={label} label="To" value={hours.close} onChange={(close) => updateDay(key, { ...hours, close })} />
                    </>}
                    {hours === null && <span className="text-[11px] text-muted-foreground">Closed</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={saving} onClick={() => void persist(draft, "Weekly operating hours saved.")} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"><Save className="h-3.5 w-3.5" />{saving ? "Saving…" : "Save hours"}</button>
            {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
          </div>
        </div>
      </div>}
      {!editingHours && message && <p role="status" className="mt-2 text-xs text-muted-foreground">{message}</p>}
    </section>
  );
}

export const defaultAvailabilitySettings: AvailabilitySettings = {
  availability_mode: "schedule",
  operating_hours: DEFAULT_WEEKLY_HOURS,
};
