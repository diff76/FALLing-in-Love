export type StaffRole = "staff" | "desk" | "admin";
export type ReservationKind = "host" | "guest_self";
export type TransportKind = "shuttle" | "car" | "other";
export type CheckinMethod = "qr" | "manual";

export type SceneId =
  | "opening-track"
  | "landing"
  | "ascent"
  | "garden"
  | "trail"
  | "chamber"
  | "finale"
  | "one-more-song";

export const SCENE_ORDER: readonly SceneId[] = [
  "opening-track", "landing", "ascent", "garden", "trail", "chamber", "finale", "one-more-song",
];

export type CameraMode = "approach" | "dive" | "pause" | "pull-out" | "travel" | "discover";

/** Centralised, replaceable scene definition. Media paths never live in components. */
export type CinematicScene = {
  id: SceneId;
  label: string;
  eyebrow: string;
  title: string;
  body: string;
  tags?: string[];
  accent: string;
  camera: CameraMode;
  /** engine pacing: viewport-heights of scroll for this scene, and mid-scene settle 0..0.6 */
  scroll?: number;
  linger?: number;
  media: {
    poster: string;
    posterMobile?: string;
    posterAlt: string;
    /** filled from media/manifest.json once clips exist */
    clip?: string | null;
    clipMobile?: string | null;
  };
};
