import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadPdfBlob, generateOrderBillPdf, type OrderBill } from "@/lib/order-bill-pdf";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function fakeCanvasFactory(capturedText: string[]) {
  return () => {
    const context = {
      fillStyle: "",
      strokeStyle: "",
      font: "",
      textAlign: "left",
      fillRect: vi.fn(),
      fillText: vi.fn((text: string) => capturedText.push(text)),
      measureText: (text: string) => ({ width: text.length * 12 }),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    return {
      width: 0,
      height: 0,
      getContext: () => context,
      toDataURL: () => "data:image/jpeg;base64,/9j/2Q==",
    } as unknown as HTMLCanvasElement;
  };
}

const order: OrderBill = {
  orderNumber: "HG-1024",
  customerName: "Alex Paul",
  canteenName: "North Canteen",
  createdAt: "2026-11-02T08:00:00.000Z",
  orderStatus: "Ready for pickup",
  counter: "North Canteen Counter 2",
  pickupCode: "4821",
  orderType: "Takeaway",
  paymentMethod: "UPI",
  paymentStatus: "Paid",
  lines: [
    { name: "Masala Dosa", qty: 2, price: 80 },
    { name: "Filter Coffee", qty: 1, price: 30 },
  ],
  subtotal: 190,
  discount: 20,
  couponCode: "CAMPUS20",
  total: 170,
};

describe("order bill PDF", () => {
  it("generates a PDF containing all order, item, payment, collection, and total details", async () => {
    const capturedText: string[] = [];
    const pdf = generateOrderBillPdf(order, fakeCanvasFactory(capturedText));
    const content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(pdf);
    });

    expect(pdf.type).toBe("application/pdf");
    expect(content.startsWith("%PDF-1.4")).toBe(true);
    expect(content).toContain("/Type /Pages");
    expect(capturedText).toEqual(expect.arrayContaining([
      "HG-1024",
      "Alex Paul",
      "North Canteen",
      "Ready for pickup",
      "North Canteen Counter 2",
      "4821",
      "Takeaway",
      "UPI",
      "Paid",
      "Masala Dosa",
      "Filter Coffee",
      "₹80",
      "₹160",
      "₹30",
      "₹190",
      "₹170",
      "Discount (CAMPUS20)",
    ]));
  });

  it("downloads the PDF blob directly using the supplied filename", () => {
    let filename = "";
    let href = "";
    const createObjectURL = vi.fn(() => "blob:h-ungry-bill");
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      filename = this.download;
      href = this.href;
    });
    vi.spyOn(window, "setTimeout").mockImplementation(((callback: TimerHandler) => {
      if (typeof callback === "function") callback();
      return 0;
    }) as typeof window.setTimeout);

    const blob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
    expect(downloadPdfBlob(blob, "HUNGRY Z-HG-1024-Bill.pdf")).toBe(true);
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(filename).toBe("HUNGRY Z-HG-1024-Bill.pdf");
    expect(href).toContain("blob:h-ungry-bill");
  });
});
