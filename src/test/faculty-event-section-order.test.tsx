import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/foodexa/StudentEventsTab", () => ({
  StudentEventsTab: () => <section aria-label="Faculty Events">published events, remaining tokens, Event Code, Open Event</section>,
}));
vi.mock("@/components/foodexa/EventCapacityPanel", () => ({
  EventCapacityPanel: () => <section aria-label="Manage My Events">Create a Faculty Event and event management</section>,
}));

import { FacultyEventSections } from "@/components/foodexa/FacultyEventSections";

afterEach(cleanup);

describe("Faculty Events section order", () => {
  it("keeps participation before Manage My Events in shared responsive document flow", () => {
    render(<FacultyEventSections canteenId="canteen-1" canteenName="FLAMES" userId="faculty-1" />);
    const facultyEvents = screen.getByRole("region", { name: "Faculty Events" });
    const manageEvents = screen.getByRole("region", { name: "Manage My Events" });

    expect(facultyEvents.compareDocumentPosition(manageEvents) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(facultyEvents).toHaveTextContent("published events, remaining tokens, Event Code, Open Event");
    expect(manageEvents).toHaveTextContent("Create a Faculty Event and event management");
  });
});
