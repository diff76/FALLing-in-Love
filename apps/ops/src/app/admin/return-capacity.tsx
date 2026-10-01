"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setReturnCapacity } from "./actions";

export type ReturnRow = { id: string; label: string; capacity: number; booked: number };

/** Admin: seats per return bus. Bookings (web sign-ups + the scan desk) count against it automatically. */
export function ReturnCapacity({ runs }: { runs: ReturnRow[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, string>>(Object.fromEntries(runs.map((r) => [r.id, String(r.capacity)])));
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const save = async (r: ReturnRow) => {
    setBusy(r.id); setMsg(null);
    try { await setReturnCapacity(r.id, Number(draft[r.id])); setMsg(`${r.label} 편 좌석을 ${draft[r.id]}석으로 저장했습니다.`); router.refresh(); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(null); }
  };
  return (
    <div className="returnCap">
      <table>
        <thead><tr><th>복귀 편</th><th>예약</th><th>남은 좌석</th><th>전체 좌석</th><th /></tr></thead>
        <tbody>{runs.map((r) => {
          const cap = Number(draft[r.id]); const left = Number.isFinite(cap) ? cap - r.booked : r.capacity - r.booked;
          return (
            <tr key={r.id}>
              <td className="mono">{r.label}</td><td className="mono">{r.booked}명</td>
              <td className={`mono ${left < 0 ? "over" : left === 0 ? "zero" : ""}`}>{left}석</td>
              <td><input inputMode="numeric" value={draft[r.id]} onChange={(e) => setDraft({ ...draft, [r.id]: e.target.value.replace(/\D/g, "") })} aria-label={`${r.label} 전체 좌석`} /></td>
              <td><button className="miniBtn" disabled={busy !== null || String(r.capacity) === draft[r.id]} onClick={() => save(r)}>{busy === r.id ? "…" : "저장"}</button></td>
            </tr>
          );
        })}</tbody>
      </table>
      {msg && <p className="tiny">{msg}</p>}
    </div>
  );
}
