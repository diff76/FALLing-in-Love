"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type TicketField = { k: string; v: string };
export type TicketBadge = { text: string; tone?: "diet" | "park" | "acc" | "ret" | "plain" };

/**
 * The Matinée Pass as a physical ticket: scalloped stub, tear line, double frame, and a
 * holographic sheen that follows the pointer, a finger swipe, or (with permission on iOS)
 * the phone's tilt. Idle: a slow shimmer. Reduced motion: flat, static card.
 */
export function TicketCard({ code, name, party, fields, badges, qrSvg, qrNote, issued }: {
  code: string; name: ReactNode; party: string; fields: TicketField[]; badges: TicketBadge[]; qrSvg: string; qrNote: ReactNode; issued?: boolean;
}) {
  const shell = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const idle = useRef<number | null>(null);
  const [tiltAsk, setTiltAsk] = useState<"hidden" | "show" | "on">("hidden");
  const [burst, setBurst] = useState<{ dx: number; dy: number; rot: number; c: string; w: number; h: number; delay: number }[]>([]);

  useEffect(() => {
    const sh = shell.current, cd = card.current; if (!sh || !cd) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const MAX = 6;
    const idleOn = () => { if (!reduce) cd.classList.add("shimmer"); };
    const idleOff = () => { cd.classList.remove("shimmer"); if (idle.current) clearTimeout(idle.current); idle.current = window.setTimeout(idleOn, 4000); };
    const apply = (px: number, py: number) => {
      idleOff();
      px = Math.max(-1, Math.min(1, px)); py = Math.max(-1, Math.min(1, py));
      cd.style.transform = reduce ? "none" : `rotateY(${(px * MAX).toFixed(2)}deg) rotateX(${(-py * MAX).toFixed(2)}deg)`;
      cd.style.setProperty("--sheen", `${(50 - px * 46).toFixed(1)}%`);
    };
    const fromPoint = (x: number, y: number) => { const r = sh.getBoundingClientRect(); apply(((x - r.left) / r.width - 0.5) * 2, ((y - r.top) / r.height - 0.5) * 2); };
    const onMove = (e: PointerEvent) => fromPoint(e.clientX, e.clientY);
    const onLeave = () => apply(0, 0);
    const onTouch = (e: TouchEvent) => { const t = e.touches[0]; if (t) fromPoint(t.clientX, t.clientY); };
    const onTilt = (ev: DeviceOrientationEvent) => { if (ev.gamma == null && ev.beta == null) return; apply((ev.gamma ?? 0) / 28, ((ev.beta ?? 0) - 45) / 28); };
    idleOn();
    sh.addEventListener("pointermove", onMove); sh.addEventListener("pointerleave", onLeave); sh.addEventListener("touchmove", onTouch, { passive: true });
    type DOE = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<"granted" | "denied"> };
    const needsAsk = typeof DeviceOrientationEvent !== "undefined" && typeof (DeviceOrientationEvent as DOE).requestPermission === "function";
    if (!needsAsk && typeof DeviceOrientationEvent !== "undefined") window.addEventListener("deviceorientation", onTilt);
    (sh as unknown as { _tilt?: typeof onTilt })._tilt = onTilt;
    // State updates are deferred a frame: the effect itself only wires up the DOM listeners.
    const raf = requestAnimationFrame(() => {
      if (needsAsk) setTiltAsk("show");
      if (issued && !reduce) {
        const cols = ["#C9932F", "#BE5637", "#6C8A50", "#E4C08E", "#3E5540"];
        setBurst(Array.from({ length: 30 }, (_, i) => {
          const a = (Math.PI * 2 * i) / 30 + Math.random() * 0.4, d = 90 + Math.random() * 120;
          return { dx: Math.cos(a) * d, dy: Math.sin(a) * d * 0.7 - 30, rot: Math.random() * 540 - 270, c: cols[i % cols.length], w: 4 + Math.random() * 5, h: 6 + Math.random() * 8, delay: Math.random() * 120 };
        }));
      }
    });
    return () => {
      sh.removeEventListener("pointermove", onMove); sh.removeEventListener("pointerleave", onLeave); sh.removeEventListener("touchmove", onTouch);
      window.removeEventListener("deviceorientation", onTilt); if (idle.current) clearTimeout(idle.current); cancelAnimationFrame(raf);
    };
  }, [issued]);

  async function askTilt() {
    const sh = shell.current; const onTilt = (sh as unknown as { _tilt?: (e: DeviceOrientationEvent) => void } | null)?._tilt;
    type DOE = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<"granted" | "denied"> };
    try {
      const r = await (DeviceOrientationEvent as DOE).requestPermission?.();
      if (r === "granted" && onTilt) { window.addEventListener("deviceorientation", onTilt); setTiltAsk("on"); }
    } catch { /* not available here */ }
  }

  return (
    <>
      <div className="ticketShell" ref={shell}>
        <div className="burst" aria-hidden="true">
          {burst.map((b, i) => <i key={i} style={{ "--dx": `${b.dx}px`, "--dy": `${b.dy}px`, "--rot": `${b.rot}deg`, background: b.c, width: b.w, height: b.h, animationDelay: `${b.delay}ms` } as React.CSSProperties} />)}
        </div>
        <div className="ticket3d" ref={card}>
          <div className="scallop" />
          <article className="ticket" aria-label="Matinée Pass">
            <div className="tIn">
              <div className="tStub"><div className="tNo">TICKET NO. {code}</div><div className="tPill">MATINÉE PASS</div></div>
              <div className="tear"><i className="l" /><i className="r" /><span>TEAR HERE</span></div>
              <div className="tBody"><div className="tFrame">
                <h2 className="tName">{name}</h2>
                <p className="tParty">{party}</p>
                <dl className="tGrid">{fields.map((f) => <div key={f.k}><dt>{f.k}</dt><dd>{f.v}</dd></div>)}</dl>
                {badges.length > 0 && <div className="tBadges">{badges.map((b) => <span key={b.text} className={`badge ${b.tone ?? "plain"}`}>{b.text}</span>)}</div>}
                <div className="tQr">
                  <div className="qr" dangerouslySetInnerHTML={{ __html: qrSvg }} aria-label="체크인 QR" role="img" />
                  <p>{qrNote}</p>
                </div>
              </div></div>
              <div className="tFoot">TICKET NO. {code}</div>
            </div>
          </article>
        </div>
      </div>
      {tiltAsk === "show" && <button type="button" className="tiltBtn" onClick={askTilt}>기울기 광택 켜기 (티켓을 손가락으로 쓸어도 됩니다)</button>}
      {tiltAsk === "on" && <p className="tiltOn">폰을 살짝 기울여 보세요</p>}
    </>
  );
}
