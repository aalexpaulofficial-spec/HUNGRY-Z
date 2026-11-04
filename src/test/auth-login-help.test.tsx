import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HUNGRY_SOCIAL_LINKS } from "@/lib/social-links";

const { signInWithPassword, resetPasswordForEmail, signUp, signOut, updateUser, getSession, onAuthStateChange } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-start")>()),
  useServerFn: () => vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signInWithPassword, resetPasswordForEmail, signUp, signOut, updateUser, getSession, onAuthStateChange } },
}));

import { LoginForm, SignupForm } from "@/routes/auth";
import { ResetPasswordPage } from "@/routes/reset-password";
import { signupSchema } from "@/lib/access";

describe("HUNGRY Z authentication", () => {
  it("requests a password reset without revealing whether the email exists", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<LoginForm language="en" />);

    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    const dialog = screen.getByRole("dialog", { name: "Reset your password" });
    fireEvent.change(screen.getByLabelText("Enter your registered email address."), { target: { value: "student@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => expect(resetPasswordForEmail).toHaveBeenCalledWith("student@example.com", { redirectTo: "http://localhost:3000/reset-password" }));
    expect(await screen.findByRole("status")).toHaveTextContent("If an account exists for that email, we’ve sent a password reset link.");
    expect(dialog).toBeInTheDocument();
  });

  it("keeps account creation disabled until explicit consent and opens both existing legal modals", () => {
    render(<SignupForm language="en" onDone={vi.fn()} />);
    const create = screen.getByRole("button", { name: "Create Account" });
    expect(create).toBeDisabled();
    expect(screen.getByText("Please agree to continue.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Privacy Policy" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Privacy Policy");
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Terms & Conditions" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Terms & Conditions");
    fireEvent.keyDown(window, { key: "Escape" });

    fireEvent.click(screen.getByRole("checkbox"));
    expect(create).toBeEnabled();
    expect(screen.queryByText("Please agree to continue.")).not.toBeInTheDocument();
  });

  it("requires acceptance in the signup validator for every customer role", () => {
    const common = { fullName: "Asha Student", registrationNumber: "REG123", email: "asha@example.com", password: "longpassword" };
    for (const role of ["student", "faculty", "guest"] as const) {
      expect(signupSchema.safeParse({ ...common, role, acceptedTerms: false }).success).toBe(false);
      expect(signupSchema.safeParse({ ...common, role, acceptedTerms: true }).success).toBe(true);
    }
  });

  it("sends a consent record with signup metadata after acceptance", async () => {
    signUp.mockResolvedValue({ data: { session: null }, error: null });
    signOut.mockResolvedValue({ error: null });
    render(<SignupForm language="en" onDone={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Full name"), { target: { value: "Asha Student" } });
    fireEvent.change(screen.getByPlaceholderText("Registration number"), { target: { value: "REG123" } });
    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "asha@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("Password (8+ characters)"), { target: { value: "longpassword" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => expect(signUp).toHaveBeenCalled());
    expect(signUp.mock.calls.at(-1)?.[0].options.data).toMatchObject({ accepted_terms: true, terms_version: "2026-11-04" });
    expect(await screen.findByText("Account created")).toBeInTheDocument();
  });

  it("validates matching passwords and updates the password through Supabase", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } });
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    updateUser.mockResolvedValue({ error: null });
    render(<ResetPasswordPage />);
    const newPassword = await screen.findByLabelText("New Password");
    const confirmPassword = screen.getByLabelText("Confirm Password");
    fireEvent.change(newPassword, { target: { value: "correct-pass-123" } });
    fireEvent.change(confirmPassword, { target: { value: "different-pass" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The passwords do not match.");
    expect(updateUser).not.toHaveBeenCalled();

    fireEvent.change(confirmPassword, { target: { value: "correct-pass-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: "correct-pass-123" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Your password has been updated.");
  });

  it("keeps the existing login and social destinations", () => {
    render(<LoginForm language="en" />);
    const social = [
      ["Instagram", HUNGRY_SOCIAL_LINKS.instagram],
      ["WhatsApp", HUNGRY_SOCIAL_LINKS.whatsapp],
      ["LinkedIn", HUNGRY_SOCIAL_LINKS.linkedin],
    ] as const;
    for (const [name, href] of social) {
      const link = screen.getByRole("link", { name: `Follow HUNGRY Z on ${name}` });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.querySelector("img")).toHaveAttribute("src", "/Red%20Social%20Media%20Icons%20Trio.png");
    }
  });
});
