// Client-safe HUNGRY Z SCANNER rules and plan content (shared by landing page, dashboard and server).
import { z } from "zod";

export const SCANNER_TRIAL_MONTHS = 1;
export const SCANNER_PRICE_INR = 0;
export const MAX_SCAN_IMAGE_BYTES = 6 * 1024 * 1024;

export type ScannerPlan = {
  version: string;
  brand: string;
  name: string;
  features: string[];
  status: "live" | "coming_soon";
};

export const STUDENT_SCANNER_PLANS: ScannerPlan[] = [
  {
    version: "1.0",
    brand: "HUNGRY AI",
    name: "AI Food Scanner",
    status: "live",
    features: [
      "Camera scanning and image upload",
      "AI food identification",
      "Calories, protein, carbs, fats, fibre and sugar",
      "Portion estimation with results kept only for the current scan",
    ],
  },
  {
    version: "2.0",
    brand: "HUNGRYZ NUTRI",
    name: "AI Nutrition Assistant",
    status: "coming_soon",
    features: [
      "Daily nutrition tracking",
      "Personalized food recommendations",
      "Meal planning and nutrition reports",
      "AI nutrition chat",
    ],
  },
  {
    version: "3.0",
    brand: "HUNGRYZ INTELLI",
    name: "Nutrition Intelligence",
    status: "coming_soon",
    features: [
      "Advanced food recognition",
      "Multiple food detection",
      "Smart portion analysis",
      "Advanced nutrition insights and integrations",
    ],
  },
];

/** End of the free month: same day next month (clamped to month end, like Postgres `+ interval '1 month'`). */
export function trialEndsAt(start: Date): Date {
  const end = new Date(start.getTime());
  const day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + SCANNER_TRIAL_MONTHS);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, lastDay));
  return end;
}

export function isTrialActive(expiresAt: string | Date, now: Date = new Date()): boolean {
  return new Date(expiresAt).getTime() > now.getTime();
}

export function trialDaysLeft(expiresAt: string | Date, now: Date = new Date()): number {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

export const imageDataUrlSchema = z
  .string()
  .regex(
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/,
    "Please upload a JPG, PNG or WEBP photo.",
  )
  .refine(
    (v) => Math.floor((v.length - v.indexOf(",") - 1) * 0.75) <= MAX_SCAN_IMAGE_BYTES,
    "Photo is too large (max 6 MB).",
  );
