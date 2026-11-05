import { EventCapacityPanel } from "@/components/foodexa/EventCapacityPanel";
import { StudentEventsTab } from "@/components/foodexa/StudentEventsTab";

/** Keep the faculty participation workflow before event creation and management in document flow. */
export function FacultyEventSections({ canteenId, canteenName, userId }: { canteenId: string; canteenName: string; userId: string }) {
  return (
    <div className="space-y-8">
      <StudentEventsTab canteenId={canteenId} canteenName={canteenName} userId={userId} />
      <EventCapacityPanel mode="faculty" canteenId={canteenId} canteenName={canteenName} />
    </div>
  );
}
