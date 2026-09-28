"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelReservation, restoreReservation } from "./actions";

/** Row button in the admin list: 취소 → inline confirm → status 'cancelled'. Or 되돌리기 on a cancelled row. */
export function ReservationAction({ id, name, checkedIn, mode }: { id: string; name: string; checkedIn?: boolean; mode: "cancel" | "restore" }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setErr(null);
    try { await (mode === "cancel" ? cancelReservation(id) : restoreReservation(id)); setAsk(false); router.refresh(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };
  if (mode === "restore") {
    return <span className="rowAct">{err && <em className="warn">{err}</em>}<button className="miniBtn" disabled={busy} onClick={go}>{busy ? "…" : "되돌리기"}</button></span>;
  }
  return ask ? (
    <span className="rowAct confirm">
      <em>{name} 님 신청을 취소할까요?{checkedIn ? " 체크인과 좌석도 함께 풀립니다." : ""}</em>
      <button className="miniBtn del" disabled={busy} onClick={go}>{busy ? "…" : "취소 확정"}</button>
      <button className="miniBtn" disabled={busy} onClick={() => { setAsk(false); setErr(null); }}>아니오</button>
      {err && <em className="warn">{err}</em>}
    </span>
  ) : <button className="miniBtn" onClick={() => setAsk(true)}>신청 취소</button>;
}
