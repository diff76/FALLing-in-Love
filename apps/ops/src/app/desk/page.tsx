import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase-server";
import { OpsShell } from "@/components/ops-shell";
import { LiveRefresh } from "@/components/live-refresh";
import { districtName, eventConfig } from "@fil/config";
import type { OpsStats } from "@fil/supabase";
import { StockRow } from "./stock-row";

export const dynamic = "force-dynamic";

/**
 * Welcome desk board (tablet): the next shuttle and what to prepare for it, who was just
 * greeted, who is still expected, and hospitality stock. Reads only — attendance is
 * written by the staff scan alone.
 */
export default async function DeskPage() {
  const session = await requireRole("desk", "admin");
  const db = await supabaseServer();
  const [statsRes, rowsRes, runsRes, checkinsRes, stationsRes, itemsRes, givenRes, seatRes] = db ? await Promise.all([
    db.rpc("ops_stats"),
    db.from("reservations").select("id, code, applicant_name, party_size, district_code, mobility_support, mobility_note, dietary_note, vehicle_plate, outbound_run_id, transport, attendance, worship_service, worship_site").eq("status", "active").order("created_at").limit(1000),
    db.from("shuttle_runs").select("id, label, direction, active").eq("direction", "outbound").eq("active", true).order("departs_at"),
    db.from("checkins").select("id, arrived_count, checked_in_at, reservation_id, station_id").is("voided_at", null).order("checked_in_at", { ascending: false }),
    db.from("stations").select("id, name"),
    db.from("hospitality_items").select("id, code, name, initial_stock, adjustment").order("code"),
    db.from("hospitality_distributions").select("checkin_id, item_id, qty"),
    db.from("seat_assignments").select("reservation_id, seat_id"),
  ]) : [null, null, null, null, null, null, null, null];
  const stats = (statsRes?.data ?? null) as OpsStats | null;
  const rows = rowsRes?.data ?? [];
  const runs = runsRes?.data ?? [];
  const checkins = checkinsRes?.data ?? [];
  const stations = stationsRes?.data ?? [];
  const items = itemsRes?.data ?? [];
  const given = givenRes?.data ?? [];
  const seatRows = seatRes?.data ?? [];

  const byId = new Map(rows.map((r) => [r.id, r]));
  const stationName = new Map(stations.map((s) => [s.id, s.name]));
  const runLabel = new Map(runs.map((r) => [r.id, r.label]));
  const arrivedIds = new Set(checkins.map((c) => c.reservation_id));
  const seatsOf = (id: string) => seatRows.filter((s) => s.reservation_id === id).map((s) => s.seat_id).sort().join(", ");
  const givenOf = (checkinId: string) => given.filter((g) => g.checkin_id === checkinId && g.qty > 0).map((g) => items.find((i) => i.id === g.item_id)?.name.split(" ")[0] ?? "").filter(Boolean);
  const stockLeft = (item: { id: string; initial_stock: number; adjustment: number }) => item.initial_stock + item.adjustment - given.filter((g) => g.item_id === item.id).reduce((n, g) => n + g.qty, 0);

  // Next shuttle: first outbound run that has not yet arrived (departure + ride time), Seoul time.
  const now = new Date();
  const hhmm = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" });
  const minutesNow = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const nextRun = runs.find((r) => toMin(r.label) + eventConfig.shuttle.rideMinutes > minutesNow) ?? null;
  const onNext = nextRun ? rows.filter((r) => r.outbound_run_id === nextRun.id && !arrivedIds.has(r.id)) : [];
  const nextPax = onNext.reduce((n, r) => n + r.party_size, 0), nextGuests = onNext.reduce((n, r) => n + r.party_size - 1, 0);
  const eta = nextRun ? toMin(nextRun.label) + eventConfig.shuttle.rideMinutes - minutesNow : null;
  const prepAcc = onNext.filter((r) => r.mobility_support), prepPark = onNext.filter((r) => r.vehicle_plate), prepDiet = onNext.filter((r) => r.dietary_note);

  const recent = checkins.slice(0, 8);
  const pending = rows.filter((r) => !arrivedIds.has(r.id) && r.attendance === "main");
  const arrivedTeams = checkins.length, arrivedPeople = checkins.reduce((n, c) => n + c.arrived_count, 0);

  return (
    <OpsShell eyebrow="Desk · Tablet" title="웰컴 데스크 상황판" roles={session.roles} email={session.email} wide>
      <LiveRefresh />
      <p className="stamp"><i /> {hhmm} 기준 · 기록하지 않고 보여주기만 합니다 · 스캔이 들어올 때마다 갱신</p>
      <div className="cols deskCols">
        <div className="stack">
          <section className="hero">
            {nextRun ? (
              <>
                <div className="heroTop">
                  <div className="heroRun">{nextRun.label} 편<small>{eventConfig.origin.name} 출발 · 약 {eventConfig.shuttle.rideMinutes}분</small></div>
                  <div className="heroEta"><span>도착까지</span><b className={eta !== null && eta <= 5 ? "soon" : ""}>{eta !== null && eta <= 0 ? "도착함" : `${eta}분 후`}</b></div>
                </div>
                <div className="heroNums">
                  <div><span>탑승 예정</span><b>{nextPax}<em>명</em></b></div>
                  <div><span>신청 팀</span><b>{onNext.length}<em>팀</em></b></div>
                  <div><span>처음 오시는 분</span><b>{nextGuests}<em>명</em></b></div>
                </div>
                <p className="breakdown">초청 성도 {onNext.length}명 + 처음 오시는 분 {nextGuests}명 = {nextPax}명</p>
                <div className="prep">
                  <div className="lbl">이 편에서 미리 준비할 것</div>
                  {prepAcc.length > 0 && <div className="prepItem acc"><span className="ic">이동 도움</span><span><b>{prepAcc.length}팀</b> — {prepAcc.map((r) => r.applicant_name).join(", ")} 님 일행. {prepAcc.map((r) => r.mobility_note).filter(Boolean).join(" · ") || "1층 우선 좌석으로 안내합니다."}</span></div>}
                  {prepPark.length > 0 && <div className="prepItem park"><span className="ic">주차</span><span><b>{prepPark.length}팀</b>이 차량으로 오십니다.</span></div>}
                  {prepDiet.length > 0 && <div className="prepItem diet"><span className="ic">식이</span><span><b>{prepDiet.length}팀</b>에 가리시는 음식이 있습니다. 테이블 담당에게 전달하세요.</span></div>}
                  {!prepAcc.length && !prepPark.length && !prepDiet.length && <div className="prepNone">특별히 준비할 것 없이 평소대로 맞이하시면 됩니다.</div>}
                </div>
              </>
            ) : (
              <>
                <div className="heroTop"><div className="heroRun">마지막 편 도착 완료<small>더 들어올 셔틀이 없습니다</small></div></div>
                <div className="prepNone">개인 차량으로 오시는 분만 남았습니다.</div>
              </>
            )}
            <p className="breakdown center">참석 확인은 봉사자 휴대폰 스캔으로만 기록됩니다.</p>
          </section>

          <section className="box">
            <h2>방금 맞이한 분들 <small>화면에 {recent.length}팀 · {recent.reduce((n, c) => n + c.arrived_count, 0)}명 / 전체 {arrivedTeams}팀</small></h2>
            <p className="sub">체크인 때 지급한 비품이 함께 표시됩니다</p>
            {recent.length ? recent.map((c) => {
              const r = byId.get(c.reservation_id);
              return (
                <div className="rrow" key={c.id}>
                  <div className="nm"><b>{r?.applicant_name ?? "—"} 님{r && r.party_size > 1 ? " 일행" : ""}</b><span>{new Date(c.checked_in_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} · {districtName(r?.district_code)} · {seatsOf(c.reservation_id) || "좌석 미배정"} · {stationName.get(c.station_id) ?? ""}</span></div>
                  <div className="cnt">{c.arrived_count}<em>명</em></div>
                  <div className="give">{givenOf(c.id).length ? givenOf(c.id).map((g) => <i key={g} className="on">{g}</i>) : <i>미지급</i>}</div>
                </div>
              );
            }) : <p className="hint">아직 맞이한 분이 없습니다.</p>}
          </section>
        </div>

        <div className="stack">
          <section className="box">
            <h2>지금 상황</h2><p className="sub">스캔 결과가 실시간으로 반영됩니다</p>
            <div className="statline">
              {(stats?.by_station ?? []).map((s) => <span className="stat" key={s.name}>{s.name} <b>{s.arrived}</b>명</span>)}
              <span className="stat">전체 도착 <b>{arrivedTeams}</b>팀 · <b>{arrivedPeople}</b>명</span>
              <span className="stat">남은 신청 <b>{pending.length}</b>팀</span>
              <span className="stat">이동 도움 대기 <b>{pending.filter((r) => r.mobility_support).length}</b>팀</span>
              <span className="stat">좌석 배정 <b>{stats?.seated_people ?? "—"}</b>석</span>
            </div>
          </section>

          <section className="box">
            <h2>아직 안 오신 분 <small>{pending.length}팀</small></h2><p className="sub">예정 셔틀 편과 함께 표시됩니다</p>
            <div className="plist">
              {pending.length ? pending.slice(0, 60).map((r) => (
                <div className="prow" key={r.id}>
                  <div className="nm">{r.applicant_name} 님 {r.party_size}명<span>{districtName(r.district_code)}</span></div>
                  {r.mobility_support && <span className="chip acc">도움</span>}
                  {r.dietary_note && <span className="chip diet">식이</span>}
                  {r.vehicle_plate && <span className="chip park">주차</span>}
                  <div className="sh">{r.outbound_run_id ? runLabel.get(r.outbound_run_id) ?? "셔틀" : r.transport === "car" ? "자차" : "개별"}</div>
                </div>
              )) : <p className="hint">모두 도착했습니다.</p>}
            </div>
          </section>

          <section className="box">
            <h2>비품 남은 수량</h2><p className="sub">체크인 때 지급한 수량은 자동으로 빠집니다. 실물과 다르면 +/−로 맞추세요.</p>
            {items.map((it) => <StockRow key={it.id} id={it.id} name={it.name} qty={stockLeft(it)} />)}
          </section>
        </div>
      </div>
      <p className="tiny">이 화면은 게스트 쪽에서 보이지 않도록 방향을 잡아주세요. 식이·이동 정보가 그대로 표시됩니다.</p>
    </OpsShell>
  );
}
