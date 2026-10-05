"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Track = { key: string; title: string; artist: string; url: string };
type Settings = { enabled: boolean; volume: number; autostart: boolean; shuffle: boolean };
type Pref = { off?: boolean; vol?: number };

const PREF_KEY = "fil.bgm";          // per device: turned off? own volume
const POS_KEY = "fil.bgm.pos";       // per tab session: where the music was (resume after a reload)
const readPref = (): Pref => { try { return JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}"); } catch { return {}; } };
const writePref = (p: Pref) => { try { localStorage.setItem(PREF_KEY, JSON.stringify({ ...readPref(), ...p })); } catch { /* private mode */ } };
/** iPhone/iPad ignore audio.volume: there the level goes through a Web Audio gain node (created on the first tap). */
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const shuffled = (n: number) => { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/**
 * Site background music (settings and tracks from ops → /api/bgm). With "autostart" it first tries to play
 * right away — a few browsers allow that (Chrome for sites a visitor often plays media on, Safari set to
 * "allow all auto-play") — and when the browser refuses, as most do until the visitor has interacted,
 * it starts on the first tap/click/key instead. Without autostart it waits for the button.
 * A visitor who turns it off stays off on this device. It lives in the root layout (keeps playing across
 * pages), pauses while the tab is hidden, and steps aside on /one-more-song, which has its own player.
 */
export function BgmPlayer() {
  const path = usePathname() ?? "/";
  const audio = useRef<HTMLAudioElement>(null);
  const gain = useRef<{ ctx: AudioContext; node: GainNode } | null>(null);
  const [data, setData] = useState<{ settings: Settings; tracks: Track[] } | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [pos, setPos] = useState(0);              // index into order
  const [playing, setPlaying] = useState(false);
  const [vol, setVol] = useState(0.35);
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(false);
  const away = path.startsWith("/one-more-song");
  const track = data && order.length ? data.tracks[order[pos % order.length]] : null;

  useEffect(() => {
    fetch("/api/bgm").then((r) => r.json()).then((d: { settings: Settings; tracks: Track[] }) => {
      if (!d.settings?.enabled || !d.tracks?.length) return;
      setData(d);
      const o = d.settings.shuffle ? shuffled(d.tracks.length) : [...d.tracks.keys()];
      setOrder(o);
      const pref = readPref();
      setVol(typeof pref.vol === "number" ? pref.vol : d.settings.volume);
      try { const saved = JSON.parse(sessionStorage.getItem(POS_KEY) ?? "null") as { key: string; t: number } | null;
        if (saved) { const i = o.findIndex((k) => d.tracks[k].key === saved.key); if (i >= 0) { setPos(i); resumeAt.current = saved.t; } } } catch { /* ignore */ }
    }).catch(() => {});
  }, []);
  const resumeAt = useRef(0);
  const loaded = useRef<string | null>(null);   // key of the track currently in the <audio>
  const load = (t: Track) => {
    const a = audio.current; if (!a) return;
    a.src = t.url; loaded.current = t.key;
    const at = resumeAt.current; resumeAt.current = 0;
    if (at) a.addEventListener("loadedmetadata", () => { a.currentTime = Math.min(at, Math.max(0, a.duration - 1)); }, { once: true });
  };

  // level: element volume, or the gain node on iOS
  useEffect(() => {
    const a = audio.current; if (!a) return;
    if (gain.current) { a.volume = 1; gain.current.node.gain.value = vol; } else a.volume = vol;
  }, [vol, data]);

  const wireGain = () => {
    const a = audio.current; if (!a || gain.current || !isIOS()) return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx(); const node = ctx.createGain(); node.gain.value = vol;
      ctx.createMediaElementSource(a).connect(node).connect(ctx.destination); a.volume = 1;
      gain.current = { ctx, node };
    } catch { /* fall back to the element */ }
  };
  /** Resolves true only when sound is really coming out (on iOS that also needs the gain context running). */
  const play = (): Promise<boolean> => {
    const a = audio.current; if (!a || !track) return Promise.resolve(false);
    wireGain();
    const g = gain.current;
    const ctxReady = g ? g.ctx.resume().then(() => g.ctx.state === "running").catch(() => false) : Promise.resolve(true);
    if (loaded.current !== track.key) load(track);
    return a.play()
      .then(async () => { setPlaying(true); setHint(false); return ctxReady; })
      .catch(() => { setPlaying(false); return false; });
  };
  const pause = () => { audio.current?.pause(); setPlaying(false); };
  const toggle = () => { if (playing) { pause(); writePref({ off: true }); } else { writePref({ off: false }); play(); } };
  const next = () => {
    const a = audio.current; if (!a || !data) return;
    const n = (pos + 1) % order.length; setPos(n);
    load(data.tracks[order[n]]); a.play().then(() => setPlaying(true)).catch(() => {});
  };

  // autostart: try at once; if the browser says no, the first tap / click / key anywhere starts it
  useEffect(() => {
    if (!data || away || !data.settings.autostart || readPref().off) return;
    let done = false, t = 0;
    // only events a browser counts as the visitor's go-ahead for sound: a mouse press, a finger lifting
    // (pointerup/touchend — a finger going *down* does not count on phones), a click, a key
    const evs = ["pointerdown", "pointerup", "touchend", "click", "keydown"] as const;
    const start = (e: Event) => {
      if ((e.target as Element | null)?.closest?.(".bgm")) return;
      const pt = (e as PointerEvent).pointerType;
      if (e.type === "pointerdown" && pt && pt !== "mouse") return;
      if (e.type === "pointerup" && pt === "mouse") return;
      // stop listening only once sound is confirmed; a refused or silent start waits for the next tap
      play().then((ok) => { if (ok) off(); });
    };
    const off = () => { done = true; clearTimeout(t); evs.forEach((ev) => window.removeEventListener(ev, start, true)); };
    const a = audio.current;
    if (a && track) {
      if (loaded.current !== track.key) load(track);
      a.play().then(() => { setPlaying(true); off(); }).catch(() => {
        if (done) return;
        setHint(true); t = window.setTimeout(() => setHint(false), 7000);
        evs.forEach((ev) => window.addEventListener(ev, start, { capture: true }));
      });
    }
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, away]);

  // step aside on the One More Song pages; pause in a hidden tab and pick up again on return
  const wasPlaying = useRef(false);
  useEffect(() => { if (away && playing) { wasPlaying.current = false; pause(); } }, [away]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) { wasPlaying.current = playing; if (playing) pause(); }
      else if (wasPlaying.current && !away) play();
    };
    const save = () => { const a = audio.current; if (a && track) try { sessionStorage.setItem(POS_KEY, JSON.stringify({ key: track.key, t: a.currentTime })); } catch { /* ignore */ } };
    document.addEventListener("visibilitychange", onVis); window.addEventListener("pagehide", save);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("pagehide", save); };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return null;
  return (
    <div className={`bgm ${playing ? "on" : ""} ${open ? "open" : ""} ${away ? "away" : ""}`} role="region" aria-label="배경음악">
      <audio ref={audio} preload="none" crossOrigin="anonymous" onEnded={next} />
      <button type="button" className="bgmToggle" onClick={toggle} aria-pressed={playing} aria-label={playing ? "배경음악 끄기" : "배경음악 켜기"} title={playing ? "배경음악 끄기" : "배경음악 켜기"}>
        {playing ? <i className="bars" aria-hidden="true"><b /><b /><b /><b /></i>
          : <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><path d="M10 3v10.55A4 4 0 1 0 12 17V7h6V3h-8z" /></svg>}
      </button>
      {hint && !playing && <span className="bgmHint">화면을 누르면 배경음악이 시작됩니다</span>}
      <button type="button" className="bgmMore" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="배경음악 설정">{open ? "×" : "···"}</button>
      {open && (
        <div className="bgmPanel">
          <small>BGM</small>
          <b title={track?.title}>{track?.title ?? ""}</b>
          {track?.artist && <span>{track.artist}</span>}
          <div className="bgmCtl">
            <button type="button" onClick={toggle}>{playing ? "일시정지" : "재생"}</button>
            {order.length > 1 && <button type="button" onClick={next}>다음 곡</button>}
          </div>
          <label className="bgmVolume"><span>볼륨</span>
            <input type="range" min={0} max={1} step={0.05} value={vol} onChange={(e) => { const v = Number(e.target.value); setVol(v); writePref({ vol: v }); }} aria-label="배경음악 볼륨" />
          </label>
        </div>
      )}
    </div>
  );
}
