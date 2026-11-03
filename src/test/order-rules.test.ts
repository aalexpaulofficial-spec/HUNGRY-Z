import { describe, it, expect } from "vitest";
import { allowedPaymentMethods, canOwnerMove, canRequestRefund, friendlyOrderError, isPaymentAllowed, mergeLines, rupeesToPaise } from "@/lib/order-rules";

describe("order & payment rules", () => {
  it("parcel orders can only be paid at the counter", () => {
    expect(allowedPaymentMethods("parcel")).toEqual(["counter"]);
    expect(isPaymentAllowed("parcel", "razorpay")).toBe(false);
    expect(isPaymentAllowed("parcel", "counter")).toBe(true);
  });
  it("dine-in orders can pay online with Razorpay or at the counter", () => {
    expect(isPaymentAllowed("dine_in", "razorpay")).toBe(true);
    expect(isPaymentAllowed("dine_in", "counter")).toBe(true);
  });
  it("Razorpay amounts are in paise", () => {
    expect(rupeesToPaise(225)).toBe(22500);
    expect(() => rupeesToPaise(-1)).toThrow();
  });
  it("refunds are only for online-paid orders not yet collected", () => {
    expect(canRequestRefund({ payment_method: "razorpay", payment_status: "paid", status: "placed" })).toBe(true);
    expect(canRequestRefund({ payment_method: "razorpay", payment_status: "paid", status: "collected" })).toBe(false);
    expect(canRequestRefund({ payment_method: "counter", payment_status: "paid", status: "placed" })).toBe(false);
    expect(canRequestRefund({ payment_method: "razorpay", payment_status: "pending", status: "pending_payment" })).toBe(false);
  });
  it("kitchens can only cancel before preparation starts", () => {
    expect(canOwnerMove("placed", "cancelled")).toBe(true);
    expect(canOwnerMove("preparing", "cancelled")).toBe(false);
    expect(canOwnerMove("pending_payment", "preparing")).toBe(false);
    expect(canOwnerMove("ready", "collected")).toBe(true);
  });
  it("duplicate cart lines are merged", () => {
    expect(mergeLines([{ id: "a", qty: 1 }, { id: "a", qty: 2 }, { id: "b", qty: 1 }])).toEqual([{ id: "a", qty: 3 }, { id: "b", qty: 1 }]);
  });
  it("database rule errors become friendly messages", () => {
    expect(friendlyOrderError("HUNGRY:parcel_counter_only")).toBe("Parcel orders are paid at the counter.");
    expect(friendlyOrderError("something else")).toBeNull();
  });
});
