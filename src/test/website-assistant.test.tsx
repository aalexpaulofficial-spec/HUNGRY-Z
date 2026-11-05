import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WebsiteHelpChat } from "@/components/foodexa/WebsiteHelpChat";
import { getWebsiteAssistantAnswer } from "@/lib/website-assistant";

afterEach(() => cleanup());

describe("HUNGRY Z website help chat", () => {
  it("answers common feature questions with current ordering and event behavior", () => {
    expect(getWebsiteAssistantAnswer("How do I place an order?", "en")).toContain("7-character code");
    expect(getWebsiteAssistantAnswer("How do I get my event token?", "en")).toContain("four-digit token");
    expect(getWebsiteAssistantAnswer("How do I pay?", "en")).toContain("Razorpay");
    expect(getWebsiteAssistantAnswer("Does HUNGRY Z charge a platform fee?", "en")).toContain("₹0");
    expect(getWebsiteAssistantAnswer("Can I cancel an order?", "en")).toContain("awaiting payment");
  });

  it("answers in Hindi and Kannada and lets the visitor switch languages", () => {
    render(<WebsiteHelpChat />);
    fireEvent.click(screen.getByRole("button", { name: "Chat with HUNGRY Z" }));
    expect(screen.getByRole("dialog", { name: "HUNGRY Z Help" })).toHaveClass("w-[min(25rem,calc(100vw-2rem))]");
    expect(screen.getByRole("dialog", { name: "HUNGRY Z Help" })).toHaveClass("max-h-[min(34rem,calc(100dvh-7rem))]");

    fireEvent.click(screen.getByRole("button", { name: "हिन्दी" }));
    expect(screen.getByRole("button", { name: "हिन्दी" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByRole("textbox", { name: "अपना सवाल लिखें…" }), { target: { value: "मैं ऑर्डर कैसे करूँ?" } });
    fireEvent.click(screen.getByRole("button", { name: "भेजें" }));
    expect(screen.getByText(/साइन इन करें या खाता बनाएँ/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ಕನ್ನಡ" }));
    expect(screen.getByRole("button", { name: "ಕನ್ನಡ" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByRole("textbox", { name: "ನಿಮ್ಮ ಪ್ರಶ್ನೆ ಬರೆಯಿರಿ…" }), { target: { value: "ನನ್ನ ಕಾರ್ಯಕ್ರಮದ ಟೋಕನ್ ಹೇಗೆ ಪಡೆಯಲಿ?" } });
    fireEvent.click(screen.getByRole("button", { name: "ಕಳುಹಿಸಿ" }));
    expect(screen.getByText(/ಉಪನ್ಯಾಸಕರು ಕಾರ್ಯಕ್ರಮದ ವಿವರ/)).toBeInTheDocument();
  });

  it("uses a helpful localized fallback for unrecognized questions", () => {
    expect(getWebsiteAssistantAnswer("xyz", "hi")).toContain("मैं HUNGRY Z की सुविधाओं");
    expect(getWebsiteAssistantAnswer("xyz", "kn")).toContain("ಸಹಾಯ ಮಾಡಬಹುದು");
  });
});
