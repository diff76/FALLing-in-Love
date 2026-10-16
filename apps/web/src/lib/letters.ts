// Server only (service-role key). Import from route handlers and server components, never from "use client" files.
import { districtName, eventConfig } from "@fil/config";
import { hashPassToken, LETTER_TOKEN_PATTERN, letterKindOf, parseLetterCode, type LetterAudience, type LetterKind } from "@fil/domain";
import { createAdminSupabaseClient, isSupabaseAdminConfigured, listOms, type OmsTrack } from "@fil/supabase";

/** Thank-you letters (migration 0013): the pastor's text per district, read and written only on the server. */
export const DISTRICT_CODES = eventConfig.districts.map(([c]) => c);
export type LetterText = { body: string; signer: string; updatedAt: string | null };
export type LetterPageData = {
  district: string; districtLabel: string; audience: LetterAudience; kind: LetterKind;
  letter: LetterText; tracks: OmsTrack[]; numbers: { people: number; vip: number; photos: number };
};

const db = () => createAdminSupabaseClient();
// The tables arrive with migration 0013, after the generated types — address them untyped.
const letters = () => db().from("letters" as never);
const editors = () => db().from("letter_editors" as never);

async function readLetter(district: string, kind: LetterKind): Promise<LetterText | null> {
  const { data } = await letters().select("body, signer, updated_at").eq("district_code", district).eq("kind", kind).maybeSingle();
  const r = data as { body: string; signer: string; updated_at: string } | null;
  return r ? { body: r.body, signer: r.signer, updatedAt: r.updated_at } : null;
}

/** Everything the letter page shows, or null when the code is unknown or the pastor has not written it yet. */
export async function loadLetterPage(code: string): Promise<LetterPageData | null> {
  const hit = parseLetterCode(code, DISTRICT_CODES);
  if (!hit || !isSupabaseAdminConfigured()) return null;
  const kind = letterKindOf(hit.audience);
  const [letter, oms, people] = await Promise.all([readLetter(hit.district, kind), listOms().catch(() => ({ tracks: [], photos: [] })), countPeople()]);
  if (!letter?.body.trim()) return null;
  return {
    district: hit.district, districtLabel: districtName(hit.district), audience: hit.audience, kind, letter,
    tracks: oms.tracks, numbers: { ...people, photos: oms.photos.length },
  };
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

export async function loadDistrictLetters(district: string): Promise<{ one: LetterText; two: LetterText }> {
  const empty: LetterText = { body: "", signer: "", updatedAt: null };
  const [one, two] = await Promise.all([readLetter(district, "one"), readLetter(district, "two")]);
  return { one: one ?? empty, two: two ?? empty };
}

export async function saveDistrictLetters(district: string, input: { one: string; two: string; signer: string }, via: "pastor" | "admin") {
  const clean = (s: string, max: number) => String(s ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
  const signer = clean(input.signer, 40), now = new Date().toISOString();
  const rows = (["one", "two"] as const).map((kind) => ({ district_code: district, kind, body: clean(input[kind], 2000), signer, updated_at: now, updated_via: via }));
  const { error } = await letters().upsert(rows as never);
  if (error) throw new Error(error.message.includes("letters") ? "편지 저장소가 아직 없습니다 — 0013 SQL을 먼저 실행해 주세요." : error.message);
}
