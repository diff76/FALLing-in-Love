"use client";

import { useEffect, useRef, useState } from "react";
import { eventConfig } from "@fil/config";
import { createBrowserSupabaseClient, isSupabaseConfigured, type OpsStats, type ReservationSummary } from "@fil/supabase";

type Welcome = { name: string; seat: string; guests: number };
const SHOW_MS = 6000;
/** Greet the moment a staff phone confirms the check-in (was 10 s; changed 2026-09-27). */
const DELAY_MS = 0;
/** Realtime is the fast path; this poll is the safety net (every 4 s) so a greeting is never lost. */
const POLL_MS = 4000;

function maskName(name: string) {
  const n = name.trim();
  if (n.length <= 1) return n;
  return n[0] + "○".repeat(Math.max(1, n.length - 1));
}

/** Two soft chime notes (no audio file needed). Needs one user gesture first — hence the start overlay. */
function chime(ctx: AudioContext) {
  const play = (freq: number, at: number, dur: number) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.35, at + 0.02); g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g).connect(ctx.destination); o.start(at); o.stop(at + dur);
  };
  const t = ctx.currentTime;
  play(784, t, 1.2); play(1046.5, t + 0.28, 1.6);
}

type CheckinRow = { id: string; reservation_id: string; checked_in_at: string; station_id: string; arrived_count: number; arrived_at?: string | null };
/**
 * Lobby screen: idle programme + a masked welcome, with a chime, the moment a party is on campus —
 * a check-in at THE LANDING / the chapel, or a party from 창동 THE GATE being scanned on arrival
 * (their check-in at the gate itself is not greeted: they are still on the shuttle).
 */
