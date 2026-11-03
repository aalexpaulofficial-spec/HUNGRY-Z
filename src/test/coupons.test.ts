import { describe, it, expect } from "vitest";
import { computeDiscount, evaluateCoupon, type Coupon, type CouponContext } from "@/lib/coupons";

const coupon: Coupon = {
  id: "c1",
  code: "WELCOME10",
  description: "",
  discount_type: "percent",
  discount_value: 10,
  max_discount: null,
  min_order_value: 100,
  starts_at: null,
  expires_at: null,
  usage_limit: null,
  per_user_limit: 1,
  canteen_id: null,
  eligible_roles: null,
  first_order_only: false,
  active: true,
};
const ctx: CouponContext = { subtotal: 250, now: new Date("2026-10-29T10:00:00Z"), canteenId: "k1", role: "student", totalUses: 0, userUses: 0, priorOrders: 0 };

describe("coupon rules", () => {
  it("10% of ₹250 is ₹25, total ₹225", () => {
    expect(evaluateCoupon(coupon, ctx)).toEqual({ ok: true, discount: 25, total: 225 });
  });
  it("percent discounts round down and respect the cap", () => {
    expect(computeDiscount({ discount_type: "percent", discount_value: 15, max_discount: null }, 99)).toBe(14);
    expect(computeDiscount({ discount_type: "percent", discount_value: 50, max_discount: 40 }, 200)).toBe(40);
  });
  it("flat discount never exceeds the subtotal", () => {
    expect(computeDiscount({ discount_type: "flat", discount_value: 80, max_discount: null }, 50)).toBe(50);
  });
  it("rejects orders below the minimum value", () => {
    const r = evaluateCoupon(coupon, { ...ctx, subtotal: 99 });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe("min_order");
  });
  it("rejects expired and not-yet-started coupons", () => {
    expect(evaluateCoupon({ ...coupon, expires_at: "2026-10-29T09:59:59Z" }, ctx)).toMatchObject({ ok: false, reason: "expired" });
    expect(evaluateCoupon({ ...coupon, starts_at: "2026-10-30T00:00:00Z" }, ctx)).toMatchObject({ ok: false, reason: "not_started" });
  });
  it("rejects inactive coupons", () => {
    expect(evaluateCoupon({ ...coupon, active: false }, ctx)).toMatchObject({ ok: false, reason: "inactive" });
  });
  it("enforces the total usage limit", () => {
    expect(evaluateCoupon({ ...coupon, usage_limit: 50 }, { ...ctx, totalUses: 50 })).toMatchObject({ ok: false, reason: "exhausted" });
    expect(evaluateCoupon({ ...coupon, usage_limit: 50 }, { ...ctx, totalUses: 49 }).ok).toBe(true);
  });
  it("enforces the per-customer limit", () => {
    expect(evaluateCoupon(coupon, { ...ctx, userUses: 1 })).toMatchObject({ ok: false, reason: "already_used" });
    expect(evaluateCoupon({ ...coupon, per_user_limit: 3 }, { ...ctx, userUses: 2 }).ok).toBe(true);
  });
  it("only eligible account types can use role-restricted coupons", () => {
    expect(evaluateCoupon({ ...coupon, eligible_roles: ["faculty"] }, ctx)).toMatchObject({ ok: false, reason: "not_eligible" });
    expect(evaluateCoupon({ ...coupon, eligible_roles: ["student", "faculty"] }, ctx).ok).toBe(true);
  });
  it("first-order coupons are refused after a previous order", () => {
    expect(evaluateCoupon({ ...coupon, first_order_only: true }, { ...ctx, priorOrders: 1 })).toMatchObject({ ok: false, reason: "first_order_only" });
  });
  it("canteen-specific coupons only work at that canteen", () => {
    expect(evaluateCoupon({ ...coupon, canteen_id: "other" }, ctx)).toMatchObject({ ok: false, reason: "wrong_canteen" });
  });
});
