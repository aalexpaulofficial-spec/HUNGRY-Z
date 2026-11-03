export const WEEKDAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
] as const;

export type WeekdayKey = (typeof WEEKDAYS)[number]["key"];
export type DayHours = { open: string; close: string } | null;
export type WeeklyHours = Record<WeekdayKey, DayHours>;
export type AvailabilityMode = "schedule" | "open" | "closed";
export const CANTEEN_TIMEZONE = "Asia/Kolkata";

export const DEFAULT_WEEKLY_HOURS: WeeklyHours = Object.fromEntries(
  WEEKDAYS.map(({ key }) => [key, { open: "00:00", close: "24:00" }]),
) as WeeklyHours;

type AvailabilitySettings = {
  is_active: boolean;
  visibility: string;
  availability_mode: AvailabilityMode;
  operating_hours: WeeklyHours;
};

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekday = values["weekday"]?.slice(0, 3).toLowerCase();
  return {
    year: Number(values["year"]),
    month: Number(values["month"]),
    day: Number(values["day"]),
    weekday: weekday as WeekdayKey,
    minute: Number(values["hour"]) * 60 + Number(values["minute"]),
  };
}

function isWithinHours(hours: DayHours, minute: number) {
  if (!hours) return false;
  const [openHour, openMinute] = hours.open.split(":").map(Number);
  const [closeHour, closeMinute] = hours.close.split(":").map(Number);
  const opening = openHour! * 60 + openMinute!;
  const closing = hours.close === "24:00" ? 24 * 60 : closeHour! * 60 + closeMinute!;
  return opening === 0 && closing === 24 * 60 ? true : minute >= opening && minute < closing;
}

export function isCanteenAcceptingOrders(canteen: AvailabilitySettings | null | undefined, now = new Date()) {
  if (!canteen || !canteen.is_active || !["public", "private"].includes(canteen.visibility)) return false;
  if (canteen.availability_mode === "open") return true;
  if (canteen.availability_mode === "closed") return false;
  const parts = localParts(now, CANTEEN_TIMEZONE);
  return isWithinHours(canteen.operating_hours[parts.weekday], parts.minute);
}

function localDateToUtc(year: number, month: number, day: number, hour: number, minute: number, timezone: string) {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = localParts(new Date(guess), timezone);
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, Math.floor(parts.minute / 60), parts.minute % 60);
    const delta = target - represented;
    if (delta === 0) break;
    guess += delta;
  }
  return new Date(guess);
}

export function nextScheduledOpening(canteen: AvailabilitySettings, now = new Date()): Date | null {
  const timezone = CANTEEN_TIMEZONE;
  const today = localParts(now, timezone);
  const todayIndex = WEEKDAYS.findIndex(({ key }) => key === today.weekday);
  for (let offset = 0; offset <= 7; offset++) {
    const dayIndex = (todayIndex + offset) % 7;
    const hours = canteen.operating_hours[WEEKDAYS[dayIndex]!.key];
    if (!hours) continue;
    const [hour, minute] = hours.open.split(":").map(Number);
    const date = new Date(Date.UTC(today.year, today.month - 1, today.day + offset, 12));
    const opening = localDateToUtc(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), hour!, minute!, timezone);
    if (opening > now) return opening;
  }
  return null;
}

export function formatCanteenTime(date: Date) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: CANTEEN_TIMEZONE, hour: "numeric", minute: "2-digit" }).format(date);
}

export function splitOperatingTime(value: string) {
  if (value === "24:00") return { hour: "12", minute: "00", period: "AM" as const };
  const [rawHour, minute] = value.split(":");
  const hour = Number(rawHour);
  return { hour: String(hour % 12 || 12).padStart(2, "0"), minute: minute!, period: hour >= 12 ? "PM" as const : "AM" as const };
}

export function joinOperatingTime(hour: string, minute: string, period: "AM" | "PM") {
  const hour12 = Number(hour) % 12;
  const hour24 = hour12 + (period === "PM" ? 12 : 0);
  return `${String(hour24).padStart(2, "0")}:${minute}`;
}

export function formatOperatingTime(value: string) {
  const parts = splitOperatingTime(value);
  return `${parts.hour}:${parts.minute} ${parts.period}`;
}

export function describeTodayHours(canteen: AvailabilitySettings, now = new Date()) {
  const { weekday } = localParts(now, CANTEEN_TIMEZONE);
  const hours = canteen.operating_hours[weekday];
  if (!hours) return "Closed today";
  if (hours.open === "00:00" && hours.close === "24:00") return "Open all day";
  return `${formatOperatingTime(hours.open)} – ${formatOperatingTime(hours.close)}`;
}
