import { createAdminSupabaseClient } from "./client";
import { isSupabaseAdminConfigured } from "./env";
import { OMS_BUCKET, parseTrackName, type OmsTrack } from "./oms";

/**
 * Background music for the web site. Files live in the public "oms" bucket under bgm/ (same key format
 * as the One More Song tracks: bgm/<order>-<b64url({t,a})>.<ext>); the settings are one row in
 * event_config (key "bgm"). Admins manage both in ops; the web reads them through /api/bgm.
 */
export const BGM_FOLDER = "bgm" as const;
export type BgmSettings = {
  /** play background music on the site at all */
  enabled: boolean;
  /** 0–1, the level a first-time visitor starts at */
  volume: number;
  /** start with the visitor's first tap / click (browsers never allow sound before that) */
  autostart: boolean;
  /** play the list in random order instead of top to bottom */
  shuffle: boolean;
};
export const BGM_DEFAULTS: BgmSettings = { enabled: true, volume: 0.35, autostart: true, shuffle: false };

export function normalizeBgmSettings(v: unknown): BgmSettings {
  const o = (v && typeof v === "object" ? v : {}) as Partial<BgmSettings>;
  const vol = Number(o.volume);
  return {
    enabled: typeof o.enabled === "boolean" ? o.enabled : BGM_DEFAULTS.enabled,
    volume: Number.isFinite(vol) ? Math.max(0, Math.min(1, vol)) : BGM_DEFAULTS.volume,
    autostart: typeof o.autostart === "boolean" ? o.autostart : BGM_DEFAULTS.autostart,
    shuffle: typeof o.shuffle === "boolean" ? o.shuffle : BGM_DEFAULTS.shuffle,
  };
}

/** Server only. Settings + tracks in play order with public URLs. */
export async function loadBgm(): Promise<{ settings: BgmSettings; tracks: OmsTrack[] }> {
  if (!isSupabaseAdminConfigured()) return { settings: BGM_DEFAULTS, tracks: [] };
  const db = createAdminSupabaseClient();
  const bucket = db.storage.from(OMS_BUCKET);
  const [{ data: cfg }, { data: files }] = await Promise.all([
    // event_config is not in the generated types (a plain key/value table)
    (db.from("event_config" as never).select("value").eq("key", "bgm").maybeSingle() as unknown as Promise<{ data: { value: unknown } | null }>),
    bucket.list(BGM_FOLDER, { limit: 200, sortBy: { column: "name", order: "asc" } }),
  ]);
  const tracks = (files ?? []).filter((o) => o.id && !o.name.startsWith(".")).map((o) => {
    const { order, title, artist } = parseTrackName(o.name);
    return { key: `${BGM_FOLDER}/${o.name}`, order, title, artist, url: bucket.getPublicUrl(`${BGM_FOLDER}/${o.name}`).data.publicUrl };
  });
  return { settings: normalizeBgmSettings(cfg?.value), tracks };
}
