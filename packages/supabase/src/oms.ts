import { createAdminSupabaseClient } from "./client";
import { isSupabaseAdminConfigured } from "./env";

/**
 * The One More Song store, shared by the web site (player, photo page) and the ops app (track tab):
 * Supabase Storage bucket "oms" (public read).
 *   tracks/<order>-<b64url({t,a})>.<ext>   — the title/artist live in the key (storage keys must be ASCII)
 *   photos/<timestamp>-<rand>.jpg           — resized in the browser before upload
 * Writes always go through a server that has checked the caller is an admin; reads are public URLs.
 * listOms / the key helpers that touch storage are server only (service-role key).
 */
export const OMS_BUCKET = "oms";
export type OmsTrack = { key: string; order: number; title: string; artist: string; url: string };
export type OmsPhoto = { key: string; url: string };

// base64url without padding (same bytes as Node's Buffer "base64url"), usable in both runtimes
const b64url = (s: string) => {
  let bin = ""; new TextEncoder().encode(s).forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

export function trackKey(order: number, title: string, artist: string, ext: string): string {
  const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "mp3";
  const n = Math.max(0, Math.min(9999, Math.round(order)));
  // NFC: macOS file names arrive as decomposed Hangul (ㅇ+ㅣ…), which some phones draw as loose letters
  return `tracks/${String(n).padStart(4, "0")}-${b64url(JSON.stringify({ t: title.trim().normalize("NFC"), a: artist.trim().normalize("NFC") }))}.${safeExt}`;
}
export function photoKey(): string {
  return `photos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
}
/** "0003-<b64>.mp3" → {order: 3, title, artist, ext} */
export function parseTrackName(name: string): { order: number; title: string; artist: string; ext: string } {
  const ext = name.match(/\.([a-z0-9]+)$/i)?.[1] ?? "mp3";
  const m = name.match(/^(\d+)-([A-Za-z0-9_-]+)\.[a-z0-9]+$/i);
  if (m) {
    try { const j = JSON.parse(unb64url(m[2])); return { order: Number(m[1]), title: String(j.t || "Untitled").normalize("NFC"), artist: String(j.a || "").normalize("NFC"), ext }; } catch { /* fall through */ }
  }
  return { order: Number(name.match(/^(\d+)/)?.[1] ?? 0), title: name.replace(/\.[^.]+$/, ""), artist: "", ext };
}

/** Server only. Tracks in play order, photos oldest first, with public URLs. */
export async function listOms(): Promise<{ tracks: OmsTrack[]; photos: OmsPhoto[] }> {
  if (!isSupabaseAdminConfigured()) return { tracks: [], photos: [] };
  const bucket = createAdminSupabaseClient().storage.from(OMS_BUCKET);
  const [t, p] = await Promise.all([
    bucket.list("tracks", { limit: 500, sortBy: { column: "name", order: "asc" } }),
    bucket.list("photos", { limit: 1000, sortBy: { column: "name", order: "asc" } }),
  ]);
  const real = (rows: { name: string; id: string | null }[] | null) => (rows ?? []).filter((o) => o.id && !o.name.startsWith("."));
  const tracks = real(t.data).map((o) => {
    const { order, title, artist } = parseTrackName(o.name);
    return { key: `tracks/${o.name}`, order, title, artist, url: bucket.getPublicUrl(`tracks/${o.name}`).data.publicUrl };
  });
  const photos = real(p.data).map((o) => ({ key: `photos/${o.name}`, url: bucket.getPublicUrl(`photos/${o.name}`).data.publicUrl }));
  return { tracks, photos };
}
