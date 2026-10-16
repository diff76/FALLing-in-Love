"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Vinyl } from "./vinyl";
import { I, Icon } from "./oms-audio";

type Track = { url: string; title: string; artist: string };
type Props = {
  envelope: string; to: string; districtLabel: string; paragraphs: string[]; signer: string;
  tracks: Track[]; numbers: { people: number; vip: number; photos: number }; forwardPath: string | null;
};

const LEAF_COLORS = ["var(--persimmon)", "var(--amber)", "var(--paper-warm)", "var(--moss)", "#D8714F"];

/**
 * The thank-you letter. A sealed envelope waits on the paper; a tap breaks the seal, opens the flap, lifts the
 * letter out with a few falling leaves — and starts the first One More Song track, because a phone only lets a
 * page play sound after a tap. The letter then rises line by line: greeting, the district pastor's text,
 * a small One More Song player (the full page is one tap away), the day in numbers and a closing line.
 */
export function LetterView({ envelope, to, districtLabel, paragraphs, signer, tracks, numbers, forwardPath }: Props) {
  const [stage, setStage] = useState<"sealed" | "opening" | "open">("sealed");
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [leaves, setLeaves] = useState<{ left: number; d: number; w: number; x: number; r: number; c: string }[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const track = tracks[idx] ?? null;

  const playTrack = (i: number) => {
    const a = audio.current, t = tracks[i];
    if (!a || !t) return;
    if (a.src !== t.url) a.src = t.url;
    setIdx(i);
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  const open = () => {
    if (stage !== "sealed") return;
    // inside the tap: this is what lets the browser play sound
    if (tracks.length) { audio.current ??= new Audio(); audio.current.preload = "auto"; playTrack(0); }
    setLeaves(Array.from({ length: 16 }, (_, i) => ({ left: 4 + Math.random() * 92, d: 2.6 + Math.random() * 2, w: Math.random() * .9, x: -80 + Math.random() * 160, r: -320 + Math.random() * 640, c: LEAF_COLORS[i % LEAF_COLORS.length] })));
    setStage("opening");
    window.setTimeout(() => setLeaves([]), 5200);   // leaves keep falling over the opened letter, then go
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => setStage("open"), reduce ? 0 : 1300);
  };

  // the playlist carries on by itself; the music stops when the page goes away
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const onEnd = () => playTrack((idx + 1) % tracks.length);
    const onPause = () => setPlaying(false), onPlay = () => setPlaying(true);
    a.addEventListener("ended", onEnd); a.addEventListener("pause", onPause); a.addEventListener("play", onPlay);
    return () => { a.removeEventListener("ended", onEnd); a.removeEventListener("pause", onPause); a.removeEventListener("play", onPlay); };
  }); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { audio.current?.pause(); }, []);

  const toggle = () => {
    const a = audio.current;
    if (!a) { if (tracks.length) { audio.current = new Audio(); playTrack(idx); } return; }
    if (a.paused) a.play().catch(() => {}); else a.pause();
  };
  const next = () => playTrack((idx + 1) % tracks.length);

  const forward = async () => {
    if (!forwardPath) return;
    const url = new URL(forwardPath, window.location.origin).toString();
    const text = `함께 와 주셔서 고맙습니다. ${districtLabel}에서 보내는 감사 편지예요.`;
    if (navigator.share) { try { await navigator.share({ title: "FALLing in Love · 감사 편지", text, url }); return; } catch { return; } }
    try { await navigator.clipboard.writeText(`${text}\n${url}`); setToast("링크를 복사했습니다. 함께 오신 분께 붙여 넣어 보내 주세요."); }
    catch { window.prompt("링크를 복사해 보내 주세요", url); }
    window.setTimeout(() => setToast(null), 3200);
  };

  return (
    <main className={`ltPage ${stage}`}>
      <article className="ltLetter" aria-hidden={stage === "sealed"}>
        <header className="ltHead">
          <small>THANK YOU FOR COMING</small>
          <span className="ltLock"><span className="fall">FALL</span>ing<em>in</em>Love</span>
          <h1>함께해 주셔서<br />고맙습니다</h1>
        </header>
        <p className="ltTo">{to}</p>
        <section className="ltNote" aria-label="교구장 목사님 편지">
          {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          <p className="ltSign">2026년 10월<br />{districtLabel} 교구장 <b>{signer ? `${signer} 목사` : "목사"}</b></p>
        </section>

        <section className={`ltOms ${playing ? "playing" : ""}`} aria-label="The One More Song">
          <div className="ltOmsStage"><small>THE ONE MORE SONG</small><Vinyl spinning={playing} className="ltVinyl" /></div>
          <div className="ltOmsBody">
            <h2>The day is over. <em>The playlist isn’t.</em></h2>
            <p>그날 연주된 곡과 우리가 함께 남긴 사진 {numbers.photos}장입니다.</p>
            {track && (
              <div className="ltOmsRow">
                <button type="button" className="ltPlay" onClick={toggle} aria-label={playing ? "일시정지" : "재생"}><Icon d={playing ? I.pause : I.play} /></button>
                <div className="ltTrack"><b>{track.title}</b><span>{track.artist ? `${track.artist} · ` : ""}TRACK {String(idx + 1).padStart(2, "0")} / {String(tracks.length).padStart(2, "0")}</span></div>
                {tracks.length > 1 && <button type="button" className="ltNext" onClick={next} aria-label="다음 곡"><Icon d={I.next} /></button>}
              </div>
            )}
            <Link className="ltOmsLink" href="/one-more-song">플레이리스트와 사진 모두 보기 <span aria-hidden="true">→</span></Link>
          </div>
        </section>

        {forwardPath && (
          <section className="ltForward">
            <b>함께 오신 분께도 편지를 전해 주세요</b>
            <p>함께 오신 분들은 연락처를 받지 않아 편지를 직접 보내 드리지 못했습니다. 아래 버튼으로 그분들께 감사 편지를 보내 주세요.</p>
            <button type="button" onClick={forward}>함께 오신 분께 편지 보내기</button>
            {toast && <small role="status">{toast}</small>}
          </section>
        )}

        <div className="ltNumbers">
          <div><b>{numbers.people}</b><span>함께한 사람</span></div>
          <div><b>{numbers.vip}</b><span>처음 오신 VIP</span></div>
          <div><b>{numbers.photos}</b><span>남겨진 사진</span></div>
        </div>
        <p className="ltClosing">더 좋은 기회로, 곧 뵐 수 있기를 소망합니다!<b>창동염광교회</b></p>
      </article>

      {stage !== "open" && (
        <div className={`ltScene ${stage === "opening" ? "isOpening" : ""}`} role="button" tabIndex={0} aria-label="편지 열기" onClick={open} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}>
          <div className="ltSceneTop"><small>A LETTER HAS ARRIVED</small><span className="ltLock"><span className="fall">FALL</span>ing<em>in</em>Love</span></div>
          <div className="ltEnvelope">
            <div className="ltEnvBack" />
            <div className="ltPeek"><i /></div>
            <div className="ltEnvFront" />
            <div className="ltPostmark">HANSHIN<br />2026.10.11<br />CHANGDONG</div>
            <div className="ltStamp">Autumn<br />Garden<br />Matinée</div>
            <div className="ltAddr">{envelope}</div>
            <div className="ltFlap" />
            <div className="ltSeal" aria-hidden="true"><span>F</span><span>F</span></div>
          </div>
          <p className="ltHint">봉투를 눌러 편지를 열어 보세요<br /><small>소리가 함께 나옵니다</small></p>
        </div>
      )}
      {leaves.length > 0 && (
        <div className="ltLeaves" aria-hidden="true">
          {leaves.map((l, i) => <i key={i} style={{ left: `${l.left}%`, background: l.c, "--d": `${l.d}s`, "--w": `${l.w}s`, "--x": `${l.x}px`, "--r": `${l.r}deg` } as CSSProperties} />)}
        </div>
      )}
    </main>
  );
}
