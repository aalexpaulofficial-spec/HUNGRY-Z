import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebsiteHelpChat } from "@/components/foodexa/WebsiteHelpChat";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getWebsiteAssistantAnswer } from "@/lib/website-assistant";

beforeEach(() => { document.documentElement.dataset.theme = "dark"; localStorage.removeItem("hungry:assistant-language"); });
afterEach(() => { cleanup(); localStorage.removeItem("hungry:assistant-language"); });

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

  it("runs English, Hindi and Kannada conversations using localized suggested questions", () => {
    render(<WebsiteHelpChat />);
    fireEvent.click(screen.getByRole("button", { name: "Ask HUNGRY Z" }));
    expect(screen.getByRole("dialog", { name: "HUNGRY Z Help" })).toHaveClass("w-[min(25rem,calc(100vw-2rem))]");
    fireEvent.click(screen.getByRole("button", { name: "How can I register my canteen?" }));
    expect(screen.getByText(/Register Your Canteen to submit/)).toBeInTheDocument();
    cleanup();
    localStorage.removeItem("hungry:assistant-language");

    render(<WebsiteHelpChat />);
    fireEvent.click(screen.getByRole("button", { name: "Ask HUNGRY Z" }));
    fireEvent.click(screen.getByRole("button", { name: "हिन्दी" }));
    expect(screen.getByRole("button", { name: "मैं खाना कैसे ऑर्डर करूँ?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "मैं खाना कैसे ऑर्डर करूँ?" }));
    expect(screen.getByText(/साइन इन करें/)).toBeInTheDocument();
    cleanup();
    localStorage.removeItem("hungry:assistant-language");

    render(<WebsiteHelpChat />);
    fireEvent.click(screen.getByRole("button", { name: "Ask HUNGRY Z" }));
    fireEvent.click(screen.getByRole("button", { name: "ಕನ್ನಡ" }));
    expect(screen.getByRole("button", { name: "ನಾನು ಆಹಾರವನ್ನು ಹೇಗೆ ಆರ್ಡರ್ ಮಾಡಲಿ?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ನಾನು ಆಹಾರವನ್ನು ಹೇಗೆ ಆರ್ಡರ್ ಮಾಡಲಿ?" }));
    expect(screen.getByText(/ಸೈನ್ ಇನ್ ಮಾಡಿ/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "ಮರುಪಾವತಿ ಎಷ್ಟು ದಿನಗಳಲ್ಲಿ ಬರುತ್ತದೆ?" } });
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    expect(screen.getByText(/5–7 ವ್ಯವಹಾರಿಕ ಕೆಲಸದ ದಿನಗಳಲ್ಲಿ/)).toBeInTheDocument();
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
