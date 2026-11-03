// Loads fresh usage counts and evaluates a coupon for one customer (server-only).
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { evaluateCoupon, type Coupon, type CouponResult } from "@/lib/coupons";

export async function evaluateCouponFor(p: { code: string; userId: string; canteenId: string; role: string; subtotal: number }): Promise<{ coupon: Coupon | null; result: CouponResult }> {
  const { data: c } = await db.from("coupons").select("*").eq("code", p.code).maybeSingle();
  if (!c) return { coupon: null, result: { ok: false, reason: "inactive", message: "This coupon code doesn't exist." } };
  const [total, mine, prior] = await Promise.all([
    db.from("coupon_redemptions").select("id", { count: "exact", head: true }).eq("coupon_id", c.id).in("status", ["reserved", "used"]),
    db.from("coupon_redemptions").select("id", { count: "exact", head: true }).eq("coupon_id", c.id).eq("user_id", p.userId).in("status", ["reserved", "used"]),
    db.from("orders").select("id", { count: "exact", head: true }).eq("user_id", p.userId).neq("status", "cancelled"),
  ]);
  const coupon = c as Coupon;
  return {
    coupon,
    result: evaluateCoupon(coupon, {
      subtotal: p.subtotal,
      now: new Date(),
      canteenId: p.canteenId,
      role: p.role,
      totalUses: total.count ?? 0,
      userUses: mine.count ?? 0,
      priorOrders: prior.count ?? 0,
    }),
  };
}
