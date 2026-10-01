"use server";

import { createAdminSupabaseClient, isSupabaseAdminConfigured, listOms, OMS_BUCKET, parseTrackName, trackKey, type OmsTrack } from "@fil/supabase";
import { getSession } from "@/lib/auth";

const MAX_BYTES = 50 * 1024 * 1024; // the "oms" bucket's file size limit
const KEY_RE = /^tracks\/[A-Za-z0-9._-]+$/;

/**
 * The One More Song playlist. Storage writes use the service-role key, so every action
 * re-checks that the CALLER is an admin first (the tab itself is hidden from other roles).
 */
async function adminOnly() {
  const s = await getSession();
  if (!s || !s.roles.includes("admin")) throw new Error("관리자만 곡을 관리할 수 있습니다.");
  if (!isSupabaseAdminConfigured()) throw new Error("SUPABASE_SECRET_KEY가 설정되지 않았습니다.");
  return createAdminSupabaseClient().storage.from(OMS_BUCKET);
}

export async function listTracks(): Promise<OmsTrack[]> {
  await adminOnly();
  return (await listOms()).tracks;
}

/** One-time signed upload URL; the browser uploads the file itself (no server body limit). New tracks go to the end. */
export async function trackUploadTicket(input: { title: string; artist: string; ext: string; size: number }): Promise<{ key: string; token: string }> {
  const bucket = await adminOnly();
  const title = input.title.trim().slice(0, 120);
  if (!title) throw new Error("곡 제목을 적어 주세요.");
  if (input.size > MAX_BYTES) throw new Error("파일이 50MB를 넘습니다.");
  const last = (await listOms()).tracks.reduce((m, t) => Math.max(m, t.order), 0);
  const key = trackKey(last + 1, title, input.artist.slice(0, 120), input.ext);
  const { data, error } = await bucket.createSignedUploadUrl(key);
  if (error || !data) throw new Error(error?.message ?? "업로드 주소를 만들지 못했습니다.");
  return { key, token: data.token };
}

export async function deleteTrack(key: string): Promise<void> {
  const bucket = await adminOnly();
  if (!KEY_RE.test(key)) throw new Error("잘못된 파일입니다.");
  const { error } = await bucket.remove([key]);
  if (error) throw new Error(error.message);
}

/** Rename (title/artist) keeps the file and its place in the list. */
export async function editTrack(key: string, title: string, artist: string): Promise<void> {
  const bucket = await adminOnly();
  if (!KEY_RE.test(key)) throw new Error("잘못된 파일입니다.");
  if (!title.trim()) throw new Error("곡 제목을 적어 주세요.");
  const cur = parseTrackName(key.slice("tracks/".length));
  const next = trackKey(cur.order, title.slice(0, 120), artist.slice(0, 120), cur.ext);
  if (next === key) return;
  const { error } = await bucket.move(key, next);
  if (error) throw new Error(error.message);
}

/** Play order = position in `keys` (1, 2, 3…). Two passes so a new number never collides with a file not yet moved. */
export async function reorderTracks(keys: string[]): Promise<void> {
  const bucket = await adminOnly();
  if (!keys.every((k) => KEY_RE.test(k))) throw new Error("잘못된 파일입니다.");
  const moves = keys
    .map((key, i) => { const t = parseTrackName(key.slice("tracks/".length)); return { key, t, to: trackKey(i + 1, t.title, t.artist, t.ext) }; })
    .filter((m) => m.to !== m.key);
  const parked: { from: string; to: string }[] = [];
  for (const m of moves) {
    const tmp = trackKey(9000 + parked.length, m.t.title, m.t.artist, m.t.ext);
    const { error } = await bucket.move(m.key, tmp);
    if (error) throw new Error(error.message);
    parked.push({ from: tmp, to: m.to });
  }
  for (const p of parked) {
    const { error } = await bucket.move(p.from, p.to);
    if (error) throw new Error(error.message);
  }
}
