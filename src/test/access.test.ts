import { describe, it, expect } from "vitest";
import { accessCodeSchema, signupSchema, canAcceptOrders, generateCanteenCode, isCustomerRole } from "@/lib/access";

const base = { role: "student", fullName: "Asha K", registrationNumber: "21CS001", email: "a@b.co", password: "password1" };

describe("access rules", () => {
  it("code must be exactly 7 characters", () => {
    expect(accessCodeSchema.safeParse("ABC123").success).toBe(false);
    expect(accessCodeSchema.safeParse("abc1234").success).toBe(true);
  });
  it("generated canteen codes are 7 characters", () => {
    expect(accessCodeSchema.safeParse(generateCanteenCode()).success).toBe(true);
  });
  it("signup does not require a canteen code", () => {
    expect(signupSchema.safeParse(base).success).toBe(true);
  });

  it("allows only student, faculty, and guest accounts to join with a customer code", () => {
    expect(isCustomerRole("student")).toBe(true);
    expect(isCustomerRole("faculty")).toBe(true);
    expect(isCustomerRole("guest")).toBe(true);
    expect(isCustomerRole("canteen_owner")).toBe(false);
    expect(isCustomerRole("admin")).toBe(false);
  });
  it("registration number optional only for guests", () => {
    expect(signupSchema.safeParse({ ...base, registrationNumber: "" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...base, role: "guest", registrationNumber: "" }).success).toBe(true);
  });
  it("only active, non-maintenance canteens accept orders", () => {
    expect(canAcceptOrders({ is_active: true, visibility: "public" })).toBe(true);
    expect(canAcceptOrders({ is_active: true, visibility: "private" })).toBe(true);
    expect(canAcceptOrders({ is_active: true, visibility: "maintenance" })).toBe(false);
    expect(canAcceptOrders({ is_active: false, visibility: "public" })).toBe(false);
  });
});
