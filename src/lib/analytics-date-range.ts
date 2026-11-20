export type AnalyticsPreset = "today" | "week" | "month" | "year" | "custom";

export function analyticsDateRange(preset: AnalyticsPreset, from: string, to: string, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = today;
  let end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  if (preset === "week") {
    const mondayOffset = (today.getDay() + 6) % 7;
    start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset);
    end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  } else if (preset === "month") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  } else if (preset === "year") {
    start = new Date(today.getFullYear(), 0, 1);
    end = new Date(today.getFullYear() + 1, 0, 1);
  } else if (preset === "custom") {
    start = from ? new Date(`${from}T00:00:00`) : today;
    const inclusiveEnd = to ? new Date(`${to}T00:00:00`) : today;
    end = new Date(inclusiveEnd.getFullYear(), inclusiveEnd.getMonth(), inclusiveEnd.getDate() + 1);
  }

  return { start, end };
}

export function formatAnalyticsDateRange(start: Date, exclusiveEnd: Date) {
  const format = (date: Date) => new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(date);
  const lastDay = new Date(exclusiveEnd.getFullYear(), exclusiveEnd.getMonth(), exclusiveEnd.getDate() - 1);
  return start.getTime() === lastDay.getTime() ? format(start) : `${format(start)} to ${format(lastDay)}`;
}

export function dateInputLocal(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
