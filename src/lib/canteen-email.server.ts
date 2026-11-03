// Canteen application approval / rejection emails (logged via the shared mailer).
import { sendEmail, type SendResult } from "@/lib/mailer.server";
import { canteenDecisionEmail } from "@/lib/email-templates";

export async function sendCanteenEmail(
  kind: "approved" | "rejected",
  to: string,
  data: { canteenName: string; university: string; code?: string; ownerLoginId?: string; ownerLoginCode?: string },
  refId?: string,
): Promise<SendResult> {
  return sendEmail(kind === "approved" ? "canteen_approved" : "canteen_rejected", to, canteenDecisionEmail(kind, data), refId);
}
