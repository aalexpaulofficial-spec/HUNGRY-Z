export type OrderBill = {
  orderNumber: string;
  customerName: string;
  canteenName: string;
  createdAt: string;
  orderStatus: string;
  counter: string;
  pickupCode: string;
  orderType: string;
  paymentMethod: string;
  paymentStatus: string;
  lines: { name: string; qty: number; price: number }[];
  subtotal: number;
  discount: number;
  couponCode: string | null;
  total: number;
};

const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const MARGIN = 88;
const encoder = new TextEncoder();

function bytes(text: string) {
  return encoder.encode(text);
}

function joinBytes(parts: Uint8Array[]) {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function formatRupees(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function formatOrderDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(date);
}

function wrapText(context: CanvasRenderingContext2D, value: string, maxWidth: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function createCanvas(factory: () => HTMLCanvasElement) {
  const canvas = factory();
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas drawing is unavailable in this browser.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  context.fillStyle = "#d92332";
  context.fillRect(0, 0, PAGE_WIDTH, 18);
  return { canvas, context };
}

function drawPageHeading(context: CanvasRenderingContext2D, continuation: boolean) {
  context.fillStyle = "#d92332";
  context.font = "700 54px Arial, sans-serif";
  context.fillText("HUNGRY", MARGIN, 100);
  context.fillStyle = "#242424";
  context.font = "700 32px Arial, sans-serif";
  context.fillText(continuation ? "ORDER BILL - CONTINUED" : "ORDER BILL", MARGIN, 160);
  context.fillStyle = "#666666";
  context.font = "20px Arial, sans-serif";
  context.fillText("SMART CAMPUS FOOD ORDERING", MARGIN, 196);
}

function drawTableHeading(context: CanvasRenderingContext2D, y: number) {
  context.fillStyle = "#171717";
  context.fillRect(MARGIN, y - 36, PAGE_WIDTH - MARGIN * 2, 54);
  context.fillStyle = "#ffffff";
  context.font = "700 18px Arial, sans-serif";
  context.textAlign = "left";
  context.fillText("ITEM", MARGIN + 14, y);
  context.textAlign = "right";
  context.fillText("QTY", 820, y);
  context.fillText("UNIT PRICE", 1002, y);
  context.fillText("AMOUNT", PAGE_WIDTH - MARGIN - 14, y);
  context.textAlign = "left";
  context.fillStyle = "#242424";
  return y + 34;
}

function renderBillPages(order: OrderBill, canvasFactory: () => HTMLCanvasElement) {
  const pages: HTMLCanvasElement[] = [];
  let { canvas, context } = createCanvas(canvasFactory);
  pages.push(canvas);
  drawPageHeading(context, false);
  let y = 252;

  const meta = [
    ["Order ID", order.orderNumber],
    ["Customer", order.customerName],
    ["Canteen", order.canteenName],
    ["Order time (IST)", formatOrderDate(order.createdAt)],
    ["Counter", order.counter],
    ["Collection code", order.pickupCode],
    ["Order type", order.orderType],
    ["Payment method", order.paymentMethod],
    ["Payment status", order.paymentStatus],
    ["Order status", order.orderStatus],
  ];
  const metaColumnWidth = (PAGE_WIDTH - MARGIN * 2 - 32) / 2;
  for (let index = 0; index < meta.length; index += 2) {
    const row = meta.slice(index, index + 2);
    for (let column = 0; column < row.length; column++) {
      const [label, value] = row[column]!;
      const x = MARGIN + column * (metaColumnWidth + 32);
      context.fillStyle = "#737373";
      context.font = "18px Arial, sans-serif";
      context.fillText(label!, x, y);
      context.fillStyle = "#171717";
      context.font = "700 23px Arial, sans-serif";
      context.fillText(value!, x, y + 34, metaColumnWidth);
    }
    y += 88;
  }

  context.strokeStyle = "#d6d6d6";
  context.beginPath();
  context.moveTo(MARGIN, y - 10);
  context.lineTo(PAGE_WIDTH - MARGIN, y - 10);
  context.stroke();
  y += 42;
  context.fillStyle = "#171717";
  context.font = "700 25px Arial, sans-serif";
  context.fillText("FOOD ITEMS", MARGIN, y);
  y += 55;
  y = drawTableHeading(context, y);

  for (let index = 0; index < order.lines.length; index++) {
    const line = order.lines[index]!;
    context.font = "22px Arial, sans-serif";
    const nameLines = wrapText(context, line.name, 600);
    const rowHeight = Math.max(54, nameLines.length * 30 + 24);
    if (y + rowHeight > PAGE_HEIGHT - 150) {
      ({ canvas, context } = createCanvas(canvasFactory));
      pages.push(canvas);
      drawPageHeading(context, true);
      y = drawTableHeading(context, 280);
    }
    if (index % 2 === 0) {
      context.fillStyle = "#f5f5f5";
      context.fillRect(MARGIN, y - 28, PAGE_WIDTH - MARGIN * 2, rowHeight);
    }
    context.fillStyle = "#242424";
    context.textAlign = "left";
    nameLines.forEach((nameLine, lineIndex) => context.fillText(nameLine, MARGIN + 14, y + lineIndex * 30, 600));
    context.font = "21px Arial, sans-serif";
    context.textAlign = "right";
    context.fillText(String(line.qty), 820, y);
    context.fillText(formatRupees(line.price), 1002, y);
    context.font = "700 21px Arial, sans-serif";
    context.fillText(formatRupees(line.price * line.qty), PAGE_WIDTH - MARGIN - 14, y);
    context.textAlign = "left";
    y += rowHeight;
  }

  const totalsHeight = order.discount > 0 ? 196 : 152;
  if (y + totalsHeight > PAGE_HEIGHT - 150) {
    ({ canvas, context } = createCanvas(canvasFactory));
    pages.push(canvas);
    drawPageHeading(context, true);
    y = 280;
  }
  y += 30;
  context.strokeStyle = "#d6d6d6";
  context.beginPath();
  context.moveTo(PAGE_WIDTH - MARGIN - 440, y);
  context.lineTo(PAGE_WIDTH - MARGIN, y);
  context.stroke();
  y += 45;
  const drawTotal = (label: string, value: string, bold = false) => {
    context.fillStyle = bold ? "#171717" : "#555555";
    context.font = `${bold ? "700 " : ""}${bold ? 27 : 21}px Arial, sans-serif`;
    context.textAlign = "left";
    context.fillText(label, PAGE_WIDTH - MARGIN - 440, y);
    context.textAlign = "right";
    context.fillText(value, PAGE_WIDTH - MARGIN, y);
    context.textAlign = "left";
    y += bold ? 48 : 38;
  };
  drawTotal("Subtotal", formatRupees(order.subtotal));
  if (order.discount > 0) drawTotal(order.couponCode ? `Discount (${order.couponCode})` : "Discount", `-${formatRupees(order.discount)}`);
  drawTotal("TOTAL", formatRupees(order.total), true);

  for (let index = 0; index < pages.length; index++) {
    context = pages[index]!.getContext("2d")!;
    context.fillStyle = "#777777";
    context.font = "16px Arial, sans-serif";
    context.textAlign = "center";
    context.fillText(`HUNGRY - Order ${order.orderNumber} - Page ${index + 1} of ${pages.length}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 44);
    context.textAlign = "left";
  }
  return pages;
}

function jpegBytes(canvas: HTMLCanvasElement) {
  const dataUrl = canvas.toDataURL("image/jpeg", 0.94);
  const base64 = dataUrl.split(",")[1];
  if (!base64) throw new Error("Could not render the order bill.");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function pdfObject(id: number, body: Uint8Array[]) {
  return joinBytes([bytes(`${id} 0 obj\n`), ...body, bytes("\nendobj\n")]);
}

/** Render the complete bill as paginated PDF pages without invoking print. */
export function generateOrderBillPdf(order: OrderBill, canvasFactory: () => HTMLCanvasElement = () => document.createElement("canvas")) {
  const pages = renderBillPages(order, canvasFactory);
  const objects: { id: number; body: Uint8Array }[] = [];
  const kids: string[] = [];
  objects.push({ id: 1, body: bytes("<< /Type /Catalog /Pages 2 0 R >>") });
  for (let index = 0; index < pages.length; index++) {
    const pageId = 3 + index * 3;
    const imageId = pageId + 1;
    const contentId = pageId + 2;
    kids.push(`${pageId} 0 R`);
    const image = jpegBytes(pages[index]!);
    objects.push({ id: pageId, body: bytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`) });
    objects.push({ id: imageId, body: joinBytes([bytes(`<< /Type /XObject /Subtype /Image /Width ${PAGE_WIDTH} /Height ${PAGE_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`), image, bytes("\nendstream")]) });
    const content = bytes("q 595 0 0 842 0 0 cm /Im0 Do Q");
    objects.push({ id: contentId, body: bytes(`<< /Length ${content.length} >>\nstream\n${new TextDecoder().decode(content)}\nendstream`) });
  }
  objects.push({ id: 2, body: bytes(`<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`) });
  objects.sort((left, right) => left.id - right.id);

  const header = joinBytes([bytes("%PDF-1.4\n"), Uint8Array.from([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])]);
  const chunks = [header];
  const offsets = new Array(objects.length + 1).fill(0) as number[];
  let offset = header.length;
  for (const object of objects) {
    offsets[object.id] = offset;
    const chunk = pdfObject(object.id, [object.body]);
    chunks.push(chunk);
    offset += chunk.length;
  }
  const xrefOffset = offset;
  const xref = [`xref\n0 ${objects.length + 1}\n`, "0000000000 65535 f \n"];
  for (let id = 1; id < offsets.length; id++) xref.push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  xref.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  chunks.push(bytes(xref.join("")));
  const blobParts = chunks.map((chunk) => chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer);
  return new Blob(blobParts, { type: "application/pdf" });
}

export function downloadPdfBlob(blob: Blob, filename: string) {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return true;
  } catch {
    return false;
  }
}

export function downloadOrderBillPdf(order: OrderBill) {
  try {
    const pdf = generateOrderBillPdf(order);
    return downloadPdfBlob(pdf, `HUNGRY-${order.orderNumber}-Bill.pdf`);
  } catch {
    return false;
  }
}
