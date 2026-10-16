// Server only (service-role key): import from server components, route handlers and server actions.
import { eventConfig } from "@fil/config";
import { letterAudienceOf, letterCode, linkedHostNames, type LetterAudience } from "@fil/domain";
import { createAdminSupabaseClient } from "@fil/supabase";

/** The thank-you letters live on the web site; ops builds the links and the sending list against it. */
export const WEB_ORIGIN = "https://falling.eventgo.kr";
export const letterUrl = (district: string, a: LetterAudience) => `${WEB_ORIGIN}/letter/${letterCode(district, a)}`;

export type LetterRow = { kind: "one" | "two"; body: string; signer: string; updatedAt: string; via: string | null };
export type EditorLink = { id: string; label: string | null; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };
export type DistrictLetters = {
  code: string; label: string; one: LetterRow | null; two: LetterRow | null;
  counts: Record<LetterAudience, number>; editors: EditorLink[];
};
export type Recipient = { name: string; phone: string; district: string | null; audience: LetterAudience; companions: number };

// The tables arrive with migration 0013, after the generated types — address them untyped.
const tbl = (name: "letters" | "letter_editors") => createAdminSupabaseClient().from(name as never);

/** Everyone who signed up (active), with the letter each one receives. Companions go with their 인도자. */
export async function loadRecipients(): Promise<Recipient[]> {
  const { data, error } = await createAdminSupabaseClient().from("reservations").select("applicant_name, phone, district_code, kind, party_size, inviter_name").eq("status", "active").order("created_at");
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const linked = linkedHostNames(rows);
  return rows.map((r) => ({ name: r.applicant_name, phone: r.phone, district: r.district_code, audience: letterAudienceOf(r, linked), companions: r.kind === "host" ? r.party_size - 1 : r.kind === "guest_self" ? r.party_size - 1 : 0 }));
}

export async function loadLetterOverview(): Promise<{ districts: DistrictLetters[]; noDistrict: number; tablesMissing: boolean }> {
  const [lettersRes, editorsRes, recipients] = await Promise.all([
    tbl("letters").select("district_code, kind, body, signer, updated_at, updated_via"),
    tbl("letter_editors").select("id, district_code, label, created_at, last_used_at, revoked_at").order("created_at", { ascending: false }),
    loadRecipients(),
  ]);
  const tablesMissing = !!lettersRes.error || !!editorsRes.error;
  const letters = (lettersRes.data ?? []) as { district_code: string; kind: "one" | "two"; body: string; signer: string; updated_at: string; updated_via: string | null }[];
  const editors = (editorsRes.data ?? []) as { id: string; district_code: string; label: string | null; created_at: string; last_used_at: string | null; revoked_at: string | null }[];
  const pick = (code: string, kind: "one" | "two"): LetterRow | null => {
    const l = letters.find((x) => x.district_code === code && x.kind === kind);
    return l ? { kind, body: l.body, signer: l.signer, updatedAt: l.updated_at, via: l.updated_via } : null;
  };
  const districts = eventConfig.districts.map(([code, label]) => {
    const counts: Record<LetterAudience, number> = { vip: 0, leader: 0, mirae: 0, member: 0 };
    recipients.filter((r) => r.district === code).forEach((r) => { counts[r.audience] += r.audience === "vip" ? 1 + r.companions : 1; if (r.audience === "leader") counts.vip += r.companions; });
    return {
      code, label, one: pick(code, "one"), two: pick(code, "two"), counts,
      editors: editors.filter((e) => e.district_code === code).map((e) => ({ id: e.id, label: e.label, createdAt: e.created_at, lastUsedAt: e.last_used_at, revokedAt: e.revoked_at })),
    };
  });
  return { districts, noDistrict: recipients.filter((r) => !r.district).length, tablesMissing };
}
