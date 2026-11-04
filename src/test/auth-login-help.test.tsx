import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HUNGRY_SOCIAL_LINKS } from "@/lib/social-links";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signInWithPassword: vi.fn() } },
}));

import { LoginForm } from "@/routes/auth";

describe("login help and social links", () => {
  it("opens and closes the same-page support popup and shows the linked icon asset", () => {
    render(<LoginForm language="en" />);

    fireEvent.click(screen.getByRole("button", { name: "Forgot your password or having trouble logging in?" }));
    const dialog = screen.getByRole("dialog", { name: "Login help" });
    expect(dialog).toHaveTextContent("Please contact our support team at");
    expect(dialog).toHaveTextContent("We're happy to help!");
    expect(screen.getByRole("link", { name: "hungryofficialx@gmail.com" })).toHaveAttribute("href", "mailto:hungryofficialx@gmail.com");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const social = [
      ["Instagram", HUNGRY_SOCIAL_LINKS.instagram],
      ["WhatsApp", HUNGRY_SOCIAL_LINKS.whatsapp],
      ["LinkedIn", HUNGRY_SOCIAL_LINKS.linkedin],
    ] as const;
    for (const [name, href] of social) {
      const link = screen.getByRole("link", { name: `Follow HUNGRY Z on ${name}` });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.querySelector("img")).toHaveAttribute("src", "/Instagram%2C%20WhatsApp%2C%20and%20LinkedIn%20Icons.png");
    }
  });

  it("translates the help label and popup into Hindi and Kannada", () => {
    for (const language of ["hi", "kn"] as const) {
      const { unmount } = render(<LoginForm language={language} />);
      expect(screen.getByRole("button", { name: language === "hi" ? "पासवर्ड भूल गए हैं या लॉग इन करने में परेशानी हो रही है?" : "ಪಾಸ್‌ವರ್ಡ್ ಮರೆತಿರಾ ಅಥವಾ ಲಾಗಿನ್ ಮಾಡಲು ತೊಂದರೆಯಾಗುತ್ತಿದೆಯೇ?" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: language === "hi" ? "पासवर्ड भूल गए हैं या लॉग इन करने में परेशानी हो रही है?" : "ಪಾಸ್‌ವರ್ಡ್ ಮರೆತಿರಾ ಅಥವಾ ಲಾಗಿನ್ ಮಾಡಲು ತೊಂದರೆಯಾಗುತ್ತಿದೆಯೇ?" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      unmount();
    }
  });
});
