import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase-server";
import { OpsShell } from "@/components/ops-shell";
import { LiveRefresh } from "@/components/live-refresh";
import type { OpsStats } from "@fil/supabase";
import { districtName, eventConfig } from "@fil/config";
import { ReservationAction } from "./reservation-actions";
import { ReturnCapacity } from "./return-capacity";
import { StockSetup } from "./stock-setup";

export const dynamic = "force-dynamic";

/** Horizontal bar with an optional filled "done" portion (checked-in over expected). */
function Bar({ label, value, done, max, unit, tone }: { label: string; value: number; done?: number; max: number; unit?: string; tone?: "green" | "gold" }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const d = max > 0 && done != null ? Math.min(100, (done / max) * 100) : 0;
  return (
    <li className={`bar ${tone ?? "green"}`}>
      <span className="barLabel">{label}</span>
      <span className="barTrack"><i className="expected" style={{ width: `${w}%` }} />{done != null && <i className="done" style={{ width: `${d}%` }} />}</span>
      <b>{done != null ? <>{done}<i>/{value}</i></> : value}{unit ? <em>{unit}</em> : null}</b>
    </li>
  );
}

export default async function AdminPage() {
  const session = await requireRole("admin");
  const db = await supabaseServer();
  const [statsRes, rowsRes, membersRes, checkinsRes, cancelledRes, returnRunsRes, itemsRes, givenRes] = db ? await Promise.all([
    db.rpc("ops_stats"),
    db.from("reservations").select("id, code, applicant_name, kind, inviter_name, district_code, age_group, party_size, transport, mobility_support, dietary_note, vehicle_plate, contact_consent, return_run_id, attendance, worship_service, worship_site, source, created_at").eq("status", "active").order("created_at", { ascending: false }).limit(1000),
    db.from("reservation_members").select("reservation_id, age_group"),
    db.from("checkins").select("reservation_id, arrived_count, station_id").is("voided_at", null),
    db.from("reservations").select("id, code, applicant_name, district_code, party_size, source, created_at").eq("status", "cancelled").order("created_at", { ascending: false }).limit(200),
    db.from("shuttle_runs").select("id, label, capacity").eq("direction", "return").eq("active", true).order("departs_at"),
    db.from("hospitality_items").select("id, code, name, initial_stock, adjustment"),
    db.from("hospitality_distributions").select("item_id, qty"),
  ]) : [null, null, null, null, null, null, null, null];
  const stats = (statsRes?.data ?? null) as OpsStats | null;
  const rows = rowsRes?.data ?? [];
  const members = membersRes?.data ?? [];
  const checkins = checkinsRes?.data ?? [];
  const cancelled = cancelledRes?.data ?? [];
  const returnRuns = (returnRunsRes?.data ?? []).map((r) => ({ ...r, capacity: r.capacity ?? eventConfig.shuttle.returnSeats, booked: rows.filter((x) => x.return_run_id === r.id).reduce((n, x) => n + x.party_size, 0) }));
  // hospitality items in config order (retired codes such as the brochure stay hidden, as on the desk)
  const stockItems = eventConfig.hospitalityItems.flatMap((c) => {
    const it = (itemsRes?.data ?? []).find((x) => x.code === c.code);
    return it ? [{ id: it.id, name: it.name, initial: it.initial_stock, adjustment: it.adjustment, given: (givenRes?.data ?? []).filter((g) => g.item_id === it.id).reduce((n, g) => n + g.qty, 0) }] : [];
  });
  const arrived = new Map(checkins.map((c) => [c.reservation_id, c.arrived_count]));

  // 참석자 구분 — VIP: 초대받아 직접 신청한 분 + "함께 오시는 분". 인도자: VIP와 함께 온 초청자, 또는 직접 신청한 VIP가
  // 초대자로 적은 분(같은 이름의 초청자가 한 명뿐일 때). 일반 성도: 그 밖의 초청자(혼자 오신 분).
  // 체크인 기준은 실제로 온 사람으로 나눕니다: 일행 중 VIP가 오지 않았으면 그 초청자는 일반 성도로 셉니다.
  const norm = (n: string | null) => (n ?? "").replace(/\s+/g, "");
  const hostNames = new Map<string, number>();
  rows.forEach((r) => { if (r.kind === "host") hostNames.set(norm(r.applicant_name), (hostNames.get(norm(r.applicant_name)) ?? 0) + 1); });
  const invitedBy = new Map<string, { reg: boolean; came: boolean }>();   // host name → has a self-registered VIP (who came?)
  rows.forEach((r) => {
    const n = norm(r.inviter_name);
    if (r.kind !== "guest_self" || !n || hostNames.get(n) !== 1) return;
    const cur = invitedBy.get(n) ?? { reg: false, came: false };
    invitedBy.set(n, { reg: true, came: cur.came || (arrived.get(r.id) ?? 0) > 0 });
  });
  const roles = { member: { reg: 0, in: 0 }, leader: { reg: 0, in: 0 }, vip: { reg: 0, in: 0 } };
  rows.forEach((r) => {
    const came = arrived.get(r.id) ?? 0;
    if (r.kind === "guest_self") { roles.vip.reg += r.party_size; roles.vip.in += came; return; }
    const linked = invitedBy.get(norm(r.applicant_name));
    const companions = r.party_size - 1;
    if (companions > 0 || linked?.reg) { roles.leader.reg += 1; roles.vip.reg += companions; } else roles.member.reg += 1;
    if (came > 0) {
      const vipsCame = came - 1;
      if (vipsCame > 0 || linked?.came) roles.leader.in += 1; else roles.member.in += 1;
      roles.vip.in += vipsCame;
    }
  });
  const rate = stats && stats.people ? Math.round((stats.checked_in_people / stats.people) * 100) : 0;
  const stamp = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

  // Age groups: every named person we know an age for (hosts + companions)
  const ages = new Map<string, number>(eventConfig.ageGroups.map((a) => [a, 0]));
  // Rows saved before 2026-09-27 carry the old top bucket "60대 이상"; count them under 60대.
  const bucket = (a: string | null) => (a === "60대 이상" ? "60대" : a);
  rows.forEach((r) => { const a = bucket(r.age_group); if (a && ages.has(a)) ages.set(a, ages.get(a)! + 1); });
  members.forEach((m) => { const a = bucket(m.age_group); if (a && ages.has(a)) ages.set(a, ages.get(a)! + 1); });
  const ageMax = Math.max(1, ...ages.values());
  const parkingCars = rows.filter((r) => r.vehicle_plate).length;
  const returnPeople = rows.filter((r) => r.return_run_id).reduce((n, r) => n + r.party_size, 0);
  const districtMax = Math.max(1, ...(stats?.by_district ?? []).map((d) => d.people));
  const runMax = Math.max(1, ...(stats?.by_run ?? []).map((d) => d.people), ...(stats?.by_return ?? []).map((d) => d.people));
  const stationMax = Math.max(1, ...(stats?.by_station ?? []).map((d) => d.arrived));

  return (
    <OpsShell eyebrow="Admin · Desktop" title="관리자 대시보드" roles={session.roles} email={session.email} wide light>
      <LiveRefresh />
      <p className="stamp"><i /> {stamp} 기준 · 체크인이 들어올 때마다 갱신됩니다</p>
      <div className="metricGrid four">
        <article><span>신청 팀</span><h2>{stats?.reservations ?? "—"}</h2><p>메인 {stats?.main_people ?? "—"}명 · 예배만 {stats?.worship_people ?? "—"}명</p></article>
        <article><span>신청 인원</span><h2>{stats?.people ?? "—"}</h2><p>VIP {db ? roles.vip.reg : "—"}명 포함</p></article>
        <article className="hot"><span>현재 체크인</span><h2>{stats?.checked_in_people ?? "—"}</h2><p>실참률 {rate}% · 좌석 배정 {stats?.seated_people ?? "—"}석</p></article>
        <article><span>다음 초대장 수신</span><h2>{stats?.contact_consent_people ?? "—"}</h2><p>플레이리스트·사진은 전원 발송</p></article>
      </div>

      <section className="box roleBox">
        <h2>참석자 구분 <small>체크인 기준 · 아래 작은 숫자는 신청 기준</small></h2>
        <p className="sub">VIP = 초대받아 직접 신청한 분과 “함께 오시는 분”. 인도자 = VIP와 함께 온(또는 VIP를 초대한) 성도. 일반 성도 = 그 밖에 혼자 오신 성도.</p>
        <div className="metricGrid">
          <article><span>일반 성도</span><h2>{roles.member.in}<em>명</em></h2><p>신청 {roles.member.reg}명</p></article>
          <article><span>인도자</span><h2>{roles.leader.in}<em>명</em></h2><p>신청 {roles.leader.reg}명</p></article>
          <article className="hot"><span>VIP</span><h2>{roles.vip.in}<em>명</em></h2><p>신청 {roles.vip.reg}명</p></article>
          <article><span>합계</span><h2>{roles.member.in + roles.leader.in + roles.vip.in}<em>명</em></h2><p>신청 {roles.member.reg + roles.leader.reg + roles.vip.reg}명</p></article>
        </div>
      </section>

      <div className="cols two">
        <section className="box">
          <h2>교구 · 부서별 현황</h2><p className="sub">막대 전체가 신청 인원, 채워진 부분이 체크인</p>
          <p className="legend"><i className="sw done" /> 체크인 완료 <i className="sw expected" /> 아직 미도착</p>
          <ul className="chart">{(stats?.by_district ?? []).map((d) => <Bar key={d.label} label={d.label} value={d.people} done={d.arrived} max={districtMax} />)}</ul>
        </section>
        <section className="box">
          <h2>운영 집계</h2><p className="sub">각 부서가 그대로 가져가 쓰는 숫자</p>
          <div className="chips">
            <span>케이터링 <b>{stats?.people ?? "—"}</b>인분</span>
            <span className="warm">식이 확인 <b>{stats?.dietary_parties ?? "—"}</b>건</span>
            <span>주차 <b>{parkingCars}</b>대</span>
            <span className="warm">이동 도움 <b>{stats?.mobility_parties ?? "—"}</b>건</span>
            <span>복귀 셔틀 <b>{returnPeople}</b>명</span>
            <span>예배만 참석 <b>{stats?.worship_people ?? "—"}</b>명</span>
            <span>수기 등록 <b>{rows.filter((r) => r.source === "import").length}</b>팀</span>
          </div>
          <h2 className="mt">연령대</h2><p className="sub">성함을 적어 주신 분 기준</p>
          <ul className="chart">{[...ages.entries()].map(([label, n]) => <Bar key={label} label={label} value={n} max={ageMax} />)}</ul>
          {(stats?.by_worship?.length ?? 0) > 0 && (
            <>
              <h2 className="mt">예배만 참석</h2>
              <ul className="chart">{(stats?.by_worship ?? []).map((w) => <Bar key={`${w.site}-${w.service}`} label={`${w.service ?? "?"}부 · ${eventConfig.worshipSites.find(([c]) => c === w.site)?.[1] ?? ""}`} value={w.people} max={Math.max(1, ...(stats?.by_worship ?? []).map((x) => x.people))} tone="gold" />)}</ul>
            </>
          )}
        </section>
      </div>

      <div className="cols two">
        <section className="box">
          <h2>셔틀 편별 예약</h2><p className="sub">THE OPENING TRACK · {eventConfig.origin.name} 출발</p>
          <ul className="chart">{(stats?.by_run ?? []).map((d) => <Bar key={d.label} label={d.label} value={d.people} max={runMax} tone="gold" />)}</ul>
          {(stats?.by_return?.length ?? 0) > 0 && <><h3>복귀 편</h3><ul className="chart">{(stats?.by_return ?? []).map((d) => <Bar key={d.label} label={d.label} value={d.people} max={runMax} tone="gold" />)}</ul></>}
        </section>
        <section className="box">
          <h2>스테이션별 체크인</h2><p className="sub">봉사자 배치 판단용</p>
          <ul className="chart">{(stats?.by_station ?? []).map((d) => <Bar key={d.name} label={d.name} value={d.arrived} max={stationMax} />)}</ul>
        </section>
      </div>

      <section className="box">
        <h2>복귀 셔틀 좌석</h2><p className="sub">편마다 버스 1대 기준입니다. 웹 신청과 스캔 데스크 예약이 자동으로 차감되고, 전체 좌석 수를 바꾸면 남은 좌석이 바로 다시 계산됩니다.</p>
        <ReturnCapacity runs={returnRuns} />
      </section>

      <section className="box">
        <h2>비품 초기 수량</h2><p className="sub">행사 전에 준비한 수량을 넣어 주세요. 남은 수량 = 초기 수량 + 현장 조정(웰컴 데스크의 −/+) − 체크인 때 지급한 수량이며, 웰컴 데스크 화면에 그대로 보입니다.</p>
        <StockSetup items={stockItems} />
      </section>

      <section className="box">
        <h2>신청 명단</h2>
        {!db && <p className="tiny">Supabase가 연결되면 명단과 필터, 수정 기능이 활성화됩니다.</p>}
        <div className="scroll"><table>
          <thead><tr><th>티켓 번호</th><th>초청자</th><th>교구/부서</th><th>참여</th><th>인원</th><th>이동</th><th>특이</th><th>체크인</th><th>관리</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}><td className="mono">{r.code}</td><td>{r.applicant_name}{r.source === "import" ? <small> 수기</small> : null}</td><td>{districtName(r.district_code)}</td>
              <td>{r.attendance === "worship" ? `예배 ${r.worship_service ?? "?"}부 · ${eventConfig.worshipSites.find(([c]) => c === r.worship_site)?.[1] ?? ""}` : "메인"}</td>
              <td className="mono">{arrived.has(r.id) ? `${arrived.get(r.id)} / ${r.party_size}` : r.party_size}</td>
              <td>{r.transport === "shuttle" ? "셔틀" : r.transport === "car" ? "자차" : "개별"}</td>
              <td>{[r.dietary_note && "식이", r.mobility_support && "도움", r.vehicle_plate && "주차", r.return_run_id && "복귀"].filter(Boolean).join(" · ") || "—"}</td>
              <td>{arrived.has(r.id) ? <span className="tag in">확인</span> : <span className="tag">미도착</span>}</td>
              <td><ReservationAction id={r.id} name={r.applicant_name} checkedIn={arrived.has(r.id)} mode="cancel" /></td></tr>
          ))}</tbody>
        </table></div>
      </section>

      {cancelled.length > 0 && (
        <section className="box">
          <details>
            <summary><h2 className="inline">취소된 신청 <small>{cancelled.length}건 · 명단과 집계에서 빠져 있습니다</small></h2></summary>
            <div className="scroll"><table>
              <thead><tr><th>티켓 번호</th><th>초청자</th><th>교구/부서</th><th>인원</th><th>관리</th></tr></thead>
              <tbody>{cancelled.map((r) => (
                <tr key={r.id} className="cancelled"><td className="mono">{r.code}</td><td>{r.applicant_name}{r.source === "import" ? <small> 수기</small> : null}</td>
                  <td>{districtName(r.district_code)}</td><td className="mono">{r.party_size}</td>
                  <td><ReservationAction id={r.id} name={r.applicant_name} mode="restore" /></td></tr>
              ))}</tbody>
            </table></div>
          </details>
        </section>
      )}
      <p className="tiny">이 화면은 기록하지 않습니다. 모든 참석 데이터는 스태프 스캔 확정에서만 생성됩니다.</p>
    </OpsShell>
  );
}
