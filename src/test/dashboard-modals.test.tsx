import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const support = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("@tanstack/react-start", () => ({ useServerFn: () => support.send }));
vi.mock("@/lib/hungry.functions", () => ({ submitSupportRequest: vi.fn() }));
vi.mock("@/lib/use-modal-dismiss", () => ({ useModalDismiss: (onClose: () => void) => onClose }));

import { FeedbackDialog } from "@/components/foodexa/FeedbackDialog";
import { LegalDialog } from "@/components/foodexa/LegalDialog";
import { privacyPolicy, termsConditions } from "@/content/legal";

afterEach(cleanup);
beforeEach(() => {
  support.send.mockReset();
  support.send.mockResolvedValue({ sent: true, confirmationSent: true });
});

describe("dashboard support and legal dialogs", () => {
  it("shows the complete privacy policy in a scrollable modal and closes in place", () => {
    const onClose = vi.fn();
    const { container } = render(<LegalDialog legalDocument={privacyPolicy} onClose={onClose} />);

    expect(screen.getByRole("dialog", { name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByText("9. Changes and contact")).toBeInTheDocument();
    expect(container.querySelector("[role='dialog'] .overflow-y-auto")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close legal information" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows the complete terms in the same modal pattern", () => {
    render(<LegalDialog legalDocument={termsConditions} onClose={() => undefined} />);

    expect(screen.getByRole("dialog", { name: "Terms & Conditions" })).toBeInTheDocument();
    expect(screen.getByText("11. Support and updates")).toBeInTheDocument();
  });

  it("closes a legal popup with Escape without changing its dashboard route", () => {
    const onClose = vi.fn();
    render(<LegalDialog legalDocument={termsConditions} onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("saves the selected rating and comments through the configured support server function", async () => {
    render(<FeedbackDialog mode="rate" onClose={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "4 stars" }));
    fireEvent.change(screen.getByLabelText("Comments"), { target: { value: "Fast and easy ordering." } });
    fireEvent.click(screen.getByRole("button", { name: "Send to HUNGRY Z Support" }));

    await waitFor(() => expect(support.send).toHaveBeenCalledWith({ data: expect.objectContaining({
      category: "Rate Us",
      description: "Fast and easy ordering.",
      rating: 4,
    }) }));
    expect(await screen.findByText(/Your request was emailed to/)).toBeInTheDocument();
  });

  it("allows canteen feedback as well as operational reports", async () => {
    const onClose = vi.fn();
    render(<FeedbackDialog mode="canteen-report" onClose={onClose} />);

    fireEvent.change(screen.getByLabelText(/What is this about/), { target: { value: "Feedback" } });
    fireEvent.change(screen.getByLabelText("Details"), { target: { value: "Please add more vegetarian options." } });
    fireEvent.click(screen.getByRole("button", { name: "Send to HUNGRY Z Support" }));

    await waitFor(() => expect(support.send).toHaveBeenCalledWith({ data: expect.objectContaining({
      category: "Feedback",
      description: "Please add more vegetarian options.",
    }) }));
  });

  it("closes the canteen report popup with its X button", () => {
    const onClose = vi.fn();
    render(<FeedbackDialog mode="canteen-report" onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
