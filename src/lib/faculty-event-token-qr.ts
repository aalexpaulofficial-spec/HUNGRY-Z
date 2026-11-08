const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createFacultyEventTokenQrUrl(tokenId: string): string {
  if (!UUID_PATTERN.test(tokenId)) throw new Error("Invalid event token reference.");
  return `https://hungryz.vercel.app/event-token/${tokenId}`;
}
