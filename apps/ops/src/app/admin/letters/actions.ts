"use server";

import { eventConfig } from "@fil/config";
import { generatePassToken, hashPassToken, LETTER_AUDIENCES, LETTER_MAX_CHARS, LETTER_MAX_PHOTOS, letterPhotoPrefix, STAFF_LETTER, type LetterAudience } from "@fil/domain";
import { createAdminSupabaseClient, isSupabaseAdminConfigured, OMS_BUCKET } from "@fil/supabase";
import { getSession } from "@/lib/auth";
import { listLetterPhotos, WEB_ORIGIN } from "./data";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
async function attempt<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try { return { ok: true, data: await fn() }; } catch (e) { return { ok: false, error: (e as Error).message }; }
}
async function adminDb() {
  const s = await getSession();
  if (!s?.roles.includes("admin")) throw new Error("관리자만 감사 편지를 관리할 수 있습니다.");
  if (!isSupabaseAdminConfigured()) throw new Error("SUPABASE_SECRET_KEY가 설정되지 않았습니다.");
  return createAdminSupabaseClient();
}
const knownDistrict = (code: string) => {
  if (!eventConfig.districts.some(([c]) => c === code)) throw new Error("교구를 찾을 수 없습니다.");
};
const missingTables = (msg: string) => /letter/.test(msg) ? "감사 편지 저장소가 아직 없습니다 — Supabase SQL Editor에서 0013 SQL을 실행해 주세요." : msg;

/** A writing link for one district's pastor. Shown once: only its hash is kept. */
export async function createEditorLink(district: string, label: string): Promise<Result<{ url: string }>> {
  return attempt(async () => {
    const db = await adminDb(); knownDistrict(district);
    const token = generatePassToken();
    const { error } = await db.from("letter_editors" as never).insert({ district_code: district, token_hash: await hashPassToken(token), label: label.trim().slice(0, 60) || null } as never);
    if (error) throw new Error(missingTables(error.message));
    return { url: `${WEB_ORIGIN}/letter/write/${token}` };
  });
}

export async function revokeEditorLink(id: string): Promise<Result<void>> {
  return attempt(async () => {
    const db = await adminDb();
    const { error } = await db.from("letter_editors" as never).update({ revoked_at: new Date().toISOString() } as never).eq("id", id);
    if (error) throw new Error(error.message);
  });
}

/** An admin writes or fixes a district's four letters directly (same fields as the pastor's page). */
export async function saveLettersAsAdmin(district: string, input: Record<LetterAudience, string> & { signer: string }): Promise<Result<void>> {
  return attempt(async () => {
    const db = await adminDb(); knownDistrict(district);
    const clean = (s: string, max: number) => String(s ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
    const now = new Date().toISOString(), signer = clean(input.signer, 40);
    const rows = LETTER_AUDIENCES.map((kind) => ({ district_code: district, kind, body: clean(input[kind], LETTER_MAX_CHARS), signer, updated_at: now, updated_via: "admin" }));
    const { error } = await db.from("letters" as never).upsert(rows as never);
    if (error) throw new Error(/check/.test(error.message) ? "편지 종류를 4가지로 나누는 DB 설정이 아직 없습니다 — 0014 SQL을 먼저 실행해 주세요." : missingTables(error.message));
  });
}

// ---------- the STAFF letter (one for everyone; admins only) ----------
const staffCheck = (msg: string) => /check/.test(msg) ? "STAFF 편지를 위한 DB 설정이 아직 없습니다 — Supabase SQL Editor에서 0015 SQL을 실행해 주세요." : missingTables(msg);

/** Save the STAFF letter; `signLine` is the whole signature line (e.g. "2026 온출전 준비위원회 올림"). */
export async function saveStaffLetter(body: string, signLine: string): Promise<Result<void>> {
  return attempt(async () => {
    const db = await adminDb();
    const row = { district_code: STAFF_LETTER.district, kind: STAFF_LETTER.kind, body: String(body ?? "").replace(/\r\n/g, "\n").trim().slice(0, LETTER_MAX_CHARS),
      signer: String(signLine ?? "").trim().slice(0, 80), updated_at: new Date().toISOString(), updated_via: "admin" };
    const { error } = await db.from("letters" as never).upsert(row as never);
    if (error) throw new Error(staffCheck(error.message));
  });
}

/** A one-time upload address for one more STAFF photo (the browser shrinks it to a JPEG first). */
export async function staffPhotoTicket(): Promise<Result<{ signedUrl: string }>> {
  return attempt(async () => {
    const db = await adminDb();
    if ((await listLetterPhotos(STAFF_LETTER.district, STAFF_LETTER.kind)).length >= LETTER_MAX_PHOTOS) throw new Error(`사진은 ${LETTER_MAX_PHOTOS}장까지 붙일 수 있습니다.`);
    const key = `${letterPhotoPrefix(STAFF_LETTER.district, STAFF_LETTER.kind)}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { data, error } = await db.storage.from(OMS_BUCKET).createSignedUploadUrl(key);
    if (error || !data) throw new Error(error?.message ?? "업로드 주소를 만들지 못했습니다.");
    return { signedUrl: data.signedUrl };
  });
}

export async function staffPhotos(): Promise<Result<{ key: string; url: string }[]>> {
  return attempt(async () => { await adminDb(); return listLetterPhotos(STAFF_LETTER.district, STAFF_LETTER.kind); });
}

export async function removeStaffPhoto(key: string): Promise<Result<void>> {
  return attempt(async () => {
    const db = await adminDb();
    if (!/^letters\/ALL\/staff\/[\w.-]+$/.test(key)) throw new Error("잘못된 사진입니다.");
    const { error } = await db.storage.from(OMS_BUCKET).remove([key]);
    if (error) throw new Error(error.message);
  });
}
