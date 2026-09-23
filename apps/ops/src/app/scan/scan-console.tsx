"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { eventConfig } from "@fil/config";
import { buildSeatLayout, clampArrivedCount, needsPriorityFloor, seatLabelFor, suggestSeats } from "@fil/domain";
import type { CheckinResult, ReservationSummary, SeatMapCell } from "@fil/supabase";
import { SeatMap } from "@/components/seat-map";
import { confirmCheckin, loadSeatMap, lookupByPass, reassignSeats, searchReservations } from "./actions";

type BarcodeDetectorLike = { detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]> };
declare global { interface Window { BarcodeDetector?: new (opts?: { formats: string[] }) => BarcodeDetectorLike } }

const STATION_KEY = "fil.station";
const DEFAULT_STATION = eventConfig.stations[1].code;
const LAYOUT = buildSeatLayout();

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

export function ScanConsole() {
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState<"idle" | "on" | "unsupported" | "denied">("idle");
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<() => void>(() => {});

  const takenSet = (map: SeatMapCell[], own: string) => new Set(map.filter((c) => c.reservation_id && c.reservation_id !== own).map((c) => c.id));
  const autoPick = (map: SeatMapCell[], r: ReservationSummary, n: number) =>
    suggestSeats(LAYOUT, takenSet(map, r.id), n, needsPriorityFloor({ districtCode: r.district_code, mobilitySupport: r.mobility_support }));

  async function open(r: ReservationSummary, via: "qr" | "manual") {
    setCurrent({ r, via }); setDone(null); setError(null); setManual(false);
    setCount(r.party_size);
    setGives(Object.fromEntries(eventConfig.hospitalityItems.map((i) => [i.code, false])));
    stopRef.current();
    try {
      const map = await loadSeatMap();
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
    try { const list = await searchReservations(query.trim()); setResults(list); if (!list.length) setError("찾지 못했습니다. 다른 표기로 검색해 보세요."); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function startCamera() {
    if (!window.BarcodeDetector || !navigator.mediaDevices?.getUserMedia) { setCamera("unsupported"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const video = videoRef.current!; video.srcObject = stream; await video.play();
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      let alive = true;
      stopRef.current = () => { alive = false; stream.getTracks().forEach((t) => t.stop()); setCamera("idle"); };
      setCamera("on");
      const tick = async () => {
        if (!alive) return;
        try {
          const codes = await detector.detect(video);
          if (codes[0]?.rawValue) {
            const r = await lookupByPass(codes[0].rawValue);
            if (r) { open(r, "qr"); return; }
            setError("이 QR은 오늘 행사의 Pass가 아닙니다.");
          }
        } catch { /* keep scanning */ }
        setTimeout(tick, 350);
      };
      tick();
    } catch { setCamera("denied"); }
  }

  async function confirm() {
    if (!current) return;
    if (count > 0 && seats.length !== count) return setError(`도착 인원 ${count}명에 맞춰 좌석 ${count}개를 골라주세요. (지금 ${seats.length}개)`);
    setBusy(true); setError(null);
    try {
      const distributions = Object.fromEntries(Object.entries(gives).filter(([, on]) => on).map(([k]) => [k, count]));
      if (current.r.checkin) {
        const label = await reassignSeats(current.r.id, seats);
        setDone({ already: true, checkin_id: current.r.checkin.id, arrived_count: current.r.checkin.arrived_count, station_name: current.r.checkin.station_name, checked_in_at: current.r.checkin.checked_in_at, applicant_name: current.r.applicant_name, seat_label: label });
      } else {
        const res = await confirmCheckin({ reservationId: current.r.id, stationCode: station, arrivedCount: count, method: current.via, distributions, seatIds: seats, manual });
        setDone(res);
      }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const r = current?.r;
  const selected = new Set(seats);
  return (
    <div className="scanConsole">
      <div className="stations" role="radiogroup" aria-label="스테이션">
        {eventConfig.stations.map((s) => <button key={s.code} aria-pressed={station === s.code} onClick={() => pickStation(s.code)}>{s.name}</button>)}
      </div>

      {done ? (
        <section className={`result ${done.already ? "already" : "ok"}`}>
          <header><small>{done.already ? "이미 확인된 일행 · 좌석 갱신" : "체크인 확정"}</small><h2>{done.applicant_name} 님</h2><p>{done.station_name} · {new Date(done.checked_in_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</p></header>
          <div className="seatBig"><small>자리로 안내해 주세요</small><b>{done.seat_label ?? "좌석 미배정"}</b></div>
          <p className="kv"><span>확인된 인원</span><b>{done.arrived_count}명</b></p>
          {!done.already && <p className="tiny">10초 뒤 로비 디스플레이에 환영 메시지가 소리와 함께 나옵니다.</p>}
          <button className="btn" onClick={() => { setDone(null); setCurrent(null); setResults([]); setQuery(""); }}>다음 팀</button>
        </section>
      ) : r ? (
        <section className="result">
          <header><small>{r.code} · {current?.via === "qr" ? "QR" : "성함 조회"}{r.source === "import" ? " · 수기 등록" : ""}</small><h2>{r.applicant_name} 님{r.guest_count ? " 일행" : ""}</h2><p>{r.district_label ?? "교구 확인 필요"}{worshipLabel(r) ? ` · ${worshipLabel(r)}` : ""}</p></header>
          {r.checkin && <p className="tiny warn">이미 {r.checkin.station_name}에서 {r.checkin.arrived_count}명 확인됨. 여기서는 좌석만 바꿀 수 있고 인원은 다시 세지 않습니다.</p>}
          <div className="counter">
            <div><b>도착하신 인원</b><small>신청 {r.party_size}명 (초청자 1 · 함께 {r.guest_count})</small></div>
            <div className="stepper"><button onClick={() => changeCount(count - 1)} aria-label="한 명 빼기">−</button><span>{count}</span><button onClick={() => changeCount(count + 1)} aria-label="한 명 더하기">+</button></div>
          </div>
          <div className="flags">
            {needsPriorityFloor({ districtCode: r.district_code, mobilitySupport: r.mobility_support }) && <span className="flag acc">1층 우선 배정</span>}
            {r.dietary_note && <span className="flag diet">식이 · {r.dietary_note}</span>}
            {r.mobility_support && <span className="flag acc">우회 동선{r.mobility_note ? ` · ${r.mobility_note}` : ""}</span>}
            {r.vehicle_plate && <span className="flag park">주차 · {r.vehicle_plate}</span>}
            {r.return_label && <span className="flag ret">복귀 셔틀 {r.return_label}</span>}
          </div>
          <div className="seatPick">
            <div className="seatPickHead">
              <div><b>좌석 {seats.length}/{count}</b><small>{seats.length ? seatLabelFor(seats, LAYOUT) : "좌석표에서 골라주세요"}</small></div>
              <button type="button" className="btn small ghost" onClick={() => { setManual(false); setSeats(autoPick(cells, r, count)); }}>자동 배정</button>
            </div>
            {cells.length ? <SeatMap cells={cells} selected={selected} ownReservationId={r.id} max={count} onToggle={toggleSeat} compact /> : <p className="tiny">좌석표를 불러오는 중…</p>}
            {manual && <p className="tiny">수동으로 고른 좌석입니다. 자동 배정으로 되돌리려면 위 버튼을 누르세요.</p>}
          </div>
          <p className="kv"><span>셔틀</span><b>{r.outbound_label ? `${r.outbound_label} 창동 출발` : r.transport === "car" ? "개인 차량" : "개별 이동"}</b></p>
          {!r.checkin && (
            <div className="checks">
              {eventConfig.hospitalityItems.map((i) => <label key={i.code} className={gives[i.code] ? "on" : ""}><input type="checkbox" checked={!!gives[i.code]} onChange={(e) => setGives({ ...gives, [i.code]: e.target.checked })} /> {i.name}</label>)}
            </div>
          )}
          <button className="btn gold" onClick={confirm} disabled={busy}>{busy ? "기록 중…" : r.checkin ? "좌석 변경 확정" : "체크인 확정"}</button>
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
            {camera === "unsupported" && <p className="tiny">이 브라우저는 카메라 QR 인식을 지원하지 않습니다. 아래 성함 조회를 이용하세요.</p>}
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
