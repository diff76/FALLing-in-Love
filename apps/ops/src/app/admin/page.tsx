import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase-server";
import { OpsShell } from "@/components/ops-shell";
import { LiveRefresh } from "@/components/live-refresh";
import type { OpsStats } from "@fil/supabase";
import { districtName, eventConfig } from "@fil/config";

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
  const [statsRes, rowsRes, membersRes, checkinsRes] = db ? await Promise.all([
    db.rpc("ops_stats"),
    db.from("reservations").select("id, code, applicant_name, kind, district_code, age_group, party_size, transport, mobility_support, dietary_note, vehicle_plate, contact_consent, return_run_id, attendance, worship_service, worship_site, source, created_at").eq("status", "active").order("created_at", { ascending: false }).limit(1000),
    db.from("reservation_members").select("reservation_id, age_group"),
    db.from("checkins").select("reservation_id, arrived_count, station_id").is("voided_at", null),
  ]) : [null, null, null, null];
  const stats = (statsRes?.data ?? null) as OpsStats | null;
  const rows = rowsRes?.data ?? [];
  const members = membersRes?.data ?? [];
  const checkins = checkinsRes?.data ?? [];
  const arrived = new Map(checkins.map((c) => [c.reservation_id, c.arrived_count]));
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
        <article><span>신청 인원</span><h2>{stats?.people ?? "—"}</h2><p>게스트 {stats?.guests ?? "—"}명 포함</p></article>
        <article className="hot"><span>현재 체크인</span><h2>{stats?.checked_in_people ?? "—"}</h2><p>실참률 {rate}% · 좌석 배정 {stats?.seated_people ?? "—"}석</p></article>
        <article><span>다음 초대장 수신</span><h2>{stats?.contact_consent_people ?? "—"}</h2><p>플레이리스트·사진은 전원 발송</p></article>
      </div>

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
        <h2>신청 명단</h2>
        {!db && <p className="tiny">Supabase가 연결되면 명단과 필터, 수정 기능이 활성화됩니다.</p>}
        <div className="scroll"><table>
          <thead><tr><th>티켓 번호</th><th>초청자</th><th>교구/부서</th><th>참여</th><th>인원</th><th>이동</th><th>특이</th><th>체크인</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}><td className="mono">{r.code}</td><td>{r.applicant_name}{r.source === "import" ? <small> 수기</small> : null}</td><td>{districtName(r.district_code)}</td>
              <td>{r.attendance === "worship" ? `예배 ${r.worship_service ?? "?"}부 · ${eventConfig.worshipSites.find(([c]) => c === r.worship_site)?.[1] ?? ""}` : "메인"}</td>
              <td className="mono">{arrived.has(r.id) ? `${arrived.get(r.id)} / ${r.party_size}` : r.party_size}</td>
              <td>{r.transport === "shuttle" ? "셔틀" : r.transport === "car" ? "자차" : "개별"}</td>
              <td>{[r.dietary_note && "식이", r.mobility_support && "도움", r.vehicle_plate && "주차", r.return_run_id && "복귀"].filter(Boolean).join(" · ") || "—"}</td>
              <td>{arrived.has(r.id) ? <span className="tag in">확인</span> : <span className="tag">미도착</span>}</td></tr>
          ))}</tbody>
        </table></div>
      </section>
      <p className="tiny">이 화면은 기록하지 않습니다. 모든 참석 데이터는 스태프 스캔 확정에서만 생성됩니다.</p>
    </OpsShell>
  );
}
