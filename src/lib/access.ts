import { z } from "zod";
import { isCanteenAcceptingOrders, type AvailabilityMode, type WeeklyHours } from "@/lib/canteen-availability";

export const accessCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{7}$/, "Code must be exactly 7 letters or numbers");

export const roles = ["student", "faculty", "guest"] as const;
export type Role = (typeof roles)[number];

export function isCustomerRole(role: unknown): role is Role {
  return roles.includes(role as Role);
}

export const signupSchema = z
  .object({
    role: z.enum(roles),
    acceptedTerms: z.literal(true, { error: "Please agree to the Privacy Policy and Terms & Conditions." }),
    fullName: z.string().trim().min(2, "Enter your full name").max(100),
    registrationNumber: z.string().trim().max(40).optional().default(""),
    email: z.string().trim().email("Enter a valid email").max(255),
    password: z.string().min(8, "At least 8 characters").max(72),
  })
  .refine((v) => v.role === "guest" || v.registrationNumber.length > 0, {
    path: ["registrationNumber"],
    message: "Registration number is required for students and faculty",
  });

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(1, "Enter your password").max(72),
});

export const applicationSchema = z.object({
  ownerName: z.string().trim().min(2, "Enter the owner's name").max(100),
  ownerPhone: z.string().trim().regex(/^[0-9+\-\s]{7,20}$/, "Enter a valid phone number"),
  canteenName: z.string().trim().min(2, "Enter the canteen name").max(100),
  universityName: z.string().trim().min(2, "Enter the university / campus").max(150),
  campusLocation: z.string().trim().min(2, "Enter the campus location").max(200),
  contactEmail: z.string().trim().email("Enter a valid email").max(255),
  fssaiLicense: z.string().trim().min(5, "Enter the FSSAI licence number").max(40),
  ownerIdProof: z.string().trim().min(4, "Enter a government ID number").max(60),
  notes: z.string().trim().max(500).optional().default(""),
});

export const visibilities = ["public", "private", "maintenance"] as const;
export type Visibility = (typeof visibilities)[number];

/** Only approved, active, non-maintenance canteens accept orders. */
export function canAcceptOrders(c: {
  is_active: boolean;
  visibility: string;
  availability_mode?: string;
  operating_hours?: unknown;
} | null | undefined, now = new Date()) {
  if (!c || !c.is_active || (c.visibility !== "public" && c.visibility !== "private")) return false;
  if (c.availability_mode && c.operating_hours) return isCanteenAcceptingOrders(c as unknown as {
    is_active: boolean;
    visibility: string;
    availability_mode: AvailabilityMode;
    operating_hours: WeeklyHours;
  }, now);
  return true;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateCanteenCode(rand: (n: number) => number = (n) => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0]! % n;
}) {
  let s = "";
  for (let i = 0; i < 7; i++) s += ALPHABET[rand(ALPHABET.length)];
  return s;
}

export type MenuItem = {
  id: string;
  canteen_id: string;
  name: string;
  description: string;
  image: string;
  price: number;
  category: string;
  veg: boolean;
  prep_minutes: number;
  counter: string;
  tag: string | null;
  available: boolean;
  stock: number | null;
};

export const ORDER_STATUSES = ["placed", "preparing", "ready", "collected"] as const;
export const ORDER_LABELS: Record<string, string> = {
  pending_payment: "Awaiting payment",
  placed: "Placed",
  preparing: "Preparing",
  ready: "Ready for pickup",
  collected: "Collected",
  cancelled: "Cancelled",
};
