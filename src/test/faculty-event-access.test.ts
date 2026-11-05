import { describe, expect, it } from "vitest";
import { canViewPublishedEventsInCanteen } from "@/lib/faculty-event-access";

const selectedCanteen = "canteen-one";

describe("published event canteen visibility", () => {
  it.each(["student", "faculty", "guest"]) ("allows %s to list published events in their selected canteen", (role) => {
    expect(canViewPublishedEventsInCanteen(role, selectedCanteen, selectedCanteen)).toBe(true);
  });

  it("allows the creating Faculty member through the same canteen membership rule", () => {
    expect(canViewPublishedEventsInCanteen("faculty", selectedCanteen, selectedCanteen)).toBe(true);
  });

  it("never lists events from a different canteen or for users without an eligible role", () => {
    expect(canViewPublishedEventsInCanteen("student", selectedCanteen, "canteen-two")).toBe(false);
    expect(canViewPublishedEventsInCanteen("canteen_owner", selectedCanteen, selectedCanteen)).toBe(false);
    expect(canViewPublishedEventsInCanteen("guest", null, selectedCanteen)).toBe(false);
  });
});
