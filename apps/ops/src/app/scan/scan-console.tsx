"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import jsQR from "jsqr";
import { eventConfig } from "@fil/config";
import { buildSeatLayout, clampArrivedCount, needsPriorityFloor, seatLabelFor, suggestSeats } from "@fil/domain";
import type { CheckinResult, ReservationSummary, SeatMapCell } from "@fil/supabase";
import { SeatMap } from "@/components/seat-map";
import { addCheckinItems, bookReturn, confirmCheckin, loadCheckinItems, loadReturnBoard, loadSeatMap, lookupByPass, reassignSeats, searchReservations, voidCheckin, type Result, type ReturnRun } from "./actions";

type BarcodeDetectorLike = { detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]> };
declare global { interface Window { BarcodeDetector?: new (opts?: { formats: string[] }) => BarcodeDetectorLike } }

const STATION_KEY = "fil.station";
const DEFAULT_STATION = eventConfig.stations[1].code;
/** Not a check-in station: the return-shuttle desk (book / move / cancel a seat on a return bus). */
const RETURN_DESK = "return";
/** THE GATE (Changdong) checks people in but does not seat them — seats are given at the campus. */
const NO_SEAT_STATION = "gate";
const STATION_TABS = [...eventConfig.stations.map((s) => ({ code: s.code as string, name: s.name as string })), { code: RETURN_DESK, name: "복귀 셔틀" }];
const LAYOUT = buildSeatLayout();
/** Server actions return {ok, data | error} (thrown messages are hidden in production); turn a failure back into a throw here. */
async function ok<T>(p: Promise<Result<T>>): Promise<T> { const r = await p; if (!r.ok) throw new Error(r.error); return r.data; }

/** The station a phone was assigned to, remembered per device (external store, no effect-time setState). */
function subscribeStation(cb: () => void) { window.addEventListener("storage", cb); window.addEventListener("fil:station", cb); return () => { window.removeEventListener("storage", cb); window.removeEventListener("fil:station", cb); }; }
function readStation() { try { return localStorage.getItem(STATION_KEY) ?? DEFAULT_STATION; } catch { return DEFAULT_STATION; } }
function useStation(): [string, (code: string) => void] {
  const station = useSyncExternalStore(subscribeStation, readStation, () => DEFAULT_STATION);
  const pick = (code: string) => { try { localStorage.setItem(STATION_KEY, code); } catch {} window.dispatchEvent(new Event("fil:station")); };
  return [station, pick];
}

const worshipLabel = (r: ReservationSummary) => r.attendance === "worship"
  ? `예배만 · ${eventConfig.worshipServices.find(([c]) => c === String(r.worship_service))?.[1] ?? ""} ${eventConfig.worshipSites.find(([c]) => c === r.worship_site)?.[1] ?? ""}`.trim()
  : null;

