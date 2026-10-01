// Server only: uses the service-role key. Import it from route handlers and server components, never from "use client" files.
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@fil/supabase";

/**
 * The One More Song store: Supabase Storage bucket "oms" (public read).
 *   tracks/<order>-<b64url({t,a})>.<ext>   — the title/artist live in the key (storage keys must be ASCII)
 *   photos/<timestamp>-<rand>.jpg           — resized in the browser before upload
 * Writes go through /api/oms/* with an admin's session token; reads are public URLs.
 */
export const OMS_BUCKET = "oms";
export type OmsTrack = { key: string; title: string; artist: string; url: string };
export type OmsPhoto = { key: string; url: string };

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64url = (s: string) => Buffer.from(s, "base64url").toString("utf8");

export function trackKey(order: number, title: string, artist: string, ext: string): string {
  const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "mp3";
  return `tracks/${String(order).padStart(4, "0")}-${b64url(JSON.stringify({ t: title.trim(), a: artist.trim() }))}.${safeExt}`;
}
export function photoKey(): string {
  return `photos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
}
function parseTrack(name: string): { title: string; artist: string } {
  const m = name.match(/^\d+-([A-Za-z0-9_-]+)\.[a-z0-9]+$/);
  if (m) { try { const j = JSON.parse(unb64url(m[1])); return { title: String(j.t || "Untitled"), artist: String(j.a || "") }; } catch { /* fall through */ } }
  return { title: name.replace(/\.[^.]+$/, ""), artist: "" };
}

export async function listOms(): Promise<{ tracks: OmsTrack[]; photos: OmsPhoto[] }> {
  if (!isSupabaseAdminConfigured()) return { tracks: [], photos: [] };
  const db = createAdminSupabaseClient(); const bucket = db.storage.from(OMS_BUCKET);
  const [t, p] = await Promise.all([
    bucket.list("tracks", { limit: 500, sortBy: { column: "name", order: "asc" } }),
    bucket.list("photos", { limit: 1000, sortBy: { column: "name", order: "asc" } }),
  ]);
  const real = (rows: { name: string; id: string | null }[] | null) => (rows ?? []).filter((o) => o.id && !o.name.startsWith("."));
  const tracks = real(t.data).map((o) => ({ key: `tracks/${o.name}`, url: bucket.getPublicUrl(`tracks/${o.name}`).data.publicUrl, ...parseTrack(o.name) }));
  const photos = real(p.data).map((o) => ({ key: `photos/${o.name}`, url: bucket.getPublicUrl(`photos/${o.name}`).data.publicUrl }));
  return { tracks, photos };
}

/** The caller is a signed-in ops admin (Bearer token from the browser session)? */
export async function isAdminToken(authHeader: string | null): Promise<boolean> {
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || !isSupabaseAdminConfigured()) return false;
  const db = createAdminSupabaseClient();
  const { data } = await db.auth.getUser(token);
  if (!data.user) return false;
  const { data: roles } = await db.from("staff_roles").select("role").eq("profile_id", data.user.id).eq("role", "admin");
  return !!roles?.length;
}
