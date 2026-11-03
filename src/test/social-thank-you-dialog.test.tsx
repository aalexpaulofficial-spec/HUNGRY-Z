import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HUNGRY_SOCIAL_LINKS, SocialThankYouDialog } from "@/components/foodexa/SocialThankYouDialog";

describe("social thank-you dialog", () => {
  it("shows the requested message and icon-only social destinations", () => {
    render(<SocialThankYouDialog open onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: /THANK YOU FOR CHOOSING HUNGRY Z/ })).toBeInTheDocument();
    expect(screen.getByText(/FREE discount coupons when available/)).toBeInTheDocument();
    expect(screen.getByText(/Join us, comment/)).toHaveTextContent('"HUNGRYZ"');
    const links = [
      ["Instagram", HUNGRY_SOCIAL_LINKS.instagram],
      ["WhatsApp", HUNGRY_SOCIAL_LINKS.whatsapp],
      ["LinkedIn", HUNGRY_SOCIAL_LINKS.linkedin],
    ] as const;
    for (const [name, href] of links) {
      const link = screen.getByRole("link", { name: `Follow HUNGRY Z on ${name}` });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link.textContent).toBe("");
    }
  });

  it("closes from the close button and Escape", () => {
    const onClose = vi.fn();
    render(<SocialThankYouDialog open onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Close thank-you message" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
