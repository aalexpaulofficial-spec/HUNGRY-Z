import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HUNGRY_SOCIAL_LINKS } from "@/lib/social-links";

const { signInWithPassword, resetPasswordForEmail, signUp, signOut, updateUser, getSession, onAuthStateChange, verifyOtp, navigate } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  verifyOtp: vi.fn(),
  navigate: vi.fn(),
}));
const registrationConfirmation = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-start")>()),
  useServerFn: (serverFunction: string) => serverFunction === "registration-confirmation" ? registrationConfirmation : vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/hungry.functions", () => ({ ensureWelcomeEmail: "welcome-email", sendRegistrationConfirmation: "registration-confirmation" }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signInWithPassword, resetPasswordForEmail, signUp, signOut, updateUser, getSession, onAuthStateChange, verifyOtp } },
}));

import { LoginForm, SignupForm } from "@/routes/auth";
import { ResetPasswordPage } from "@/routes/reset-password";
import { signupSchema } from "@/lib/access";

describe("HUNGRY Z authentication", () => {
  beforeEach(() => {
    registrationConfirmation.mockReset().mockResolvedValue({ sent: true });
    navigate.mockReset();
  });
  it("requests a password reset without revealing whether the email exists", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<LoginForm language="en" />);

    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    const dialog = screen.getByRole("dialog", { name: "Reset your password" });
    fireEvent.change(screen.getByLabelText("Enter your registered email address."), { target: { value: "student@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => expect(resetPasswordForEmail).toHaveBeenCalledWith("student@example.com", { redirectTo: "https://hungryz.in/reset-password" }));
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
    signUp.mockResolvedValue({ data: { user: { id: "new-user-id" }, session: null }, error: null });
    signOut.mockResolvedValue({ error: null });
    render(<SignupForm language="en" onDone={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Full name"), { target: { value: "Asha Student" } });
    fireEvent.change(screen.getByPlaceholderText("Registration number"), { target: { value: "REG123" } });
    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "asha@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("Password (8+ characters)"), { target: { value: "longpassword" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => expect(signUp).toHaveBeenCalled());
    expect(signUp.mock.calls.at(-1)?.[0].options.data).toMatchObject({ accepted_terms: true, terms_version: "2026-11-19" });
    expect(await screen.findByText("Account created")).toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent("Thank you for registering with HUNGRY Z! A confirmation email has been sent to your registered email address. Please check your Inbox. If you cannot find it, kindly check your Spam or Junk folder.");
  });

  it("reports successful account creation honestly when confirmation email delivery is not confirmed", async () => {
    signUp.mockResolvedValue({ data: { user: { id: "new-faculty-id" }, session: null }, error: null });
    registrationConfirmation.mockResolvedValue({ sent: false });
    render(<SignupForm language="en" onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "faculty" }));
    fireEvent.change(screen.getByPlaceholderText("Full name"), { target: { value: "Asha Faculty" } });
    fireEvent.change(screen.getByPlaceholderText("Registration number"), { target: { value: "FAC123" } });
    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "faculty@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("Password (8+ characters)"), { target: { value: "longpassword" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Your account was created successfully, but delivery of the confirmation email could not be confirmed.");
  });

  it("validates matching passwords and updates the password through Supabase", async () => {
    window.history.replaceState({}, "", "/reset-password#access_token=reset-token&type=recovery");
    let authListener: ((event: string, session: { access_token: string; user: { id: string } }) => void) | undefined;
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    onAuthStateChange.mockImplementation((listener) => {
      authListener = listener;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    updateUser.mockResolvedValue({ error: null });
    signOut.mockReset().mockResolvedValue({ error: null });
    render(<ResetPasswordPage />);
    await act(async () => {
      authListener?.("PASSWORD_RECOVERY", { access_token: "reset-token", user: { id: "user-1" } });
    });
    const newPassword = await screen.findByLabelText("New Password");
    const confirmPassword = screen.getByLabelText("Confirm Password");
    fireEvent.click(screen.getByRole("button", { name: "Show new password" }));
    expect(newPassword).toHaveAttribute("type", "text");
    expect(confirmPassword).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show confirm password" }));
    expect(confirmPassword).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide new password" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Hide new password" }));
    expect(newPassword).toHaveAttribute("type", "password");
    fireEvent.change(newPassword, { target: { value: "correct-pass-123" } });
    fireEvent.change(confirmPassword, { target: { value: "different-pass" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The passwords do not match.");
    expect(updateUser).not.toHaveBeenCalled();

    fireEvent.change(confirmPassword, { target: { value: "correct-pass-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: "correct-pass-123" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Your password has been updated. Redirecting you to Login");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/auth", search: { mode: "login" }, replace: true }), { timeout: 2500 });
    window.history.replaceState({}, "", "/");
  });

  it("verifies token-hash recovery links and shows a clear error when already used", async () => {
    window.history.replaceState({}, "", "/reset-password?token_hash=used-token&type=recovery");
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    verifyOtp.mockResolvedValue({ data: { session: null }, error: { message: "Token has expired or is invalid" } });
    render(<ResetPasswordPage />);

    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "used-token", type: "recovery" });
    expect(await screen.findByRole("alert")).toHaveTextContent("invalid, expired, or has already been used");
    expect(screen.queryByLabelText("New Password")).not.toBeInTheDocument();
    window.history.replaceState({}, "", "/");
  });

  it("rejects expired reset links even if a regular session exists", async () => {
    window.history.replaceState({}, "", "/reset-password#error=access_denied&error_code=otp_expired");
    getSession.mockResolvedValue({ data: { session: { user: { id: "already-signed-in" } } } });
    render(<ResetPasswordPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("invalid, expired, or has already been used");
    expect(screen.queryByLabelText("New Password")).not.toBeInTheDocument();
    window.history.replaceState({}, "", "/");
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
