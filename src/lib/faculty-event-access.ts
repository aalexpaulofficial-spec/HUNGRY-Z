const publishedEventViewerRoles = new Set(["student", "faculty", "guest"]);

export function isPublishedEventViewerRole(role: string | null | undefined): boolean {
  return Boolean(role && publishedEventViewerRoles.has(role));
}

export function canViewPublishedEventsInCanteen(
  role: string | null | undefined,
  currentCanteenId: string | null | undefined,
  requestedCanteenId: string,
): boolean {
  return isPublishedEventViewerRole(role) && currentCanteenId === requestedCanteenId;
}
