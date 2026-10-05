"use server";

import { createAdminSupabaseClient, isSupabaseAdminConfigured, listOms, loadBgm, normalizeBgmSettings, OMS_BUCKET, parseTrackName, photoKey, trackKey, type BgmSettings, type OmsPhoto, type OmsTrack } from "@fil/supabase";
import { getSession } from "@/lib/auth";

const MAX_BYTES = 50 * 1024 * 1024; // the "oms" bucket's file size limit
/** One More Song tracks live under tracks/, the site's background music under bgm/ (same tools for both). */
export type TrackFolder = "tracks" | "bgm";
const KEY_RE = /^(tracks|bgm)\/[A-Za-z0-9._-]+$/;
const folderOf = (key: string): TrackFolder => (key.startsWith("bgm/") ? "bgm" : "tracks");
const listFolder = async (folder: TrackFolder) => (folder === "bgm" ? (await loadBgm()).tracks : (await listOms()).tracks);
const PHOTO_RE = /^photos\/[A-Za-z0-9._-]+$/;

/**
 * The One More Song playlist and photos. Storage writes use the service-role key, so every action
 * re-checks that the CALLER is an admin first (the tab itself is hidden from other roles).
 * Production builds hide the message of an error THROWN from a server action (React #441),
 * so every action returns {ok, data | error} and the console unwraps it.
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
async function attempt<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try { return { ok: true, data: await fn() }; } catch (e) { return { ok: false, error: (e as Error).message }; }
}
async function adminOnly() {
  const s = await getSession();
  if (!s || !s.roles.includes("admin")) throw new Error("관리자만 곡과 사진을 관리할 수 있습니다.");
  if (!isSupabaseAdminConfigured()) throw new Error("SUPABASE_SECRET_KEY가 설정되지 않았습니다.");
  return createAdminSupabaseClient().storage.from(OMS_BUCKET);
}

export async function listTracks(folder: TrackFolder = "tracks"): Promise<Result<OmsTrack[]>> {
  return attempt(async () => { await adminOnly(); return listFolder(folder); });
}

/** One-time signed upload URL; the browser uploads the file itself (no server body limit). New tracks go to the end. */
export async function trackUploadTicket(input: { title: string; artist: string; ext: string; size: number; folder?: TrackFolder }): Promise<Result<{ key: string; token: string }>> {
  return attempt(async () => {
    const bucket = await adminOnly();
    const title = input.title.trim().slice(0, 120);
    if (!title) throw new Error("곡 제목을 적어 주세요.");
    if (input.size > MAX_BYTES) throw new Error("파일이 50MB를 넘습니다.");
    const folder = input.folder ?? "tracks";
    const last = (await listFolder(folder)).reduce((m, t) => Math.max(m, t.order), 0);
    const key = trackKey(last + 1, title, input.artist.slice(0, 120), input.ext, folder);
    const { data, error } = await bucket.createSignedUploadUrl(key);
    if (error || !data) throw new Error(error?.message ?? "업로드 주소를 만들지 못했습니다.");
    return { key, token: data.token };
  });
}

export async function deleteTrack(key: string): Promise<Result<void>> {
  return attempt(async () => {
    const bucket = await adminOnly();
    if (!KEY_RE.test(key)) throw new Error("잘못된 파일입니다.");
    const { error } = await bucket.remove([key]);
    if (error) throw new Error(error.message);
  });
}

/** Rename (title/artist) keeps the file and its place in the list. */
export async function editTrack(key: string, title: string, artist: string): Promise<Result<void>> {
  return attempt(async () => {
    const bucket = await adminOnly();
    if (!KEY_RE.test(key)) throw new Error("잘못된 파일입니다.");
    if (!title.trim()) throw new Error("곡 제목을 적어 주세요.");
    const folder = folderOf(key);
    const cur = parseTrackName(key.slice(folder.length + 1));
    const next = trackKey(cur.order, title.slice(0, 120), artist.slice(0, 120), cur.ext, folder);
    if (next === key) return;
    const { error } = await bucket.move(key, next);
    if (error) throw new Error(error.message);
  });
}

/** Play order = position in `keys` (1, 2, 3…). Two passes so a new number never collides with a file not yet moved. */
export async function reorderTracks(keys: string[]): Promise<Result<void>> {
  return attempt(async () => {
    const bucket = await adminOnly();
    if (!keys.every((k) => KEY_RE.test(k))) throw new Error("잘못된 파일입니다.");
    const folder = folderOf(keys[0] ?? "");
    const moves = keys
      .map((key, i) => { const t = parseTrackName(key.slice(folder.length + 1)); return { key, t, to: trackKey(i + 1, t.title, t.artist, t.ext, folder) }; })
      .filter((m) => m.to !== m.key);
    const parked: { from: string; to: string }[] = [];
    for (const m of moves) {
      const tmp = trackKey(9000 + parked.length, m.t.title, m.t.artist, m.t.ext, folder);
      const { error } = await bucket.move(m.key, tmp);
      if (error) throw new Error(error.message);
      parked.push({ from: tmp, to: m.to });
    }
    for (const p of parked) {
      const { error } = await bucket.move(p.from, p.to);
      if (error) throw new Error(error.message);
    }
  });
}

// ---------- photos (gallery + the player's slideshow, oldest first) ----------
export async function listPhotos(): Promise<Result<OmsPhoto[]>> {
  return attempt(async () => { await adminOnly(); return (await listOms()).photos; });
}

/** The browser shrinks the photo to a JPEG first, then uploads it straight to storage with this ticket. */
export async function photoUploadTicket(size: number): Promise<Result<{ key: string; token: string }>> {
  return attempt(async () => {
    const bucket = await adminOnly();
    if (size > MAX_BYTES) throw new Error("파일이 50MB를 넘습니다.");
    const key = photoKey();
    const { data, error } = await bucket.createSignedUploadUrl(key);
    if (error || !data) throw new Error(error?.message ?? "업로드 주소를 만들지 못했습니다.");
    return { key, token: data.token };
  });
}

export async function deletePhotos(keys: string[]): Promise<Result<void>> {
  return attempt(async () => {
    const bucket = await adminOnly();
    if (!keys.length || !keys.every((k) => PHOTO_RE.test(k))) throw new Error("잘못된 파일입니다.");
    const { error } = await bucket.remove(keys);
    if (error) throw new Error(error.message);
  });
}

// ---------- background music settings (event_config key "bgm") ----------
export async function saveBgmSettings(input: BgmSettings): Promise<Result<BgmSettings>> {
  return attempt(async () => {
    await adminOnly();
    const value = normalizeBgmSettings(input);
    const { error } = await createAdminSupabaseClient().from("event_config" as never).upsert({ key: "bgm", value, updated_at: new Date().toISOString() } as never);
    if (error) throw new Error(error.message);
    return value;
  });
}
