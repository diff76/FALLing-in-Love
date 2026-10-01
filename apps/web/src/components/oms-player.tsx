"use client";

import type React from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Vinyl } from "./vinyl";
import { fmt, I, Icon, OmsVolume, useOmsAudio } from "./oms-audio";

export type PlayerPhoto = { key: string; url: string };
type Slides = "play" | "pause" | "stop";

const SLIDE_MS = 5000;
/** In-app browsers (KakaoTalk, Naver, Instagram…) often stop audio when the app goes to the background. */
const IN_APP = /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\//i;
const noop = () => () => {};

/**
 * OMS Player (One More Song Player): the day's playlist with prev/next/play/pause, repeat
 * (all · one · off), a seekable progress bar, volume, the full track list, and a photo slideshow
 * with a slow Ken Burns zoom/pan (switch on · off, pause). Off shows the record with the site lockup,
 * turning at 33⅓ while music plays and idling slowly otherwise.
 * Fullscreen uses the Fullscreen API, or a fixed overlay where it is unavailable (iPhone).
 * The sound itself (and background / lock-screen play) lives in <OmsAudioProvider> in the
 * /one-more-song layout, so it carries on into the photo page.
 */
export function OmsPlayer({ photos }: { photos: PlayerPhoto[] }) {
  const { tracks, track, idx, playing, repeat, time, dur, playAt, toggle, next, prev, cycleRepeat, seek } = useOmsAudio();
  const shell = useRef<HTMLDivElement>(null);
  const [showList, setShowList] = useState(false);
  const [slides, setSlides] = useState<Slides>(photos.length ? "play" : "stop");
  const [{ slide, prev: prevSlide }, setShow] = useState({ slide: 0, prev: -1 });   // prev keeps its zoom while it fades out
  const stage = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState<"off" | "native" | "overlay">("off");
  const inApp = useSyncExternalStore(noop, () => IN_APP.test(navigator.userAgent), () => false);

  // ---- slideshow ----
  useEffect(() => {
    if (slides !== "play" || photos.length < 2) return;
    const t = setInterval(() => setShow((s) => ({ slide: (s.slide + 1) % photos.length, prev: s.slide })), SLIDE_MS);
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
  // the record never jumps: the same turning animation just speeds up (playing) or idles (paused)
  useEffect(() => {
    stage.current?.querySelectorAll<HTMLElement>(".vinyl .disc").forEach((d) => d.getAnimations().forEach((a) => a.updatePlaybackRate(playing ? 1 : 0.2)));
  }, [playing, stopped]);
  const pct = dur ? Math.min(100, (time / dur) * 100) : 0;

  return (
    <div ref={shell} className={`omsPlayer ${full !== "off" ? "isFull" : ""} ${full === "overlay" ? "overlay" : ""}`}>
      {/* visual: photo slideshow, or the spinning record with the lockup when stopped */}
      <div ref={stage} className={`omsStage ${slides === "pause" ? "paused" : ""}`}>
        {stopped ? (
          <div className="omsStopped">
            <Vinyl spinning className="omsStageVinyl" />
            <span className="omsLockup"><span className="fall">FALL</span>ing <em>in</em> Love</span>
          </div>
        ) : photos.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.key} src={p.url} alt="" className={`kb${i % 4} ${i === slide ? "on" : i === prevSlide ? "prev" : ""}`} loading={i === 0 ? "eager" : "lazy"} />
        ))}
        <div className="omsSlideCtl" role="group" aria-label="사진 슬라이드쇼">
          <button type="button" role="switch" aria-checked={!stopped} className="omsSlideSwitch" disabled={!photos.length}
            onClick={() => { if (stopped) { setShow({ slide: 0, prev: -1 }); setSlides("play"); } else setSlides("stop"); }}
            title={stopped ? "사진 슬라이드쇼 켜기" : "슬라이드쇼 끄고 LP 보기"}>
            <i aria-hidden="true" /><span>슬라이드쇼 {stopped ? "OFF" : "ON"}</span>
          </button>
          {!stopped && (
            <button type="button" onClick={() => setSlides(slides === "pause" ? "play" : "pause")} aria-label={slides === "pause" ? "슬라이드쇼 다시 재생" : "슬라이드쇼 일시정지"} title={slides === "pause" ? "다시 재생" : "일시정지"}>
              <Icon d={slides === "pause" ? I.play : I.pause} />
            </button>
          )}
          <span className="omsSlideLabel"><Icon d={I.photo} /> {photos.length ? (stopped ? `${photos.length}장` : `${slide + 1} / ${photos.length}`) : "사진 준비 중"}</span>
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
            onChange={(e) => seek(Number(e.target.value))}
            style={{ "--pct": `${pct}%` } as React.CSSProperties} aria-label="재생 위치" />
          <span>{fmt(dur)}</span>
        </div>
        <div className="omsTransport">
          <button type="button" className={`omsRepeat r-${repeat}`} onClick={cycleRepeat} title={repeat === "all" ? "전체 반복" : repeat === "one" ? "한 곡 반복" : "반복 해제"} aria-label={`반복: ${repeat === "all" ? "전체" : repeat === "one" ? "한 곡" : "해제"}`}>
            <Icon d={I.repeat} />{repeat === "one" && <i>1</i>}
          </button>
          <button type="button" onClick={prev} disabled={!tracks.length} aria-label="이전 곡"><Icon d={I.prev} /></button>
          <button type="button" className="omsPlay" onClick={toggle} disabled={!tracks.length} aria-label={playing ? "일시정지" : "재생"}><Icon d={playing ? I.pause : I.play} /></button>
          <button type="button" onClick={next} disabled={!tracks.length} aria-label="다음 곡"><Icon d={I.next} /></button>
          <button type="button" onClick={() => setShowList((v) => !v)} aria-pressed={showList} aria-label="전체 트랙"><Icon d={I.list} /></button>
        </div>
        <p className="omsRepeatLabel">{repeat === "all" ? "전체 반복" : repeat === "one" ? "한 곡 반복" : "반복 해제"}</p>
        <OmsVolume />
        {inApp && <p className="omsInApp">카카오톡 같은 앱 안에서 열면 화면을 끄거나 다른 앱으로 가면 음악이 멈출 수 있습니다. 메뉴(⋯)에서 <b>다른 브라우저로 열기</b>를 누르면 화면을 꺼도 계속 들을 수 있습니다.</p>}
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
