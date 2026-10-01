"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Vinyl } from "./vinyl";

export type PlayerTrack = { key: string; title: string; artist: string; url: string };
export type PlayerPhoto = { key: string; url: string };
type Repeat = "all" | "one" | "off";
type Slides = "play" | "pause" | "stop";

const SLIDE_MS = 5000;
const fmt = (s: number) => (Number.isFinite(s) && s >= 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

/* small inline icons (currentColor) */
const I = {
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
};
const Icon = ({ d, label }: { d: React.ReactNode; label?: string }) => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label}>{d}</svg>;

/**
 * OMS Player (One More Song Player): the day's playlist with prev/next/play/pause, repeat
 * (all · one · off), a seekable progress bar, the full track list, and a photo slideshow
 * (play · pause · stop — stopped shows the spinning record with the site lockup).
 * Fullscreen uses the Fullscreen API, or a fixed overlay where it is unavailable (iPhone).
 */
export function OmsPlayer({ tracks, photos }: { tracks: PlayerTrack[]; photos: PlayerPhoto[] }) {
  const audio = useRef<HTMLAudioElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>("all");
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [showList, setShowList] = useState(false);
  const [slides, setSlides] = useState<Slides>(photos.length ? "play" : "stop");
  const [slide, setSlide] = useState(0);
  const [full, setFull] = useState<"off" | "native" | "overlay">("off");
  const track = tracks[idx];

  // ---- audio ----
  const playAt = useCallback((i: number) => {
    setIdx(i); setTime(0);
    const a = audio.current; if (!a || !tracks[i]) return;
    a.src = tracks[i].url; a.load();
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [tracks]);
  const toggle = () => {
    const a = audio.current; if (!a || !track) return;
    if (!a.src) { playAt(idx); return; }
    if (a.paused) a.play().then(() => setPlaying(true)).catch(() => {}); else { a.pause(); setPlaying(false); }
  };
  const next = useCallback((auto = false) => {
    if (!tracks.length) return;
    if (auto && repeat === "one") { const a = audio.current; if (a) { a.currentTime = 0; a.play().catch(() => {}); } return; }
    const last = idx === tracks.length - 1;
    if (auto && last && repeat === "off") { setPlaying(false); return; }
    playAt(last ? 0 : idx + 1);
  }, [tracks.length, repeat, idx, playAt]);
  const prev = () => {
    const a = audio.current; if (!tracks.length) return;
    if (a && a.currentTime > 3) { a.currentTime = 0; return; }
    playAt(idx === 0 ? tracks.length - 1 : idx - 1);
  };
  const cycleRepeat = () => setRepeat((r) => (r === "all" ? "one" : r === "one" ? "off" : "all"));

  useEffect(() => {
    const a = audio.current; if (!a) return;
    const onTime = () => setTime(a.currentTime);
    const onMeta = () => setDur(a.duration);
    const onEnd = () => next(true);
    const onPause = () => setPlaying(false); const onPlay = () => setPlaying(true);
    a.addEventListener("timeupdate", onTime); a.addEventListener("loadedmetadata", onMeta); a.addEventListener("ended", onEnd);
    a.addEventListener("pause", onPause); a.addEventListener("play", onPlay);
    return () => { a.removeEventListener("timeupdate", onTime); a.removeEventListener("loadedmetadata", onMeta); a.removeEventListener("ended", onEnd); a.removeEventListener("pause", onPause); a.removeEventListener("play", onPlay); };
  }, [next]);

  // lock-screen / headset controls where supported
  useEffect(() => {
    if (!("mediaSession" in navigator) || !track) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.artist || "FALLing in Love", album: "THE ONE MORE SONG" });
    navigator.mediaSession.setActionHandler("play", () => audio.current?.play());
    navigator.mediaSession.setActionHandler("pause", () => audio.current?.pause());
    navigator.mediaSession.setActionHandler("nexttrack", () => next());
    navigator.mediaSession.setActionHandler("previoustrack", () => prev());
  });

  // ---- slideshow ----
  useEffect(() => {
    if (slides !== "play" || photos.length < 2) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % photos.length), SLIDE_MS);
    return () => clearInterval(t);
  }, [slides, photos.length]);

  // ---- fullscreen ----
  useEffect(() => {
    if (full !== "overlay") return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFull("off"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);
  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement && full === "native") setFull("off"); };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [full]);
  const toggleFull = async () => {
    if (full === "native") { await document.exitFullscreen?.().catch(() => {}); setFull("off"); return; }
    if (full === "overlay") { setFull("off"); return; }
    const el = shell.current;
    if (el?.requestFullscreen) { try { await el.requestFullscreen(); setFull("native"); return; } catch { /* fall through */ } }
    setFull("overlay");
  };

  const stopped = slides === "stop" || !photos.length;
  const pct = dur ? Math.min(100, (time / dur) * 100) : 0;

  return (
    <div ref={shell} className={`omsPlayer ${full !== "off" ? "isFull" : ""} ${full === "overlay" ? "overlay" : ""}`}>
      <audio ref={audio} preload="metadata" />

      {/* visual: photo slideshow, or the spinning record with the lockup when stopped */}
      <div className="omsStage">
        {stopped ? (
          <div className="omsStopped">
            <Vinyl spinning={playing} className="omsStageVinyl" />
            <span className="omsLockup"><span className="fall">FALL</span>ing <em>in</em> Love</span>
          </div>
        ) : photos.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.key} src={p.url} alt="" className={i === slide ? "on" : ""} loading={i === 0 ? "eager" : "lazy"} />
        ))}
        <div className="omsSlideCtl" role="group" aria-label="사진 슬라이드쇼">
          <button type="button" onClick={() => setSlides("play")} aria-pressed={slides === "play"} disabled={!photos.length} title="슬라이드쇼 재생"><Icon d={I.play} /></button>
          <button type="button" onClick={() => setSlides("pause")} aria-pressed={slides === "pause"} disabled={!photos.length} title="슬라이드쇼 일시정지"><Icon d={I.pause} /></button>
          <button type="button" onClick={() => setSlides("stop")} aria-pressed={stopped} title="슬라이드쇼 정지"><Icon d={I.stop} /></button>
          <span className="omsSlideLabel"><Icon d={I.photo} /> {photos.length ? `${slide + 1} / ${photos.length}` : "사진 준비 중"}</span>
        </div>
        <button type="button" className="omsFullBtn" onClick={toggleFull} title={full === "off" ? "전체 화면" : "전체 화면 끝내기"} aria-label={full === "off" ? "전체 화면" : "전체 화면 끝내기"}><Icon d={full === "off" ? I.full : I.exit} /></button>
      </div>

      {/* now playing + transport */}
      <div className="omsDeck">
        <div className="omsNow">
          <small>{tracks.length ? `TRACK ${String(idx + 1).padStart(2, "0")} / ${String(tracks.length).padStart(2, "0")}` : "PLAYLIST"}</small>
          <b>{track ? track.title : "트랙이 아직 없습니다"}</b>
          <span>{track ? track.artist || "FALLing in Love" : "행사가 끝나면 그날의 곡이 이곳에 올라옵니다."}</span>
        </div>
        <div className="omsProgress">
          <span>{fmt(time)}</span>
          <input type="range" min={0} max={dur || 0} step={0.1} value={Math.min(time, dur || 0)} disabled={!track || !dur}
            onChange={(e) => { const a = audio.current; if (a) { a.currentTime = Number(e.target.value); setTime(a.currentTime); } }}
            style={{ "--pct": `${pct}%` } as React.CSSProperties} aria-label="재생 위치" />
          <span>{fmt(dur)}</span>
        </div>
        <div className="omsTransport">
          <button type="button" className={`omsRepeat r-${repeat}`} onClick={cycleRepeat} title={repeat === "all" ? "전체 반복" : repeat === "one" ? "한 곡 반복" : "반복 해제"} aria-label={`반복: ${repeat === "all" ? "전체" : repeat === "one" ? "한 곡" : "해제"}`}>
            <Icon d={I.repeat} />{repeat === "one" && <i>1</i>}
          </button>
          <button type="button" onClick={prev} disabled={!tracks.length} aria-label="이전 곡"><Icon d={I.prev} /></button>
          <button type="button" className="omsPlay" onClick={toggle} disabled={!tracks.length} aria-label={playing ? "일시정지" : "재생"}><Icon d={playing ? I.pause : I.play} /></button>
          <button type="button" onClick={() => next()} disabled={!tracks.length} aria-label="다음 곡"><Icon d={I.next} /></button>
          <button type="button" onClick={() => setShowList((v) => !v)} aria-pressed={showList} aria-label="전체 트랙"><Icon d={I.list} /></button>
        </div>
        <p className="omsRepeatLabel">{repeat === "all" ? "전체 반복" : repeat === "one" ? "한 곡 반복" : "반복 해제"}</p>
        {showList && (
          <ol className="omsList">
            {tracks.map((t, i) => (
              <li key={t.key}><button type="button" className={i === idx ? "on" : ""} onClick={() => { playAt(i); }}>
                <b>{String(i + 1).padStart(2, "0")}</b><span>{t.title}{t.artist ? <em> · {t.artist}</em> : null}</span>{i === idx && playing && <i className="eq" aria-label="재생 중" />}
              </button></li>
            ))}
            {!tracks.length && <li className="empty">트랙이 올라오면 이곳에서 골라 들을 수 있습니다.</li>}
          </ol>
        )}
      </div>
    </div>
  );
}
