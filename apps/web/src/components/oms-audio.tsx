"use client";

import type React from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type PlayerTrack = { key: string; title: string; artist: string; url: string };
export type Repeat = "all" | "one" | "off";

const COVER = [{ src: "/media/oms-cover.jpg", sizes: "512x512", type: "image/jpeg" }];
const VOLUME_KEY = "fil.oms.volume";
/**
 * iPhone/iPad accept audio.volume (it even reads back) but never apply it, so there the level goes
 * through a Web Audio gain node instead. That routing is only switched on once someone actually
 * lowers the level, so at 100% iOS keeps its plain, background-safe <audio> path.
 */
function isIOS() { return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
export const fmt = (s: number) => (Number.isFinite(s) && s >= 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

type Ctx = {
  tracks: PlayerTrack[]; track: PlayerTrack | undefined; idx: number; playing: boolean; repeat: Repeat; time: number; dur: number;
  volume: number; muted: boolean;
  playAt: (i: number) => void; toggle: () => void; next: () => void; prev: () => void; cycleRepeat: () => void;
  seek: (t: number) => void; setVolume: (v: number) => void; toggleMute: () => void;
};
const OmsAudioCtx = createContext<Ctx | null>(null);
export function useOmsAudio(): Ctx {
  const c = useContext(OmsAudioCtx);
  if (!c) throw new Error("useOmsAudio needs <OmsAudioProvider>");
  return c;
}

/* small inline icons (currentColor) */
export const I = {
  play: <path d="M8 5v14l11-7z" />,
  pause: <path d="M7 5h4v14H7zM13 5h4v14h-4z" />,
  prev: <path d="M7 6h2v12H7zM10 12l9-6v12z" />,
  next: <path d="M15 6h2v12h-2zM14 12 5 6v12z" />,
  stop: <path d="M7 7h10v10H7z" />,
  repeat: <path d="M7 7h9l-2-2 1.4-1.4L20 8l-4.6 4.4L14 11l2-2H7v4H5V9a2 2 0 0 1 2-2zm10 10H8l2 2-1.4 1.4L4 16l4.6-4.4L10 13l-2 2h9v-4h2v4a2 2 0 0 1-2 2z" />,
  list: <path d="M4 6h12v2H4zM4 11h12v2H4zM4 16h8v2H4zM18 13v-7h3v2h-1v8.5a2.5 2.5 0 1 1-2-2.45z" />,
  full: <path d="M4 4h6v2H6v4H4zM14 4h6v6h-2V6h-4zM4 14h2v4h4v2H4zM18 14h2v6h-6v-2h4z" />,
  exit: <path d="M8 4h2v6H4V8h4zM14 4h2v4h4v2h-6zM4 14h6v6H8v-4H4zM14 14h6v2h-4v4h-2z" />,
  photo: <path d="M4 5h16v14H4zM6 17h12l-4-5-3 3.5-2-2.5zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />,
  vol: <path d="M4 9h4l5-4v14l-5-4H4zM15.5 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2zM18.4 5.6a9 9 0 0 1 0 12.8L17 17a7 7 0 0 0 0-9.9z" />,
  volLow: <path d="M4 9h4l5-4v14l-5-4H4zM15.5 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2z" />,
  mute: <path d="M4 9h4l5-4v14l-5-4H4zM15.3 9.7l1.4-1.4L19 10.6l2.3-2.3 1.4 1.4-2.3 2.3 2.3 2.3-1.4 1.4-2.3-2.3-2.3 2.3-1.4-1.4 2.3-2.3z" />,
};
export const Icon = ({ d }: { d: React.ReactNode }) => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">{d}</svg>;

/**
 * One <audio> element for every One More Song page. It lives in the /one-more-song layout, so the
 * music keeps playing from the player into the photo page (where a mini bar takes over).
 * Background play: a plain <audio> keeps going with the screen off or another app in front; the
 * Media Session API puts the track, cover and controls on the lock screen / notification shade,
 * and the next track starts from the `ended` handler, so the playlist carries on.
 */
export function OmsAudioProvider({ tracks, children }: { tracks: PlayerTrack[]; children: React.ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>("all");
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [volume, setVol] = useState(1);
  const [muted, setMuted] = useState(false);
  const graph = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);
  const volumeRef = useRef(1); volumeRef.current = volume;
  const track = tracks[idx];

  /** iOS only, and only from a tap (iOS keeps a context started outside one silent): route the element through a gain node, once. */
  const ensureGain = useCallback(() => {
    const a = audio.current; if (!a || !isIOS()) return null;
    if (!graph.current) {
      try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx(); const gain = ctx.createGain();
        ctx.createMediaElementSource(a).connect(gain).connect(ctx.destination);
        gain.gain.value = volumeRef.current; a.volume = 1;
        // iOS 17+: treat this as media playback (keeps going with the ringer off / screen locked)
        const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
        if (session) session.type = "playback";
        graph.current = { ctx, gain };
      } catch { return null; }
    }
    if (graph.current.ctx.state !== "running") graph.current.ctx.resume().catch(() => {});
    return graph.current;
  }, []);
  const wake = () => { const g = graph.current; if (g && g.ctx.state !== "running") g.ctx.resume().catch(() => {}); };
  /** Start of every tap that plays: wake the gain path, or switch to it when a lowered level was remembered. */
  const tap = () => { if (graph.current) wake(); else if (volumeRef.current < 1) ensureGain(); };

  const playAt = useCallback((i: number) => {
    setIdx(i); setTime(0);
    const a = audio.current; if (!a || !tracks[i]) return;
    a.src = tracks[i].url; a.load();
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [tracks]);
  const toggle = () => {
    const a = audio.current; if (!a || !track) return;
    tap();
    if (!a.src) { playAt(idx); return; }
    if (a.paused) a.play().then(() => setPlaying(true)).catch(() => {}); else { a.pause(); setPlaying(false); }
  };
  const advance = useCallback((auto: boolean) => {
    if (!tracks.length) return;
    if (auto && repeat === "one") { const a = audio.current; if (a) { a.currentTime = 0; a.play().catch(() => {}); } return; }
    const last = idx >= tracks.length - 1;
    if (auto && last && repeat === "off") { setPlaying(false); return; }
    playAt(last ? 0 : idx + 1);
  }, [tracks.length, repeat, idx, playAt]);
  const next = () => { tap(); advance(false); };
  const pick = (i: number) => { tap(); playAt(i); };
  const prev = () => {
    const a = audio.current; if (!tracks.length) return;
    tap();
    if (a && a.currentTime > 3) { a.currentTime = 0; return; }
    playAt(idx === 0 ? tracks.length - 1 : idx - 1);
  };
  const cycleRepeat = () => setRepeat((r) => (r === "all" ? "one" : r === "one" ? "off" : "all"));
  const seek = (t: number) => { const a = audio.current; if (a) { a.currentTime = t; setTime(t); } };
  const setVolume = (v: number) => {
    const n = Math.max(0, Math.min(1, v)); setVol(n); setMuted(n === 0);
    if (n < 1 || graph.current) { const g = ensureGain(); if (g) g.gain.gain.value = n; }
    try { localStorage.setItem(VOLUME_KEY, String(n)); } catch { /* private mode */ }
  };
  const toggleMute = () => { if (muted && volume === 0) setVolume(0.6); else setMuted(!muted); };

  // remembered volume (per device)
  useEffect(() => {
    try { const v = Number(localStorage.getItem(VOLUME_KEY)); if (localStorage.getItem(VOLUME_KEY) !== null && Number.isFinite(v)) { setVol(v); setMuted(v === 0); } } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    const a = audio.current; if (!a) return;
    a.muted = muted;
    const g = graph.current;
    if (g) { a.volume = 1; g.gain.gain.value = volume; } else a.volume = volume;
  }, [volume, muted]);

  useEffect(() => {
    const a = audio.current; if (!a) return;
    const onTime = () => setTime(a.currentTime);
    const onMeta = () => setDur(a.duration);
    const onEnd = () => advance(true);
    const onPause = () => setPlaying(false);
    const onPlay = () => { setPlaying(true); wake(); };
    a.addEventListener("timeupdate", onTime); a.addEventListener("loadedmetadata", onMeta); a.addEventListener("ended", onEnd);
    a.addEventListener("pause", onPause); a.addEventListener("play", onPlay);
    return () => { a.removeEventListener("timeupdate", onTime); a.removeEventListener("loadedmetadata", onMeta); a.removeEventListener("ended", onEnd); a.removeEventListener("pause", onPause); a.removeEventListener("play", onPlay); };
  }, [advance]);
  // back from the lock screen / another app: an interrupted context must be resumed
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") wake(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // lock-screen / notification / headset controls where supported
  useEffect(() => {
    if (!("mediaSession" in navigator) || !track) return;
    const ms = navigator.mediaSession;
    ms.metadata = new MediaMetadata({ title: track.title, artist: track.artist || "FALLing in Love", album: "THE ONE MORE SONG", artwork: COVER });
    const on = (action: MediaSessionAction, fn: MediaSessionActionHandler) => { try { ms.setActionHandler(action, fn); } catch { /* unsupported action */ } };
    const seekBy = (d: number) => { const a = audio.current; if (a) a.currentTime = Math.max(0, Math.min(a.duration || 0, a.currentTime + d)); };
    on("play", () => { audio.current?.play().catch(() => {}); });
    on("pause", () => audio.current?.pause());
    on("stop", () => { const a = audio.current; if (a) { a.pause(); a.currentTime = 0; } });
    on("nexttrack", () => advance(false));
    on("previoustrack", () => prev());
    on("seekbackward", (d) => seekBy(-(d.seekOffset ?? 10)));
    on("seekforward", (d) => seekBy(d.seekOffset ?? 10));
    on("seekto", (d) => { const a = audio.current; if (a && d.seekTime != null) a.currentTime = d.seekTime; });
  });
  useEffect(() => {
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }, [playing]);
  // lock-screen progress bar (refreshed when the track loads and every few seconds while playing)
  const posAt = useRef(0);
  useEffect(() => {
    if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState || !dur) return;
    if (Math.abs(time - posAt.current) < 4 && time > 0.5) return;
    posAt.current = time;
    try { navigator.mediaSession.setPositionState({ duration: dur, position: Math.min(time, dur), playbackRate: 1 }); } catch { /* ignore */ }
  }, [time, dur]);

  const value: Ctx = { tracks, track, idx, playing, repeat, time, dur, volume, muted, playAt: pick, toggle, next, prev, cycleRepeat, seek, setVolume, toggleMute };
  return (
    <OmsAudioCtx.Provider value={value}>
      {/* crossOrigin: required for the iOS gain node (storage answers with Access-Control-Allow-Origin: *) */}
      <audio ref={audio} preload="metadata" crossOrigin="anonymous" />
      {children}
      <OmsMiniBar />
    </OmsAudioCtx.Provider>
  );
}

/** Speaker button (mute) + slider. */
export function OmsVolume({ compact = false }: { compact?: boolean }) {
  const { volume, muted, setVolume, toggleMute } = useOmsAudio();
  const level = muted ? 0 : volume;
  return (
    <div className={`omsVolume ${compact ? "compact" : ""}`}>
      <button type="button" onClick={toggleMute} aria-label={muted ? "소리 켜기" : "음소거"} aria-pressed={muted}><Icon d={level === 0 ? I.mute : level < 0.5 ? I.volLow : I.vol} /></button>
      <input type="range" min={0} max={1} step={0.01} value={level} onChange={(e) => setVolume(Number(e.target.value))}
        style={{ "--pct": `${level * 100}%` } as React.CSSProperties} aria-label="볼륨" />
    </div>
  );
}

/** Bottom bar on the other One More Song pages (photos): the song keeps going while people browse. */
function OmsMiniBar() {
  const path = usePathname();
  const { tracks, track, idx, playing, time, dur, toggle, next, prev } = useOmsAudio();
  if (path === "/one-more-song" || !tracks.length || !track) return null;
  const pct = dur ? Math.min(100, (time / dur) * 100) : 0;
  return (
    <div className="omsMini" role="region" aria-label="미니 플레이어">
      <i className="omsMiniProgress" style={{ width: `${pct}%` }} />
      <span className={`omsMiniDisc ${playing ? "on" : ""}`} aria-hidden="true" />
      <Link href="/one-more-song" className="omsMiniNow" title="플레이어로 가기">
        <small>TRACK {String(idx + 1).padStart(2, "0")} · {fmt(time)}</small>
        <b>{track.title}</b>
        {track.artist && <span>{track.artist}</span>}
      </Link>
      <div className="omsMiniCtl">
        <button type="button" onClick={prev} aria-label="이전 곡"><Icon d={I.prev} /></button>
        <button type="button" className="omsPlay" onClick={toggle} aria-label={playing ? "일시정지" : "재생"}><Icon d={playing ? I.pause : I.play} /></button>
        <button type="button" onClick={next} aria-label="다음 곡"><Icon d={I.next} /></button>
      </div>
      <OmsVolume compact />
    </div>
  );
}
