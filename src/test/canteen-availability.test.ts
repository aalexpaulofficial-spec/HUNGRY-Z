import { describe, expect, it } from "vitest";
import { describeTodayHours, isCanteenAcceptingOrders, joinOperatingTime, nextScheduledOpening, splitOperatingTime, type WeeklyHours } from "@/lib/canteen-availability";
import { canAcceptOrders } from "@/lib/access";

const hours: WeeklyHours = {
  mon: null,
  tue: { open: "10:00", close: "16:00" },
  wed: null,
  thu: null,
  fri: null,
  sat: null,
  sun: null,
};
const base = { is_active: true, visibility: "public", availability_mode: "schedule" as const, operating_hours: hours, timezone: "Asia/Kolkata" };

describe("canteen availability", () => {
  it("uses local time for scheduled opening and closing", () => {
    expect(isCanteenAcceptingOrders(base, new Date("2026-01-13T04:29:00.000Z"))).toBe(false);
    expect(isCanteenAcceptingOrders(base, new Date("2026-01-13T04:30:00.000Z"))).toBe(true);
    expect(isCanteenAcceptingOrders(base, new Date("2026-01-13T10:30:00.000Z"))).toBe(false);
  });

  it("uses IST even if an old canteen row has another time zone saved", () => {
    const legacyTimezone = { ...base, timezone: "Europe/London" };
    expect(isCanteenAcceptingOrders(legacyTimezone, new Date("2026-01-13T04:30:00.000Z"))).toBe(true);
  });

  it("converts 12-hour AM/PM selections to stored 24-hour times", () => {
    expect(joinOperatingTime("12", "00", "AM")).toBe("00:00");
    expect(joinOperatingTime("12", "00", "PM")).toBe("12:00");
    expect(joinOperatingTime("05", "15", "PM")).toBe("17:15");
    expect(splitOperatingTime("00:00")).toEqual({ hour: "12", minute: "00", period: "AM" });
    expect(splitOperatingTime("17:15")).toEqual({ hour: "05", minute: "15", period: "PM" });
  });

  it("returns the next scheduled opening in the canteen timezone", () => {
    expect(nextScheduledOpening(base, new Date("2026-01-13T04:00:00.000Z"))?.toISOString()).toBe("2026-01-13T04:30:00.000Z");
  });

  it("shows weekly hours using the readable 12-hour format", () => {
    const workHours = { ...base, operating_hours: { ...hours, tue: { open: "09:00", close: "17:00" } } };
    expect(describeTodayHours(workHours, new Date("2026-01-13T04:30:00.000Z"))).toBe("09:00 AM – 05:00 PM");
  });

  it("lets manual overrides supersede hours and maintenance still close ordering", () => {
    const outsideHours = new Date("2026-01-13T04:00:00.000Z");
    expect(isCanteenAcceptingOrders({ ...base, availability_mode: "open" }, outsideHours)).toBe(true);
    expect(isCanteenAcceptingOrders({ ...base, availability_mode: "closed" }, new Date("2026-01-13T05:00:00.000Z"))).toBe(false);
    expect(canAcceptOrders({ ...base, visibility: "maintenance" }, new Date("2026-01-13T05:00:00.000Z"))).toBe(false);
  });
});
