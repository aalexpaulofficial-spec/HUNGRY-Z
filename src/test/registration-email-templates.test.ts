import { describe, expect, it } from "vitest";
import { registrationConfirmationEmail } from "@/lib/email-templates";

describe("registration confirmation emails", () => {
  it.each(["Student", "Faculty", "Guest"])("confirms successful %s account registration without admin review", () => {
    const email = registrationConfirmationEmail({ name: "Alex", registrationType: "customer" });
    expect(email.subject).toContain("account is ready");
    expect(email.text).toContain("registration was successful");
    expect(email.text.toLowerCase()).not.toContain("admin");
    expect(email.html).not.toContain("admin review");
  });

  it("states that a canteen-owner application is pending verification", () => {
    const email = registrationConfirmationEmail({ name: "Alex", registrationType: "canteen_owner" });
    expect(email.subject).toContain("canteen application received");
    expect(email.text).toContain("pending admin verification");
  });
});
