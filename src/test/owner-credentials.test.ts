import { describe, expect, it } from "vitest";
import { canteenDecisionEmail } from "@/lib/email-templates";
import { generateCanteenCode } from "@/lib/access";
import {
  generateOwnerLoginCode,
  generateOwnerLoginId,
  generateOwnerCredentialPair,
  hashOwnerLoginCode,
  verifyOwnerCredentialPair,
  verifyOwnerLoginCode,
} from "@/lib/owner-credentials";
import { canAccessOwnerCanteen } from "@/lib/canteen-owner-flow";

describe("canteen owner approval credentials", () => {
  it("generates independent owner credentials and stores only verifiable hashes", async () => {
    const customerCode = generateCanteenCode();
    const ownerLoginId = generateOwnerLoginId();
    const { loginId: distinctOwnerId, loginCode: distinctOwnerCode } = generateOwnerCredentialPair(customerCode);
    const ownerLoginCode = distinctOwnerCode;
    const stored = await hashOwnerLoginCode(ownerLoginCode);

    expect(ownerLoginId).toMatch(/^[A-Z2-9]{7}$/);
    expect(ownerLoginCode).toMatch(/^[A-Z2-9]{7}$/);
    expect(ownerLoginId).not.toBe(customerCode);
    expect(distinctOwnerId).not.toBe(customerCode);
    expect(distinctOwnerId).toHaveLength(7);
    expect(distinctOwnerCode).not.toBe(distinctOwnerId);
    expect(ownerLoginCode).not.toBe(customerCode);
    expect(stored.hash).not.toContain(ownerLoginCode);
    await expect(verifyOwnerLoginCode(ownerLoginCode, stored.salt, stored.hash)).resolves.toBe(true);
    await expect(verifyOwnerLoginCode(generateOwnerLoginCode(), stored.salt, stored.hash)).resolves.toBe(false);
    await expect(verifyOwnerCredentialPair(distinctOwnerId, distinctOwnerCode, {
      login_id: distinctOwnerId,
      code_salt: stored.salt,
      code_hash: stored.hash,
    })).resolves.toBe(true);
    await expect(verifyOwnerCredentialPair(customerCode, distinctOwnerCode, {
      login_id: distinctOwnerId,
      code_salt: stored.salt,
      code_hash: stored.hash,
    })).resolves.toBe(false);
    await expect(verifyOwnerCredentialPair(distinctOwnerId, customerCode, {
      login_id: distinctOwnerId,
      code_salt: stored.salt,
      code_hash: stored.hash,
    })).resolves.toBe(false);
  });

  it("only grants owner dashboard access to active approved canteens", () => {
    expect(canAccessOwnerCanteen(true, "approved")).toBe(true);
    expect(canAccessOwnerCanteen(false, "approved")).toBe(false);
    expect(canAccessOwnerCanteen(true, "pending")).toBe(false);
    expect(canAccessOwnerCanteen(true, "rejected")).toBe(false);
  });

  it("emails the owner credentials separately from the student and guest canteen code", () => {
    const email = canteenDecisionEmail("approved", {
      canteenName: "North Canteen",
      university: "Example University",
      code: "CSTM123",
      ownerLoginId: "ABCDEFG",
      ownerLoginCode: "WNR2223",
    });

    expect(email.text).toContain("Canteen Owner ID (7 characters): ABCDEFG");
    expect(email.text).toContain("Canteen Owner Password Code (7 characters): WNR2223");
    expect(email.text).toContain("Student/Faculty/Guest Canteen Code (7 characters): CSTM123");
    expect(email.text).toContain("Students, faculty, and guests enter this shared code");
    expect(email.text).toContain("It cannot access the owner dashboard.");
    expect(email.text).not.toContain("sent to that registered email");
  });
});


