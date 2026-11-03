const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PBKDF2_ITERATIONS = 210_000;

function randomText(length: number) {
  let output = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) output += ALPHABET[byte % ALPHABET.length];
  return output;
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string) {
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
}

async function deriveCodeHash(code: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(code), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt.buffer as ArrayBuffer, iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export function generateOwnerLoginId() {
  return randomText(7);
}

export function generateOwnerLoginCode() {
  return randomText(7);
}

export function generateOwnerCredentialPair(customerCode: string) {
  let loginId = generateOwnerLoginId();
  while (loginId === customerCode) loginId = generateOwnerLoginId();
  let loginCode = generateOwnerLoginCode();
  while (loginCode === customerCode || loginCode === loginId) loginCode = generateOwnerLoginCode();
  return { loginId, loginCode };
}

export async function verifyOwnerCredentialPair(
  loginId: string,
  loginCode: string,
  stored: { login_id: string; code_salt: string; code_hash: string } | null,
) {
  if (!stored || loginId.trim().toUpperCase() !== stored.login_id) return false;
  return verifyOwnerLoginCode(loginCode.trim().toUpperCase(), stored.code_salt, stored.code_hash);
}

export async function hashOwnerLoginCode(code: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveCodeHash(code, salt);
  return { salt: hex(salt), hash: hex(hash) };
}

export async function verifyOwnerLoginCode(code: string, saltHex: string, hashHex: string) {
  const actual = await deriveCodeHash(code, fromHex(saltHex));
  const expected = fromHex(hashHex);
  let difference = actual.length ^ expected.length;
  for (let index = 0; index < Math.max(actual.length, expected.length); index++) {
    difference |= (actual[index] ?? 0) ^ (expected[index] ?? 0);
  }
  return difference === 0;
}

export async function ownerLoginRateLimitKey(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return hex(new Uint8Array(digest));
}
