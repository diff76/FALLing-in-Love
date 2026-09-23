"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient, isSupabaseConfigured, type ParkingBoard } from "@fil/supabase";
import { adjustParking, loadParking, markVipArrived } from "./actions";

/**
 * Parking desk: free bays = capacity − occupied (both editable in one tap), plus the
 * "VIP expected" board — every invited guest who gave a plate gets a button; tapping it asks
 * for confirmation that THIS car has arrived. Live across devices via realtime.
 */
export function ParkingDesk({ initial }: { initial: ParkingBoard | null }) {
  const [board, setBoard] = useState<ParkingBoard | null>(initial);
  const [capacityDraft, setCapacityDraft] = useState<string>(initial ? String(initial.state.capacity) : "");
  const [ask, setAsk] = useState<ParkingBoard["vehicles"][number] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => { try { setBoard(await loadParking()); } catch (e) { setError((e as Error).message); } };

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const db = createBrowserSupabaseClient();
    const ch = db.channel("parking")
      .on("postgres_changes", { event: "*", schema: "public", table: "parking_state" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "vip_arrivals" }, reload)
      .subscribe();
    const t = setInterval(reload, 30_000);
    return () => { db.removeChannel(ch); clearInterval(t); };
  }, []);

  async function bump(delta: number) {
    setBusy(true); setError(null);
    try { const state = await adjustParking(delta); setBoard((b) => b ? { ...b, state } : b); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function saveCapacity() {
    const n = Number(capacityDraft);
    if (!Number.isFinite(n) || n < 0) return setError("전체 가능 대수를 숫자로 넣어주세요.");
    setBusy(true); setError(null);
    try { const state = await adjustParking(0, Math.round(n)); setBoard((b) => b ? { ...b, state } : b); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function confirmArrival(v: ParkingBoard["vehicles"][number], arrived: boolean) {
    setBusy(true); setError(null);
    try { await markVipArrived(v.reservation_id, arrived); if (arrived) await adjustParking(1); setAsk(null); await reload(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const s = board?.state;
  const free = s ? s.capacity - s.occupied : null;
  const vips = board?.vehicles.filter((v) => v.vip) ?? [];
  const others = board?.vehicles.filter((v) => !v.vip) ?? [];
  const expected = vips.filter((v) => !v.arrived_at), arrived = vips.filter((v) => v.arrived_at);

  return (
    <div className="parking">
      <section className={`parkBig ${free !== null && free <= 5 ? "low" : ""}`}>
        <small>현재 주차 가능 대수</small>
        <b>{free ?? "—"}<em>대</em></b>
        <p>전체 {s?.capacity ?? "—"}대 · 현재 주차 {s?.occupied ?? "—"}대</p>
      </section>
      <div className="parkControls">
        <div className="parkCounter">
          <span>현재 주차 대수</span>
          <div className="stepper big"><button onClick={() => bump(-1)} disabled={busy} aria-label="한 대 빼기">−</button><span>{s?.occupied ?? "—"}</span><button onClick={() => bump(1)} disabled={busy} aria-label="한 대 더하기">+</button></div>
        </div>
        <label className="parkCapacity"><span>전체 가능 대수</span>
          <div className="row"><input inputMode="numeric" value={capacityDraft} onChange={(e) => setCapacityDraft(e.target.value)} /><button className="btn small" onClick={saveCapacity} disabled={busy}>저장</button></div>
        </label>
      </div>
      {error && <p className="tiny warn">{error}</p>}

      <section className="box">
        <h2>VIP 주차 예정 <small>{expected.length}대 대기 · {arrived.length}대 도착</small></h2>
        <p className="tiny">참여 신청에서 차량 번호를 남긴 초대 손님입니다. 차가 들어오면 번호판 버튼을 눌러 확인하세요.</p>
        <div className="plateGrid">
          {expected.map((v) => (
            <button key={v.reservation_id} className="plate" onClick={() => setAsk(v)}>
              <b>{v.plate}</b><span>{v.name} 님 {v.party_size}명{v.district_label ? ` · ${v.district_label}` : ""}</span>
            </button>
          ))}
          {!expected.length && <p className="tiny">대기 중인 VIP 차량이 없습니다.</p>}
        </div>
        {arrived.length > 0 && (
          <>
            <h3>도착 완료</h3>
            <div className="plateGrid">
              {arrived.map((v) => (
                <button key={v.reservation_id} className="plate done" onClick={() => setAsk(v)}>
                  <b>{v.plate}</b><span>{v.name} 님 · {new Date(v.arrived_at!).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}{v.checked_in ? " · 체크인됨" : ""}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
      {others.length > 0 && (
        <section className="box">
          <h2>기타 등록 차량 <small>{others.length}대</small></h2>
          <ul className="list">{others.map((v) => <li key={v.reservation_id}><b>{v.plate}</b><span>{v.name} 님{v.checked_in ? " · 체크인됨" : ""}</span></li>)}</ul>
        </section>
      )}

      {ask && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modalCard">
            <small>{ask.arrived_at ? "도착 취소" : "도착 확인"}</small>
            <h2>{ask.plate}</h2>
            <p>{ask.name} 님 · {ask.party_size}명{ask.district_label ? ` · ${ask.district_label}` : ""}</p>
            <p>{ask.arrived_at ? "이 차량의 도착 기록을 지울까요?" : "이 차량이 지금 도착한 것이 맞습니까? 확인하면 주차 대수도 1 늘어납니다."}</p>
            <button className="btn gold" disabled={busy} onClick={() => confirmArrival(ask, !ask.arrived_at)}>{ask.arrived_at ? "도착 취소" : "네, 도착했습니다"}</button>
            <button className="btn ghost" onClick={() => setAsk(null)}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
