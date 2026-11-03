const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isOrderReference(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function getScannedOrderReference(pathname: string, searchStr: string) {
  if (pathname !== "/app") return undefined;
  const candidate = new URLSearchParams(searchStr).get("orderId");
  return isOrderReference(candidate) ? candidate : undefined;
}

/** QR values contain only a random database reference. Order data and pickup codes stay behind auth. */
export function createOrderQrUrl(origin: string, orderId: string) {
  if (!isOrderReference(orderId)) throw new Error("Invalid order reference.");
  const base = new URL(origin);
  if (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname))) {
    base.protocol = "https:";
  }
  const target = new URL("/app", base.origin);
  target.searchParams.set("orderId", orderId);
  return target.toString();
}
