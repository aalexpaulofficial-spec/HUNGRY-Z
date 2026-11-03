import { describe, expect, it } from "vitest";
import { createOrderQrUrl, getScannedOrderReference, isOrderReference } from "@/lib/order-qr";

const firstOrderId = "218f6938-a887-4f9c-9bf4-34f04e8084fb";

describe("secure order QR links", () => {
  it("encodes an HTTPS app link with only the unique order reference", () => {
    const result = new URL(createOrderQrUrl("http://hungry.example", firstOrderId));
    expect(result.protocol).toBe("https:");
    expect(result.pathname).toBe("/app");
    expect(result.searchParams.get("orderId")).toBe(firstOrderId);
    expect([...result.searchParams.keys()]).toEqual(["orderId"]);
    expect(result.href).not.toContain("pickup");
    expect(result.href).not.toContain("customer");
  });

  it("preserves local development origins and rejects invalid references", () => {
    expect(createOrderQrUrl("http://localhost:5173", firstOrderId)).toContain("http://localhost:5173/app?");
    expect(isOrderReference(firstOrderId)).toBe(true);
    expect(isOrderReference("HG-1024")).toBe(false);
    expect(() => createOrderQrUrl("https://hungry.example", "HG-1024")).toThrow("Invalid order reference");
  });

  it("creates distinct scan links for distinct order IDs", () => {
    const secondOrderId = "a1d60f4c-288f-4e4f-9360-83ddfe8b97e1";
    expect(createOrderQrUrl("https://hungry.example", firstOrderId)).not.toBe(createOrderQrUrl("https://hungry.example", secondOrderId));
  });

  it("preserves only valid app order references through the login redirect", () => {
    expect(getScannedOrderReference("/app", `?orderId=${firstOrderId}`)).toBe(firstOrderId);
    expect(getScannedOrderReference("/app", "?orderId=HG-1024")).toBeUndefined();
    expect(getScannedOrderReference("/admin", `?orderId=${firstOrderId}`)).toBeUndefined();
  });
});
