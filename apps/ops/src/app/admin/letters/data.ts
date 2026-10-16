// Server only (service-role key): import from server components, route handlers and server actions.
import { eventConfig } from "@fil/config";
import { LETTER_AUDIENCES, letterAudienceOf, letterCode, letterPhotoPrefix, linkedHostNames, STAFF_LETTER, type LetterAudience, type LetterKind } from "@fil/domain";
import { createAdminSupabaseClient, OMS_BUCKET } from "@fil/supabase";

/** The thank-you letters live on the web site; ops builds the links and the sending list against it. */
export const WEB_ORIGIN = "https://falling.eventgo.kr";
export const letterUrl = (district: string, a: LetterAudience) => `${WEB_ORIGIN}/letter/${letterCode(district, a)}`;

export type LetterRow = { body: string; signer: string; updatedAt: string; via: string | null };
export type EditorLink = { id: string; label: string | null; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };
export type DistrictLetters = {
  code: string; label: string;
  letters: Record<LetterAudience, LetterRow | null>; photos: Record<LetterAudience, string[]>;
  counts: Record<LetterAudience, number>; editors: EditorLink[];
};
export type StaffLetter = { body: string; signer: string; updatedAt: string | null; photos: { key: string; url: string }[]; url: string };
export type Recipient = { name: string; phone: string; district: string | null; audience: LetterAudience; companions: number };

// The tables arrive with migration 0013, after the generated types — address them untyped.
const tbl = (name: "letters" | "letter_editors") => createAdminSupabaseClient().from(name as never);

/** Everyone who signed up (active), with the letter each one receives. Companions go with their 인도자. */
export async function loadRecipients(): Promise<Recipient[]> {
  const { data, error } = await createAdminSupabaseClient().from("reservations").select("applicant_name, phone, district_code, kind, party_size, inviter_name").eq("status", "active").order("created_at");
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const linked = linkedHostNames(rows);
  return rows.map((r) => ({ name: r.applicant_name, phone: r.phone, district: r.district_code, audience: letterAudienceOf(r, linked), companions: r.kind === "mirae" ? 0 : r.party_size - 1 }));
}

/** The photos of one letter folder (letters/<district>/<kind>/), oldest first. */
export async function listLetterPhotos(district: string, kind: LetterKind): Promise<{ key: string; url: string }[]> {
  const bucket = createAdminSupabaseClient().storage.from(OMS_BUCKET);
  const prefix = letterPhotoPrefix(district, kind);
  const { data } = await bucket.list(prefix.slice(0, -1), { limit: 50, sortBy: { column: "name", order: "asc" } });
  return (data ?? []).filter((f) => f.id).map((f) => ({ key: prefix + f.name, url: bucket.getPublicUrl(prefix + f.name).data.publicUrl }));
}

/** Photo URLs under letters/<district>/ — one listing per letter folder. */
async function loadPhotos(district: string): Promise<Record<LetterAudience, string[]>> {
  const bucket = createAdminSupabaseClient().storage.from(OMS_BUCKET);
  const lists = await Promise.all(LETTER_AUDIENCES.map(async (a) => {
    const prefix = letterPhotoPrefix(district, a);
    const { data } = await bucket.list(prefix.slice(0, -1), { limit: 50, sortBy: { column: "name", order: "asc" } });
    return (data ?? []).filter((f) => f.id).map((f) => bucket.getPublicUrl(prefix + f.name).data.publicUrl);
  }));
  return Object.fromEntries(LETTER_AUDIENCES.map((a, i) => [a, lists[i]])) as Record<LetterAudience, string[]>;
}

export async function loadLetterOverview(): Promise<{ districts: DistrictLetters[]; staff: StaffLetter; noDistrict: number; tablesMissing: boolean; oldKinds: boolean }> {
  const [lettersRes, editorsRes, recipients] = await Promise.all([
    tbl("letters").select("district_code, kind, body, signer, updated_at, updated_via"),
    tbl("letter_editors").select("id, district_code, label, created_at, last_used_at, revoked_at").order("created_at", { ascending: false }),
    loadRecipients(),
  ]);
  const tablesMissing = !!lettersRes.error || !!editorsRes.error;
  const rows = (lettersRes.data ?? []) as { district_code: string; kind: string; body: string; signer: string; updated_at: string; updated_via: string | null }[];
  const editors = (editorsRes.data ?? []) as { id: string; district_code: string; label: string | null; created_at: string; last_used_at: string | null; revoked_at: string | null }[];
  const photos = await Promise.all(eventConfig.districts.map(([code]) => loadPhotos(code)));
  const districts = eventConfig.districts.map(([code, label], i) => {
    const counts: Record<LetterAudience, number> = { vip: 0, leader: 0, mirae: 0, member: 0 };
    recipients.filter((r) => r.district === code).forEach((r) => { counts[r.audience] += r.audience === "vip" ? 1 + r.companions : 1; if (r.audience === "leader") counts.vip += r.companions; });
    const letters = Object.fromEntries(LETTER_AUDIENCES.map((a) => {
      const l = rows.find((x) => x.district_code === code && x.kind === a);
      return [a, l ? { body: l.body, signer: l.signer, updatedAt: l.updated_at, via: l.updated_via } : null];
    })) as Record<LetterAudience, LetterRow | null>;
    return {
      code, label, letters, photos: photos[i], counts,
      editors: editors.filter((e) => e.district_code === code).map((e) => ({ id: e.id, label: e.label, createdAt: e.created_at, lastUsedAt: e.last_used_at, revokedAt: e.revoked_at })),
    };
  });
  const staffRow = rows.find((r) => r.district_code === STAFF_LETTER.district && r.kind === STAFF_LETTER.kind);
  const staff: StaffLetter = {
    body: staffRow?.body ?? "", signer: staffRow?.signer ?? "", updatedAt: staffRow?.updated_at ?? null,
    photos: await listLetterPhotos(STAFF_LETTER.district, STAFF_LETTER.kind), url: `${WEB_ORIGIN}/letter/${STAFF_LETTER.code}`,
  };
  return { districts, staff, noDistrict: recipients.filter((r) => !r.district).length, tablesMissing, oldKinds: rows.some((r) => r.kind === "one" || r.kind === "two") };
}
