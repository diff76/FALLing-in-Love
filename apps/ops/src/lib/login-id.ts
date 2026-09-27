/**
 * Staff sign in with a short id ("admin", "staff"), not an e-mail. Supabase Auth still needs an
 * e-mail, so ids map to <id>@ops.eventgo.kr — a domain we own and never send mail to.
 * Full e-mails (with "@") are accepted as typed, so older accounts keep working.
 */
export const LOGIN_DOMAIN = "ops.eventgo.kr";
export const LOGIN_ID_RE = /^[a-z0-9._-]{2,32}$/i;

export function toEmail(loginId: string): string {
  const id = loginId.trim().toLowerCase();
  return id.includes("@") ? id : `${id}@${LOGIN_DOMAIN}`;
}
export function toLoginId(email: string | null | undefined): string {
  if (!email) return "";
  return email.toLowerCase().endsWith(`@${LOGIN_DOMAIN}`) ? email.slice(0, -(LOGIN_DOMAIN.length + 1)) : email;
}

/** Public origin of the ops app, used in links we hand to people (access links). */
export const OPS_PUBLIC_ORIGIN = "https://ops.eventgo.kr";

/**
 * Origin for a link minted in this request. Production always uses the public domain over
 * https — never an env value, which may be a local dev URL (that shipped http://localhost:3001
 * links on 2026-09-28). Previews use their own https host; local dev keeps http://localhost.
 */
export function publicOrigin(host: string | null | undefined): string {
  const h = (host ?? "").trim().toLowerCase();
  const local = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?$/.test(h) || /^(192\.168|10)\./.test(h);
  if (process.env.VERCEL_ENV === "production") return OPS_PUBLIC_ORIGIN;
  if (local) return `http://${h}`;
  return h ? `https://${h}` : OPS_PUBLIC_ORIGIN;
}

