"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ReservationAction } from "./reservation-actions";

export type ListRow = {
  id: string; code: string; name: string; phone: string; district: string; inviter: string; attendance: string;
  party: number; arrived: number | null; transport: string; flags: string; imported: boolean; mirae: boolean; plate: string; members: string[];
};

const squash = (s: string) => s.toLowerCase().replace(/[\s\-·.]/g, "");

/**
 * Admin 신청 명단 with a search box: name, companion, ticket number, phone (full or last digits),
 * district, inviter or car plate — spaces and hyphens ignored.
 */
export function ReservationList({ rows }: { rows: ListRow[] }) {
  const [q, setQ] = useState("");
  const [onlyAway, setOnlyAway] = useState(false);
  const needle = squash(q);
  const shown = useMemo(() => rows
    .filter((r) => !onlyAway || r.arrived == null)
    .map((r) => {
      if (!needle) return { r, via: null as string | null };
      const own = [r.name, r.code, r.phone, r.district, r.inviter, r.plate].some((v) => squash(v).includes(needle));
      if (own) return { r, via: null };
      const m = r.members.find((n) => squash(n).includes(needle));
      return m ? { r, via: m } : null;
    })
    .filter((x): x is { r: ListRow; via: string | null } => x !== null), [rows, needle, onlyAway]);
  const people = shown.reduce((n, { r }) => n + r.party, 0);

  return (
    <>
      <div className="listTools">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="성함 · 동행 · 연락처(뒷자리) · 티켓 번호 · 교구 · 차량 번호" aria-label="신청 명단 검색" />
        <label className="chk"><input type="checkbox" checked={onlyAway} onChange={(e) => setOnlyAway(e.target.checked)} /> 미도착만</label>
        <span className="tiny">{q || onlyAway ? `${shown.length}팀 · ${people}명 / 전체 ${rows.length}팀` : `전체 ${rows.length}팀 · ${people}명`}</span>
      </div>
      <div className="scroll"><table>
        <thead><tr><th>티켓 번호</th><th>초청자</th><th>교구/부서</th><th>참여</th><th>인원</th><th>이동</th><th>특이</th><th>체크인</th><th>관리</th></tr></thead>
        <tbody>
          {shown.map(({ r, via }) => (
            <tr key={r.id}><td className="mono">{r.code}</td>
              <td>{r.name}{r.mirae ? <small className="mirae"> 미래셀</small> : null}{r.imported ? <small> 수기</small> : null}{via ? <small className="via"> · 동행 {via}</small> : null}</td>
              <td>{r.district}</td><td>{r.attendance}</td>
              <td className="mono">{r.arrived != null ? `${r.arrived} / ${r.party}` : r.party}</td>
              <td>{r.transport}</td><td>{r.flags}</td>
              <td>{r.arrived != null ? <span className="tag in">확인</span> : <span className="tag">미도착</span>}</td>
              <td><span className="rowAct"><Link className="miniBtn" href={`/admin/reservations/${r.id}`}>수정</Link><Link className="miniBtn" href={`/admin/reservations/${r.id}#pass`}>Pass</Link><ReservationAction id={r.id} name={r.name} checkedIn={r.arrived != null} mode="cancel" /></span></td></tr>
          ))}
          {shown.length === 0 && <tr><td colSpan={9} className="tiny">찾는 신청이 없습니다. 성함은 띄어쓰기 없이, 연락처는 뒷자리 4자리로도 찾을 수 있습니다.</td></tr>}
        </tbody>
      </table></div>
    </>
  );
}