export function ScanConsole({ isAdmin = false }: { isAdmin?: boolean }) {
  const [station, pickStation] = useStation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReservationSummary[]>([]);
  const [current, setCurrent] = useState<{ r: ReservationSummary; via: "qr" | "manual" } | null>(null);
  const [count, setCount] = useState(0);
  const [gives, setGives] = useState<Record<string, boolean>>({});
  const [cells, setCells] = useState<SeatMapCell[]>([]);
  const [seats, setSeats] = useState<string[]>([]);
  const [manual, setManual] = useState(false);
  const [done, setDone] = useState<CheckinResult | null>(null);
  const [given, setGiven] = useState<Record<string, number>>({});      // items this check-in already received
  const [added, setAdded] = useState<string[]>([]);                     // items handed out on this re-scan
  const [board, setBoard] = useState<ReturnRun[] | null>(null);         // return-shuttle seats
  const [booked, setBooked] = useState<string | null>(null);            // result message on the return desk
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState<"idle" | "on" | "unsupported" | "insecure" | "denied">("idle");
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<() => void>(() => {});
  const stationsRef = useRef<HTMLDivElement>(null);
  // keep the chosen station visible in the sideways-scrolling row (e.g. 복귀 셔틀 at the far right)
  useEffect(() => { stationsRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" }); }, [station]);

  const takenSet = (map: SeatMapCell[], own: string) => new Set(map.filter((c) => c.reservation_id && c.reservation_id !== own).map((c) => c.id));
  const autoPick = (map: SeatMapCell[], r: ReservationSummary, n: number) =>
    suggestSeats(LAYOUT, takenSet(map, r.id), n, needsPriorityFloor({ districtCode: r.district_code, mobilitySupport: r.mobility_support }));

  async function open(r: ReservationSummary, via: "qr" | "manual") {
    setCurrent({ r, via }); setDone(null); setError(null); setManual(false); setGiven({}); setAdded([]); setBooked(null);
    setCount(r.checkin ? r.checkin.arrived_count : r.party_size);
    setGives(Object.fromEntries(eventConfig.hospitalityItems.map((i) => [i.code, false])));
    stopRef.current();
    if (station === RETURN_DESK) {
      try { setBoard(await ok(loadReturnBoard())); } catch (e) { setError((e as Error).message); }
      return;
    }
    if (r.checkin) {
      try { setGiven(await ok(loadCheckinItems(r.checkin.id))); } catch (e) { setError((e as Error).message); }
    }
    if (station === NO_SEAT_STATION) return;            // no seat chart at THE GATE
    try {
      const map = await ok(loadSeatMap());
      setCells(map);
      setSeats(r.seat_ids?.length ? r.seat_ids : autoPick(map, r, r.party_size));
    } catch (e) { setError((e as Error).message); }
  }

  function changeCount(n: number) {
    if (!current) return;
    const next = clampArrivedCount(n, current.r.party_size);
    setCount(next);
    if (!manual) setSeats(autoPick(cells, current.r, next));
    else setSeats((s) => s.slice(0, next));
  }

  function toggleSeat(id: string) {
    setManual(true);
    setSeats((s) => s.includes(id) ? s.filter((x) => x !== id) : s.length >= count ? [...s.slice(1), id] : [...s, id]);
  }

  async function find() {
    if (query.trim().length < 2) return setError("성함 두 글자 이상 또는 연락처 뒤 4자리를 넣어주세요.");
    setBusy(true); setError(null);
    try { const list = await ok(searchReservations(query.trim())); setResults(list); if (!list.length) setError("찾지 못했습니다. 다른 표기로 검색해 보세요."); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) { setCamera(window.isSecureContext ? "unsupported" : "insecure"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const video = videoRef.current!; video.srcObject = stream; await video.play();
      // Chrome/Android: native BarcodeDetector. iOS Safari: decode frames with jsQR on a canvas.
      const native = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
      const canvas = document.createElement("canvas"); const ctx = canvas.getContext("2d", { willReadFrequently: true });
      let alive = true;
      stopRef.current = () => { alive = false; stream.getTracks().forEach((t) => t.stop()); setCamera("idle"); };
      setCamera("on");
      const decode = async (): Promise<string | null> => {
        if (native) { const codes = await native.detect(video); return codes[0]?.rawValue ?? null; }
        if (!ctx || !video.videoWidth) return null;
        const w = Math.min(640, video.videoWidth), h = Math.round(video.videoHeight * (w / video.videoWidth));
        canvas.width = w; canvas.height = h; ctx.drawImage(video, 0, 0, w, h);
        const img = ctx.getImageData(0, 0, w, h);
        return jsQR(img.data, w, h, { inversionAttempts: "dontInvert" })?.data ?? null;
      };
      const tick = async () => {
        if (!alive) return;
        try {
          const raw = await decode();
          if (raw) {
            const r = await ok(lookupByPass(raw));
            if (r) { open(r, "qr"); return; }
            setError("이 QR은 오늘 행사의 Pass가 아닙니다.");
          }
        } catch { /* keep scanning */ }
        setTimeout(tick, native ? 350 : 220);
      };
      tick();
    } catch { setCamera("denied"); }
  }

  async function confirm() {
    if (!current) return;
    const seatless = station === NO_SEAT_STATION;
    if (!seatless && count > 0 && seats.length !== count) return setError(`도착 인원 ${count}명에 맞춰 좌석 ${count}개를 골라주세요. (지금 ${seats.length}개)`);
    setBusy(true); setError(null);
    try {
      // only items not already received; quantity = people checked in
      const fresh = Object.entries(gives).filter(([k, on]) => on && !given[k]).map(([k]) => k);
      const distributions = Object.fromEntries(fresh.map((k) => [k, count]));
      if (current.r.checkin) {
        const ck = current.r.checkin;
        if (fresh.length) await ok(addCheckinItems(ck.id, distributions));
        const label = seatless ? current.r.seat_label : await ok(reassignSeats(current.r.id, seats));
        setAdded(fresh);
        setDone({ already: true, checkin_id: ck.id, arrived_count: ck.arrived_count, station_name: ck.station_name, checked_in_at: ck.checked_in_at, applicant_name: current.r.applicant_name, seat_label: label });
      } else {
        const res = await ok(confirmCheckin({ reservationId: current.r.id, stationCode: station, arrivedCount: count, method: current.via, distributions, seatIds: seatless ? [] : seats, manual: seatless ? false : manual }));
        setAdded(fresh);
        setDone(res);
      }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function book(runId: string | null) {
    if (!current) return;
    setBusy(true); setError(null);
    try {
      const next = await ok(bookReturn(current.r.id, runId));
      setBoard(next);
      const label = runId ? next.find((x) => x.id === runId)?.label ?? "" : null;
      setCurrent({ ...current, r: { ...current.r, return_label: label } });
      setBooked(runId ? `${label} 복귀 셔틀 ${current.r.party_size}석을 예약했습니다.` : "복귀 셔틀 예약을 취소했습니다.");
    } catch (e) { setError((e as Error).message); try { setBoard(await ok(loadReturnBoard())); } catch {} } finally { setBusy(false); }
  }

  const r = current?.r;
  const selected = new Set(seats);
  return (
    <div className="scanConsole">
      <div className="stations" ref={stationsRef} role="radiogroup" aria-label="스테이션">
        {STATION_TABS.map((s) => <button key={s.code} aria-pressed={station === s.code} onClick={() => { pickStation(s.code); setCurrent(null); setDone(null); setError(null); }}>{s.name}</button>)}
      </div>
      {station === NO_SEAT_STATION && <p className="note stationNote">창동 THE GATE에서는 좌석을 배정하지 않습니다. 좌석은 주차장 THE LANDING 또는 채플 웰컴센터에서 체크인할 때 배정됩니다.</p>}
      {station === RETURN_DESK && <p className="note stationNote">복귀 셔틀 데스크입니다. QR이나 성함으로 일행을 찾아 복귀 셔틀 좌석을 예약·변경·취소합니다. 체크인은 기록하지 않습니다.</p>}

      {done ? (
        <section className={`result ${done.already ? "already" : "ok"}`}>
          <header><small>{done.already ? "이미 확인된 일행 · 갱신 완료" : "체크인 확정"}</small><h2>{done.applicant_name} 님</h2><p>{done.station_name} · {new Date(done.checked_in_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</p></header>
          <div className="seatBig"><small>{station === NO_SEAT_STATION ? "좌석은 캠퍼스에서 배정됩니다" : "자리로 안내해 주세요"}</small><b>{done.seat_label ?? (station === NO_SEAT_STATION ? "THE LANDING · 채플에서 배정" : "좌석 미배정")}</b></div>
          {added.length > 0 && <p className="kv"><span>{done.already ? "추가 지급" : "지급 비품"}</span><b>{added.map((c) => eventConfig.hospitalityItems.find((i) => i.code === c)?.name).join(", ")}</b></p>}
          <p className="kv"><span>확인된 인원</span><b>{done.arrived_count}명</b></p>
          {!done.already && <p className="tiny">로비 디스플레이에 환영 메시지가 소리와 함께 바로 나옵니다.</p>}
          <button className="btn" onClick={() => { setDone(null); setCurrent(null); setResults([]); setQuery(""); }}>다음 팀</button>
        </section>
      ) : r && station === RETURN_DESK ? (
        <section className="result">
          <header><small>{r.code} · 복귀 셔틀</small><h2>{r.applicant_name} 님{r.guest_count ? " 일행" : ""}</h2><p>{r.party_size}명 · 현재 {r.return_label ? `${r.return_label} 예약됨` : "복귀 셔틀 예약 없음"}</p></header>
          {booked && <p className="kv"><span>완료</span><b>{booked}</b></p>}
          {board === null ? <p className="tiny">{error ? "좌석 현황을 불러오지 못했습니다. 아래 안내를 확인해 주세요." : "좌석 현황을 불러오는 중…"}</p> : (
            <ul className="returnRuns">
              {board.map((run) => {
                const mine = r.return_label === run.label;
                const free = run.available + (mine ? r.party_size : 0);   // own seats count as free when moving
                const fits = free >= r.party_size;
                return (
                  <li key={run.id} className={mine ? "mine" : fits ? "" : "full"}>
                    <div><b>{run.label} 출발</b><small>{run.capacity}석 중 {run.booked}석 예약 · <em>{run.available > 0 ? `남은 좌석 ${run.available}석` : "좌석 없음"}</em></small></div>
                    {mine ? <span className="tag in">예약됨</span>
                      : fits ? <button className="btn small gold" disabled={busy} onClick={() => book(run.id)}>{r.return_label ? "이 편으로 변경" : `${r.party_size}석 예약`}</button>
                      : <span className="tag">{run.available > 0 ? `${run.available}석뿐 · 부족` : "좌석 없음"}</span>}
                  </li>
                );
              })}
              {!board.length && <li><small>운행하는 복귀 셔틀이 없습니다.</small></li>}
            </ul>
          )}
          {r.return_label && <button className="btn ghost danger" disabled={busy} onClick={() => { if (window.confirm(`${r.applicant_name} 님 일행의 ${r.return_label} 복귀 셔틀 예약을 취소할까요?`)) book(null); }}>복귀 셔틀 예약 취소</button>}
          <button className="btn" onClick={() => { setCurrent(null); setResults([]); setQuery(""); setBooked(null); }}>다음 팀</button>
          {error && <p className="tiny warn">{error}</p>}
        </section>
      ) : r ? (
        <section className="result">
          <header><small>{r.code} · {current?.via === "qr" ? "QR" : "성함 조회"}{r.source === "import" ? " · 수기 등록" : ""}</small><h2>{r.applicant_name} 님{r.guest_count ? " 일행" : ""}</h2><p>{r.district_label ?? "교구 확인 필요"}{worshipLabel(r) ? ` · ${worshipLabel(r)}` : ""}</p></header>
          {r.checkin && <p className="tiny warn">이미 {r.checkin.station_name}에서 {r.checkin.arrived_count}명 확인됨. 인원은 다시 세지 않습니다. {station === NO_SEAT_STATION ? "못 받은 비품만 추가로 체크하세요." : "좌석 배정·변경과 못 받은 비품 추가만 할 수 있습니다."}</p>}
          {!r.checkin && <div className="counter">
            <div><b>도착하신 인원</b><small>신청 {r.party_size}명 (초청자 1 · 함께 {r.guest_count})</small></div>
            <div className="stepper"><button onClick={() => changeCount(count - 1)} aria-label="한 명 빼기">−</button><span>{count}</span><button onClick={() => changeCount(count + 1)} aria-label="한 명 더하기">+</button></div>
          </div>}
          <div className="flags">
            {needsPriorityFloor({ districtCode: r.district_code, mobilitySupport: r.mobility_support }) && <span className="flag acc">1층 우선 배정</span>}
            {r.dietary_note && <span className="flag diet">식이 · {r.dietary_note}</span>}
            {r.mobility_support && <span className="flag acc">우회 동선{r.mobility_note ? ` · ${r.mobility_note}` : ""}</span>}
            {r.vehicle_plate && <span className="flag park">주차 · {r.vehicle_plate}</span>}
            {r.return_label && <span className="flag ret">복귀 셔틀 {r.return_label}</span>}
          </div>
          {station === NO_SEAT_STATION ? (
            <div className="gateSeatNote"><b>좌석 배정 없음</b><small>창동 THE GATE에서는 체크인만 합니다. 좌석은 주차장 THE LANDING 또는 채플 웰컴센터에서 배정됩니다.</small></div>
          ) : (
          <div className="seatPick">
            <div className="seatPickHead">
              <div><b>좌석 {seats.length}/{count}</b><small>{seats.length ? seatLabelFor(seats, LAYOUT) : "좌석표에서 골라주세요"}</small></div>
              <button type="button" className="btn small ghost" onClick={() => { setManual(false); setSeats(autoPick(cells, r, count)); }}>자동 배정</button>
            </div>
            {cells.length ? <SeatMap cells={cells} selected={selected} ownReservationId={r.id} max={count} onToggle={toggleSeat} compact /> : <p className="tiny">좌석표를 불러오는 중…</p>}
            {manual && <p className="tiny">수동으로 고른 좌석입니다. 자동 배정으로 되돌리려면 위 버튼을 누르세요.</p>}
          </div>
          )}
          <p className="kv"><span>셔틀</span><b>{r.outbound_label ? `${r.outbound_label} 창동 출발` : r.transport === "car" ? "개인 차량" : "개별 이동"}</b></p>
          <div className="checks">
            {eventConfig.hospitalityItems.map((i) => {
              const had = !!given[i.code];
              return (
                <label key={i.code} className={had ? "on had" : gives[i.code] ? "on" : ""}>
                  <input type="checkbox" checked={had || !!gives[i.code]} disabled={had} onChange={(e) => setGives({ ...gives, [i.code]: e.target.checked })} /> {i.name}{had && <small> · 수령 완료</small>}
                </label>
              );
            })}
          </div>
          {r.checkin && <p className="tiny">이미 받은 비품은 잠겨 있습니다. 못 받은 비품을 체크하면 추가로 기록됩니다.</p>}
          <button className="btn gold" onClick={confirm} disabled={busy}>{busy ? "기록 중…" : r.checkin ? (station === NO_SEAT_STATION ? "비품 추가 확정" : "좌석·비품 갱신 확정") : "체크인 확정"}</button>
          {r.checkin && isAdmin && (
            <button className="btn ghost danger" disabled={busy} onClick={async () => {
              if (!window.confirm(`${r.applicant_name} 님의 체크인을 취소하고 좌석을 비울까요?`)) return;
              setBusy(true); setError(null);
              try { await ok(voidCheckin(r.checkin!.id, r.id)); setCurrent(null); setResults([]); setQuery(""); }
              catch (e) { setError((e as Error).message); } finally { setBusy(false); }
            }}>체크인 취소 (관리자)</button>
          )}
          <button className="btn ghost" onClick={() => setCurrent(null)}>취소</button>
          {error && <p className="tiny warn">{error}</p>}
        </section>
      ) : (
        <>
          <div className="scanBox">
            <video ref={videoRef} playsInline muted hidden={camera !== "on"} />
            {camera !== "on" && (
              <button className="btn" onClick={startCamera}>카메라로 QR 스캔</button>
            )}
            {camera === "on" && <button className="btn ghost small" onClick={() => stopRef.current()}>카메라 끄기</button>}
            {camera === "unsupported" && <p className="tiny">이 브라우저는 카메라를 지원하지 않습니다. 아래 성함 조회를 이용하세요.</p>}
            {camera === "insecure" && <p className="tiny warn">카메라는 https 주소에서만 열립니다. 터널(https) 주소로 접속하거나 성함 조회를 이용하세요.</p>}
            {camera === "denied" && <p className="tiny">카메라 권한이 거부되었습니다. 브라우저 설정에서 허용한 뒤 다시 시도하세요.</p>}
          </div>
          <div className="or">QR이 없을 때 · 수기 신청자도 여기서</div>
          <div className="row">
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && find()} placeholder="성함 또는 연락처 뒤 4자리" inputMode="search" aria-label="성함 또는 연락처 뒤 4자리" />
            <button className="btn small" onClick={find} disabled={busy}>찾기</button>
          </div>
          {error && <p className="tiny warn">{error}</p>}
          <ul className="hits">
            {results.map((x) => (
              <li key={x.id}><button onClick={() => open(x, "manual")}><b>{x.applicant_name} 님 {x.party_size}명</b><span>{x.district_label ?? "교구 확인 필요"} · {x.seat_label ?? "좌석 미배정"}{x.checkin ? " · 확인됨" : ""}{worshipLabel(x) ? ` · ${worshipLabel(x)}` : ""}</span></button></li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
