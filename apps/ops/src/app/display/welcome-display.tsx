"use client";

import { useEffect, useRef, useState } from "react";
import { eventConfig } from "@fil/config";
import { createBrowserSupabaseClient, isSupabaseConfigured, type ReservationSummary } from "@fil/supabase";

type Welcome = { name: string; seat: string; guests: number };
const SHOW_MS = 4600;

function maskName(name: string) {
  const n = name.trim();
  if (n.length <= 1) return n;
  return n[0] + "○".repeat(Math.max(1, n.length - 1));
}

/** Lobby screen: idle programme + a brief, masked welcome whenever staff confirms a check-in. */
export function WelcomeDisplay() {
  const [now, setNow] = useState(new Date());
  const [current, setCurrent] = useState<Welcome | null>(null);
  const queue = useRef<Welcome[]>([]);
  const showing = useRef(false);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15_000); return () => clearInterval(t); }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const db = createBrowserSupabaseClient();
    const drain = () => {
      if (showing.current || !queue.current.length) return;
      showing.current = true;
      setCurrent(queue.current.shift()!);
      setTimeout(() => { setCurrent(null); setTimeout(() => { showing.current = false; drain(); }, 500); }, SHOW_MS);
    };
    const channel = db.channel("display").on("postgres_changes", { event: "INSERT", schema: "public", table: "checkins" }, async (payload) => {
      const id = (payload.new as { reservation_id: string }).reservation_id;
      const { data } = await db.rpc("get_reservation_summary", { p_reservation_id: id });
      const r = data as ReservationSummary | null;
      if (!r) return;
      queue.current.push({ name: maskName(r.applicant_name), seat: r.seat_label ?? "", guests: r.guest_count });
      drain();
    }).subscribe();
    return () => { db.removeChannel(channel); };
  }, []);

  const hhmm = now.toTimeString().slice(0, 5);
  return (
    <div className="display">
      <div className="idle">
        <div className="idleTop"><span>{eventConfig.edition} · {eventConfig.venue.short}</span><b>{hhmm}</b></div>
        <h1><span>FALL</span>ing <em>in</em> Love</h1>
        <p>{eventConfig.subtitle} · {eventConfig.dateLabel}</p>
        <ol className="timeline">
          {eventConfig.schedule.map((s) => <li key={s.time} className={hhmm >= s.time ? "done" : ""}><time>{s.time}</time><span>{s.title}</span></li>)}
        </ol>
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
