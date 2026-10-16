/**
 * Thank-you letters after the event (migration 0013). One link per district × audience:
 * /letter/<district code in lower case>-<audience>, e.g. /letter/23-vip, /letter/ed-member.
 * The district pastor writes two letters: "one" for VIP · 인도자 · 미래셀, "two" for 일반 성도.
 */
export const LETTER_AUDIENCES = ["vip", "leader", "mirae", "member"] as const;
export type LetterAudience = (typeof LETTER_AUDIENCES)[number];
export type LetterKind = "one" | "two";

export const letterKindOf = (a: LetterAudience): LetterKind => (a === "member" ? "two" : "one");

export const LETTER_AUDIENCE_LABEL: Record<LetterAudience, string> = {
  vip: "VIP · 초대받은 분", leader: "인도자 · 초청자", mirae: "미래셀", member: "일반 성도 · 혼자 신청",
};

/** Envelope line and the first greeting, written for each audience (the pastor's text follows). */
export function letterGreeting(a: LetterAudience, district: string): { envelope: string; to: string } {
  switch (a) {
    case "vip": return { envelope: `To. 귀한 분께 · ${district}`, to: `그날 함께해 주신 귀한 분께 · ${district}` };
    case "leader": return { envelope: `To. ${district} 성도님께`, to: `소중한 분을 초대해 주신 ${district} 성도님께` };
    case "mirae": return { envelope: `To. ${district} 미래셀 가족께`, to: `${district} 미래셀 가족께` };
    default: return { envelope: `To. ${district} 성도님께`, to: `그날 함께해 주신 ${district} 성도님께` };
  }
}

export const letterCode = (district: string, a: LetterAudience) => `${district.toLowerCase()}-${a}`;

/** "23-vip" → { district: "23", audience: "vip" }; null when it is not a letter code. */
export function parseLetterCode(code: string, districts: readonly string[]): { district: string; audience: LetterAudience } | null {
  const m = /^([a-z0-9]{2,4})-(vip|leader|mirae|member)$/i.exec(code);
  if (!m) return null;
  const district = districts.find((d) => d.toLowerCase() === m[1].toLowerCase());
  return district ? { district, audience: m[2].toLowerCase() as LetterAudience } : null;
}

/**
 * Who receives which letter — the same split as the ops dashboard's 참석자 구분:
 * 초대받음 → VIP; 미래셀 → 미래셀; a host who came with companions (or whom a self-registered VIP named as the
 * only host of that name) → 인도자; any other host → 일반 성도.
 */
export function letterAudienceOf(r: { kind: string; party_size: number; applicant_name: string }, linkedHostNames: Set<string>): LetterAudience {
  if (r.kind === "guest_self") return "vip";
  if (r.kind === "mirae") return "mirae";
  return r.party_size > 1 || linkedHostNames.has(r.applicant_name.replace(/\s+/g, "")) ? "leader" : "member";
}

/** Host names that a self-registered VIP wrote as 초대해 주신 분, counted only when exactly one host has that name. */
export function linkedHostNames(rows: { kind: string; applicant_name: string; inviter_name: string | null }[]): Set<string> {
  const norm = (n: string | null) => (n ?? "").replace(/\s+/g, "");
  const hosts = new Map<string, number>();
  rows.forEach((r) => { if (r.kind === "host") hosts.set(norm(r.applicant_name), (hosts.get(norm(r.applicant_name)) ?? 0) + 1); });
  const out = new Set<string>();
  rows.forEach((r) => { const n = norm(r.inviter_name); if (r.kind === "guest_self" && n && hosts.get(n) === 1) out.add(n); });
  return out;
}

/** Pastor link tokens: 24 random bytes, base64url (same shape as Pass tokens). */
export const LETTER_TOKEN_PATTERN = /^[A-Za-z0-9_-]{28,48}$/;