export function WelcomeDisplay() {
  const [now, setNow] = useState(new Date());
  const [current, setCurrent] = useState<Welcome | null>(null);
  const [armed, setArmed] = useState(false);
  const [link, setLink] = useState<"connecting" | "live" | "poll">("connecting");
  const [arrived, setArrived] = useState<number | null>(null);
  const queue = useRef<Welcome[]>([]);
  const showing = useRef(false);
  const audio = useRef<AudioContext | null>(null);
  const known = useRef<Set<string>>(new Set());
  const since = useRef<string>(new Date().toISOString());

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15_000); return () => clearInterval(t); }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const db = createBrowserSupabaseClient();
    let gateId: string | null = null;
    const gateReady = db.from("stations").select("id").eq("code", "gate").maybeSingle().then(({ data }) => { gateId = data?.id ?? null; });
    const onCampus = (c: CheckinRow) => c.station_id !== gateId || !!c.arrived_at;
    // people on campus (gate check-ins count once they arrive); falls back to the overall figure before migration 0008
    const refreshCount = async () => {
      await gateReady;
      const { data, error } = await db.from("checkins").select("*").is("voided_at", null);
      const rows = (data ?? []) as CheckinRow[];
      if (!error && (!rows.length || "arrived_at" in rows[0])) { setArrived(rows.filter(onCampus).reduce((n, c) => n + c.arrived_count, 0)); return; }
      const { data: st } = await db.rpc("ops_stats"); const s = st as OpsStats | null; if (s) setArrived(s.checked_in_people);
    };
    const drain = () => {
      if (showing.current || !queue.current.length) return;
      showing.current = true;
      if (audio.current) { try { chime(audio.current); } catch { /* muted */ } }
      setCurrent(queue.current.shift()!);
      setTimeout(() => { setCurrent(null); setTimeout(() => { showing.current = false; drain(); }, 600); }, SHOW_MS);
    };
    // One entry point for both paths, keyed by check-in id so nothing is greeted twice.
    const enqueue = async (checkinId: string, reservationId: string, checkedInAt: string) => {
      if (known.current.has(checkinId)) return;
      known.current.add(checkinId);
      refreshCount();
      const { data } = await db.rpc("get_reservation_summary", { p_reservation_id: reservationId });
      const r = data as ReservationSummary | null;
      if (!r) return;
      const w = { name: maskName(r.applicant_name), seat: r.seat_label ?? "", guests: r.guest_count };
      const wait = Math.max(0, DELAY_MS - (Date.now() - new Date(checkedInAt).getTime()));
      setTimeout(() => { queue.current.push(w); drain(); }, wait);
    };
    const channel = db.channel("display")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "checkins" }, async (payload) => {
        const c = payload.new as CheckinRow;
        await gateReady;
        if (c.station_id !== gateId) enqueue(c.id, c.reservation_id, c.checked_in_at); else refreshCount();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "checkins" }, async (payload) => {
        const c = payload.new as CheckinRow;
        await gateReady;
        if (c.station_id === gateId && c.arrived_at && c.arrived_at > since.current) enqueue(c.id, c.reservation_id, c.arrived_at);
      })
      .subscribe((status) => setLink(status === "SUBSCRIBED" ? "live" : "poll"));
    const poll = async () => {
      await gateReady;
      const after = since.current;
      const { data, error } = await db.from("checkins").select("*").is("voided_at", null).or(`checked_in_at.gt.${after},arrived_at.gt.${after}`);
      if (error) {   // before migration 0008 (no arrived_at): greet campus check-ins only
        const { data: old } = await db.from("checkins").select("id, reservation_id, checked_in_at, station_id").is("voided_at", null).gt("checked_in_at", after).order("checked_in_at");
        (old ?? []).forEach((c) => { if (c.station_id !== gateId) enqueue(c.id, c.reservation_id, c.checked_in_at); });
        return;
      }
      ((data ?? []) as CheckinRow[])
        .map((c) => ({ c, at: c.station_id === gateId ? c.arrived_at : c.checked_in_at }))
        .filter((x): x is { c: CheckinRow; at: string } => !!x.at && x.at > after)
        .sort((a, b) => a.at.localeCompare(b.at))
        .forEach(({ c, at }) => enqueue(c.id, c.reservation_id, at));
    };
    refreshCount();
    const timer = setInterval(poll, POLL_MS);
    const countTimer = setInterval(refreshCount, 60_000);
    return () => { db.removeChannel(channel); clearInterval(timer); clearInterval(countTimer); };
  }, []);

  function arm() {
    try { const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; audio.current = new Ctx(); audio.current.resume(); } catch { /* no audio */ }
    setArmed(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  // Korea time whatever the lobby PC's own zone setting is (the programme highlight follows this too)
  const hhmm = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" });
  const schedule = eventConfig.schedule;
  const nowIdx = schedule.reduce((idx, s, i) => (hhmm >= s.time ? i : idx), -1);
  return (
    <div className="display">
      {!armed && (
        <button className="arm" onClick={arm}>
          <b>화면 시작</b><span>한 번 누르면 환영 메시지와 알림음이 켜집니다</span>
        </button>
      )}
      <div className="idle">
        <div className="idleTop">
          <span>{eventConfig.edition} · {eventConfig.venue.short}</span>
          <div className="clock"><b>{hhmm}</b><small>지금까지 <strong>{arrived ?? "—"}</strong>분 오셨습니다</small></div>
        </div>
        <h1 className="lockup"><span className="fall hl">FALL</span>ing <em>in</em> Love</h1>
        <p>{eventConfig.subtitle} · {eventConfig.dateLabel}</p>
        <ol className="timeline">
          {schedule.map((s, i) => (
            <li key={s.time} className={i < nowIdx ? "done" : i === nowIdx ? "now" : ""}>
              <i className="dot" /><time>{s.time}</time><span>{s.title}</span>
            </li>
          ))}
        </ol>
        <div className={`linkDot ${link}`} title={link === "live" ? "실시간 연결" : link === "poll" ? "4초 간격 확인" : "연결 중"}>{link === "live" ? "LIVE" : link === "poll" ? "POLL" : "…"}</div>
      </div>
      <div className={`hello ${current ? "on" : ""}`} aria-live="polite">
        {current && (
          <div>
            <small>{current.guests > 0 ? "WELCOME" : "REUNION"}</small>
            <h2>{current.name} 님{current.guests > 0 ? " 일행" : ""}</h2>
            <p>{current.guests > 0 ? "오늘 이 자리에 오신 것을 환영합니다" : "함께해 주셔서 감사합니다"}</p>
            {current.seat && <div className="seat"><span>Seat</span><b>{current.seat}</b></div>}
          </div>
        )}
      </div>
    </div>
  );
}
