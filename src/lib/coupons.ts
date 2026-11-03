// Pure coupon rules. The server evaluates these with fresh database counts,
// then the database re-checks usage limits under a row lock when the order is created.
import { z } from "zod";

export type Coupon = {
  id: string;
  code: string;
  description: string;
  discount_type: "percent" | "flat" | string;
  discount_value: number;
  max_discount: number | null;
  min_order_value: number;
  starts_at: string | null;
  expires_at: string | null;
  usage_limit: number | null;
  per_user_limit: number;
  canteen_id: string | null;
  eligible_roles: string[] | null;
  first_order_only: boolean;
  active: boolean;
};

export type CouponContext = {
  subtotal: number; // rupees
  now: Date;
  canteenId: string;
  role: string; // student | faculty | guest
  totalUses: number; // reserved + used redemptions across all users
  userUses: number; // reserved + used redemptions by this user
  priorOrders: number; // this user's non-cancelled orders
};

export type CouponResult =
  | { ok: true; discount: number; total: number }
  | { ok: false; reason: CouponFailure; message: string };

export type CouponFailure =
  | "inactive"
  | "not_started"
  | "expired"
  | "wrong_canteen"
  | "not_eligible"
  | "first_order_only"
  | "min_order"
  | "exhausted"
  | "already_used";

export const couponCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{3,20}$/, "Enter a valid coupon code");

const fail = (reason: CouponFailure, message: string): CouponResult => ({ ok: false, reason, message });

/** Discount in whole rupees, rounded down, never more than the subtotal or the coupon cap. */
export function computeDiscount(c: Pick<Coupon, "discount_type" | "discount_value" | "max_discount">, subtotal: number): number {
  let d = c.discount_type === "percent" ? Math.floor((subtotal * c.discount_value) / 100) : c.discount_value;
  if (c.max_discount != null) d = Math.min(d, c.max_discount);
  return Math.max(0, Math.min(d, subtotal));
}

export function evaluateCoupon(c: Coupon, ctx: CouponContext): CouponResult {
  if (!c.active) return fail("inactive", "This coupon is no longer active.");
  if (c.starts_at && new Date(c.starts_at) > ctx.now) return fail("not_started", "This coupon isn't active yet.");
  if (c.expires_at && new Date(c.expires_at) <= ctx.now) return fail("expired", "This coupon has expired.");
  if (c.canteen_id && c.canteen_id !== ctx.canteenId) return fail("wrong_canteen", "This coupon isn't valid at this canteen.");
  if (c.eligible_roles && c.eligible_roles.length > 0 && !c.eligible_roles.includes(ctx.role))
    return fail("not_eligible", "Your account type isn't eligible for this coupon.");
  if (c.first_order_only && ctx.priorOrders > 0) return fail("first_order_only", "This coupon is only for your first order.");
  if (ctx.subtotal < c.min_order_value) return fail("min_order", `Add ₹${c.min_order_value - ctx.subtotal} more to use this coupon (minimum ₹${c.min_order_value}).`);
  if (c.usage_limit != null && ctx.totalUses >= c.usage_limit) return fail("exhausted", "This coupon has reached its usage limit.");
  if (ctx.userUses >= c.per_user_limit) return fail("already_used", "You've already used this coupon.");
  const discount = computeDiscount(c, ctx.subtotal);
  return { ok: true, discount, total: ctx.subtotal - discount };
}
