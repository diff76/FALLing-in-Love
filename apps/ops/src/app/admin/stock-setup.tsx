"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setInitialStock } from "./actions";

export type StockItem = { id: string; name: string; initial: number; adjustment: number; given: number };

/** Admin: starting quantity per hospitality item. "남은 수량" is what the welcome desk sees. */
export function StockSetup({ items }: { items: StockItem[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, string>>(Object.fromEntries(items.map((i) => [i.id, String(i.initial)])));
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const save = async (it: StockItem) => {
    setBusy(it.id); setMsg(null);
    const err = await setInitialStock(it.id, Number(draft[it.id]));
    setBusy(null);
    if (err) { setMsg(err); return; }
    setMsg(`${it.name} 초기 수량을 ${draft[it.id]}개로 저장했습니다.`); router.refresh();
  };
  if (!items.length) return <p className="tiny">등록된 비품이 없습니다.</p>;
  return (
    <div className="returnCap stockSetup">
      <table>
        <thead><tr><th>비품</th><th>초기 수량</th><th>현장 조정</th><th>지급</th><th>남은 수량</th><th /></tr></thead>
        <tbody>{items.map((it) => {
          const init = draft[it.id] === "" ? NaN : Number(draft[it.id]);
          const left = (Number.isFinite(init) ? init : it.initial) + it.adjustment - it.given;
          return (
            <tr key={it.id}>
              <td>{it.name}</td>
              <td><input inputMode="numeric" value={draft[it.id]} onChange={(e) => setDraft({ ...draft, [it.id]: e.target.value.replace(/\D/g, "") })} onKeyDown={(e) => { if (e.key === "Enter" && String(it.initial) !== draft[it.id]) save(it); }} aria-label={`${it.name} 초기 수량`} /></td>
              <td className="mono">{it.adjustment > 0 ? `+${it.adjustment}` : it.adjustment}</td>
              <td className="mono">{it.given}개</td>
              <td className={`mono ${left < 0 ? "over" : left < 25 ? "zero" : ""}`}>{left}개</td>
              <td><button className="miniBtn" disabled={busy !== null || draft[it.id] === "" || String(it.initial) === draft[it.id]} onClick={() => save(it)}>{busy === it.id ? "…" : "저장"}</button></td>
            </tr>
          );
        })}</tbody>
      </table>
      {msg && <p className="tiny">{msg}</p>}
    </div>
  );
}
