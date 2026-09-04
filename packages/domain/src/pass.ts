/**
 * Matinée Pass tokens. The QR carries ONLY an opaque token inside a URL; the database
 * stores only its SHA-256 hash. Works in Node 20 and browsers (Web Crypto).
 */
const TOKEN_BYTES = 24;

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  const b64 = typeof btoa === "function" ? btoa(bin) : Buffer.from(bin, "binary").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generatePassToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export async function hashPassToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const PASS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{28,48}$/;

export function isPassTokenShape(token: string): boolean {
  return PASS_TOKEN_PATTERN.test(token);
}

export function passUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/$/, "")}/pass/${token}`;
}
