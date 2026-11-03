export type CanteenApplicationStatus = "pending" | "approved" | "rejected";

export function canAccessOwnerCanteen(isActive: boolean, applicationStatus: string | null | undefined) {
  return isActive && applicationStatus === "approved";
}
