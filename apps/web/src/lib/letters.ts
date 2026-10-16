// Server only (service-role key). Import from route handlers and server components, never from "use client" files.
import { districtName, eventConfig } from "@fil/config";
import { hashPassToken, LETTER_AUDIENCES, LETTER_MAX_CHARS, LETTER_MAX_PHOTOS, LETTER_TOKEN_PATTERN, letterPhotoPrefix, parseLetterCode, type LetterAudience } from "@fil/domain";
import { createAdminSupabaseClient, isSupabaseAdminConfigured, listOms, OMS_BUCKET, type OmsTrack } from "@fil/supabase";

/** Thank-you letters (migrations 0013, 0014): one per district × audience, read and written only on the server. */
export const DISTRICT_CODES = eventConfig.districts.map(([c]) => c);
export type LetterPhoto = { key: string; url: string };
export type LetterText = { body: string; signer: string; updatedAt: string | null; photos: LetterPhoto[] };
export type LetterPageData = {
  district: string; districtLabel: string; audience: LetterAudience;
  letter: LetterText; tracks: OmsTrack[]; numbers: { people: number; vip: number; photos: number };
};

const db = () => createAdminSupabaseClient();
// The tables arrive with migration 0013, after the generated types — address them untyped.
const letters = () => db().from("letters" as never);
const editors = () => db().from("letter_editors" as never);
const bucket = () => db().storage.from(OMS_BUCKET);

/** The photos attached to one letter, oldest first (their names start with the upload time). */
export async function letterPhotos(district: string, a: LetterAudience): Promise<LetterPhoto[]> {
  const prefix = letterPhotoPrefix(district, a);
  const { data } = await bucket().list(prefix.slice(0, -1), { limit: 50, sortBy: { column: "name", order: "asc" } });
  return (data ?? []).filter((f) => f.id && /\.(jpe?g|png|webp)$/i.test(f.name))
    .map((f) => ({ key: prefix + f.name, url: bucket().getPublicUrl(prefix + f.name).data.publicUrl }));
}

async function readLetter(district: string, a: LetterAudience): Promise<LetterText | null> {
  const [{ data }, photos] = await Promise.all([
    letters().select("body, signer, updated_at").eq("district_code", district).eq("kind", a).maybeSingle(),
    letterPhotos(district, a),
  ]);
  const r = data as { body: string; signer: string; updated_at: string } | null;
  return r ? { body: r.body, signer: r.signer, updatedAt: r.updated_at, photos } : photos.length ? { body: "", signer: "", updatedAt: null, photos } : null;
}

/** Everything the letter page shows, or null when the code is unknown or the pastor has not written it yet. */
export async function loadLetterPage(code: string): Promise<LetterPageData | null> {
  const hit = parseLetterCode(code, DISTRICT_CODES);
  if (!hit || !isSupabaseAdminConfigured()) return null;
  const [letter, oms, people] = await Promise.all([readLetter(hit.district, hit.audience), listOms().catch(() => ({ tracks: [], photos: [] })), countPeople()]);
  if (!letter?.body.trim()) return null;
  return { district: hit.district, districtLabel: districtName(hit.district), audience: hit.audience, letter, tracks: oms.tracks, numbers: { ...people, photos: oms.photos.length } };
}

/** Everyone who signed up (active), and how many of them were VIP (self-registered guests + companions). */
async function countPeople(): Promise<{ people: number; vip: number }> {
  const { data } = await db().from("reservations").select("kind, party_size").eq("status", "active");
  const rows = data ?? [];
  return {
    people: rows.reduce((n, r) => n + r.party_size, 0),
    vip: rows.reduce((n, r) => n + (r.kind === "guest_self" ? r.party_size : r.kind === "host" ? r.party_size - 1 : 0), 0),
  };
}

// ---------- the pastor's link ----------
/** The district a pastor link may write for, or null (unknown, revoked, malformed). */
export async function districtForEditorToken(token: unknown): Promise<string | null> {
  if (typeof token !== "string" || !LETTER_TOKEN_PATTERN.test(token) || !isSupabaseAdminConfigured()) return null;
  const { data } = await editors().select("id, district_code, revoked_at").eq("token_hash", await hashPassToken(token)).maybeSingle();
  const row = data as { id: string; district_code: string; revoked_at: string | null } | null;
  if (!row || row.revoked_at) return null;
  await editors().update({ last_used_at: new Date().toISOString() } as never).eq("id", row.id);
  return row.district_code;
}

export async function loadDistrictLetters(district: string): Promise<Record<LetterAudience, LetterText>> {
  const empty = (): LetterText => ({ body: "", signer: "", updatedAt: null, photos: [] });
  const all = await Promise.all(LETTER_AUDIENCES.map((a) => readLetter(district, a)));
  return Object.fromEntries(LETTER_AUDIENCES.map((a, i) => [a, all[i] ?? empty()])) as Record<LetterAudience, LetterText>;
}

export type LetterDraft = Record<LetterAudience, string> & { signer: string };
export async function saveDistrictLetters(district: string, input: LetterDraft, via: "pastor" | "admin") {
  const clean = (s: string, max: number) => String(s ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
  const signer = clean(input.signer, 40), now = new Date().toISOString();
  const rows = LETTER_AUDIENCES.map((kind) => ({ district_code: district, kind, body: clean(input[kind], LETTER_MAX_CHARS), signer, updated_at: now, updated_via: via }));
  const { error } = await letters().upsert(rows as never);
  if (error) throw new Error(/letters_kind_check|violates check/.test(error.message) ? "편지 종류를 4가지로 나누는 DB 설정이 아직 없습니다 — 0014 SQL을 먼저 실행해 주세요."
    : error.message.includes("letters") ? "편지 저장소가 아직 없습니다 — 0013 SQL을 먼저 실행해 주세요." : error.message);
}

// ---------- photos ----------
/** A one-time upload address for one more photo on a letter (the browser shrinks it to a JPEG first). */
export async function photoUploadTicket(district: string, a: LetterAudience): Promise<{ key: string; signedUrl: string }> {
  const have = await letterPhotos(district, a);
  if (have.length >= LETTER_MAX_PHOTOS) throw new Error(`사진은 편지마다 ${LETTER_MAX_PHOTOS}장까지 붙일 수 있습니다.`);
  const key = `${letterPhotoPrefix(district, a)}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { data, error } = await bucket().createSignedUploadUrl(key);
  if (error || !data) throw new Error(error?.message ?? "업로드 주소를 만들지 못했습니다.");
  return { key, signedUrl: data.signedUrl };
}

/** Remove one photo; the key must sit under this district's letters. */
export async function removeLetterPhoto(district: string, key: string) {
  if (!key.startsWith(`letters/${district}/`) || !/^letters\/[A-Za-z0-9]+\/(vip|leader|mirae|member)\/[\w.-]+$/.test(key)) throw new Error("잘못된 사진입니다.");
  const { error } = await bucket().remove([key]);
  if (error) throw new Error(error.message);
}
