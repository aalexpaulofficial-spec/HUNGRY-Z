import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebsiteHelpChat } from "@/components/foodexa/WebsiteHelpChat";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getWebsiteAssistantAnswer } from "@/lib/website-assistant";

beforeEach(() => { document.documentElement.dataset.theme = "dark"; });
afterEach(() => cleanup());

describe("HUNGRY Z website help chat", () => {
  it("answers common questions from the live ordering, event and refund workflows", () => {
    expect(getWebsiteAssistantAnswer("How do I place an order?", "en")).toContain("7-character code");
    expect(getWebsiteAssistantAnswer("How do event tokens work?", "en")).toContain("four-digit token");
    expect(getWebsiteAssistantAnswer("How can I register my canteen?", "en")).toContain("Register Your Canteen");
    expect(getWebsiteAssistantAnswer("How do I track my order?", "en")).toContain("Track the order in Orders");
    expect(getWebsiteAssistantAnswer("How can I contact support?", "en")).toContain("hungryofficialx@gmail.com");
    const refund = getWebsiteAssistantAnswer("When will my refund arrive?", "en");
    expect(refund).toContain("5–7 business working days");
    expect(refund).toContain("gateway confirmation");
    expect(refund).toContain("does not automatically qualify");
    expect(getWebsiteAssistantAnswer("रिफंड में कितना समय लगता है?", "hi")).toContain("5–7 व्यावसायिक कार्यदिवस");
    expect(getWebsiteAssistantAnswer("ಮರುಪಾವತಿ ಎಷ್ಟು ದಿನಗಳಲ್ಲಿ ಬರುತ್ತದೆ?", "kn")).toContain("5–7 ವ್ಯವಹಾರಿಕ ಕೆಲಸದ ದಿನಗಳಲ್ಲಿ");
  });

  it("shows example prompts and returns Hindi and Kannada answers after language switches", () => {
    render(<WebsiteHelpChat />);
    fireEvent.click(screen.getByRole("button", { name: "Ask HUNGRY Z" }));
    expect(screen.getByRole("dialog", { name: "HUNGRY Z Help" })).toHaveClass("w-[min(25rem,calc(100vw-2rem))]");
    expect(screen.getByRole("button", { name: "How do I place an order?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "\u0939\u093f\u0928\u094d\u0926\u0940" }));
    expect(screen.getByRole("button", { name: "\u0939\u093f\u0928\u094d\u0926\u0940" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getAllByRole("button", { name: "How do I place an order?" })[0]);
    expect(screen.getByText(/\u0938\u093e\u0907\u0928 \u0907\u0928 \u0915\u0930\u0947\u0902/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "\u0c95\u0ca8\u0ccd\u0ca8\u0ca1" }));
    expect(screen.getByRole("button", { name: "\u0c95\u0ca8\u0ccd\u0ca8\u0ca1" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "How do event tokens work?" } });
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    expect(screen.getByText(/\u0c95\u0cbe\u0cb0\u0ccd\u0caf\u0c95\u0ccd\u0cb0\u0cae\u0ca6/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "\u0939\u093f\u0928\u094d\u0926\u0940" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "रिफंड में कितना समय लगता है?" } });
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    expect(screen.getByText(/\u0c95\u0cbe\u0cb0\u0ccd\u0caf\u0c95\u0ccd\u0cb0\u0cae\u0ca6/)).toBeInTheDocument();
    expect(screen.getByText(/5–7 \u0935\u094d\u092f\u093e\u0935\u0938\u093e\u092f\u093f\u0915 \u0915\u093e\u0930\u094d\u092f\u0926\u093f\u0935\u0938/)).toBeInTheDocument();
  });

  it("keeps chat surfaces readable through theme switches and viewport-bounded on small screens", () => {
    render(<><ThemeToggle /><WebsiteHelpChat /></>);
    fireEvent.click(screen.getByRole("button", { name: "Ask HUNGRY Z" }));
    const dialog = screen.getByRole("dialog", { name: "HUNGRY Z Help" });
    expect(dialog).toHaveClass("bg-card", "max-h-[min(34rem,calc(100dvh-7rem))]", "w-[min(25rem,calc(100vw-2rem))]");
    expect(screen.getByRole("textbox")).toHaveClass("bg-background", "text-foreground");
    fireEvent.click(screen.getByRole("button", { name: "Switch to White Theme" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(screen.getByRole("dialog", { name: "HUNGRY Z Help" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Switch to HUNGRY Z Theme" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("dialog", { name: "HUNGRY Z Help" })).toBeInTheDocument();
  });

  it("uses a helpful localized fallback for unrecognized questions", () => {
    expect(getWebsiteAssistantAnswer("xyz", "hi")).toContain("HUNGRY Z");
    expect(getWebsiteAssistantAnswer("xyz", "kn")).toContain("HUNGRY Z");
  });
});
