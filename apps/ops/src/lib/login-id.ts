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
