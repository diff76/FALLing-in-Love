"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const EVERY_MS = 30_000;
const hhmm = (d: Date) => d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

/**
 * Keeps the Matinée Pass current — seat assigned at check-in, check-in badge, return shuttle —
 * without the guest doing anything: re-reads the pass every 30 s while the page is visible and
 * as soon as it comes back to the foreground, plus a manual 새로고침 button.
 */
export function PassRefresh() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [at, setAt] = useState<string | null>(null);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") start(() => { router.refresh(); setAt(hhmm(new Date())); }); };
    setAt(hhmm(new Date()));
    const t = setInterval(refresh, EVERY_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", refresh); };
  }, [router]);
  return (
    <div className="passRefresh">
      <small>{at ? `${at} 기준 · 자동으로 새로고침됩니다` : "자동으로 새로고침됩니다"}</small>
      <button type="button" onClick={() => start(() => { router.refresh(); setAt(hhmm(new Date())); })} disabled={pending} aria-label="Pass 새로고침">
        <span aria-hidden="true" className={pending ? "spin" : ""}>↻</span> {pending ? "새로고침 중…" : "새로고침"}
      </button>
    </div>
  );
}
