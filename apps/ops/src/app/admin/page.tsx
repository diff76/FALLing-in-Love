import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase-server";
import { OpsShell } from "@/components/ops-shell";
import { LiveRefresh } from "@/components/live-refresh";
import type { OpsStats } from "@fil/supabase";
import { districtName } from "@fil/config";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await requireRole("admin");
  const db = await supabaseServer();
  const stats = db ? ((await db.rpc("ops_stats")).data as OpsStats | null) : null;
  const rows = db
    ? (await db.from("reservations").select("id, code, applicant_name, district_code, party_size, transport, mobility_support, dietary_note, vehicle_plate, contact_consent, created_at").eq("status", "active").order("created_at", { ascending: false }).limit(500)).data ?? []
    : [];
  const checkins = db ? (await db.from("checkins").select("reservation_id, arrived_count, station_id").is("voided_at", null)).data ?? [] : [];
  const arrived = new Map(checkins.map((c) => [c.reservation_id, c.arrived_count]));
  const rate = stats && stats.people ? Math.round((stats.checked_in_people / stats.people) * 100) : 0;

  return (
    <OpsShell eyebrow="Admin · Desktop" title="관리자 대시보드" roles={session.roles} email={session.email} wide>
      <LiveRefresh />
      <div className="metricGrid four">
        <article><span>RESERVATIONS</span><h2>{stats?.reservations ?? "—"}</h2><p>신청 팀</p></article>
        <article><span>PEOPLE</span><h2>{stats?.people ?? "—"}</h2><p>게스트 {stats?.guests ?? "—"}명 포함</p></article>
        <article className="hot"><span>CHECKED IN</span><h2>{stats?.checked_in_people ?? "—"}</h2><p>실참률 {rate}%</p></article>
        <article><span>CONSENT</span><h2>{stats?.contact_consent_people ?? "—"}</h2><p>사후 발송 대상</p></article>
      </div>
      <div className="cols">
        <section className="box"><h2>교구 · 부서별</h2><ul className="bars">{(stats?.by_district ?? []).map((d) => <li key={d.label}><span>{d.label}</span><b>{d.arrived}<i>/{d.people}</i></b></li>)}</ul></section>
        <section className="box"><h2>셔틀 편별</h2><ul className="bars">{(stats?.by_run ?? []).map((d) => <li key={d.label}><span>{d.label}</span><b>{d.people}</b></li>)}</ul></section>
        <section className="box"><h2>스테이션별 체크인</h2><ul className="bars">{(stats?.by_station ?? []).map((d) => <li key={d.name}><span>{d.name}</span><b>{d.arrived}</b></li>)}</ul></section>
      </div>
      <section className="box">
        <h2>신청 명단</h2>
        {!db && <p className="tiny">Supabase가 연결되면 명단과 필터, 수정 기능이 활성화됩니다.</p>}
        <div className="scroll"><table>
          <thead><tr><th>티켓 번호</th><th>초청자</th><th>교구/부서</th><th>인원</th><th>이동</th><th>특이</th><th>체크인</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}><td className="mono">{r.code}</td><td>{r.applicant_name}</td><td>{districtName(r.district_code)}</td>
              <td className="mono">{arrived.has(r.id) ? `${arrived.get(r.id)} / ${r.party_size}` : r.party_size}</td>
              <td>{r.transport === "shuttle" ? "셔틀" : r.transport === "car" ? "자차" : "개별"}</td>
              <td>{[r.dietary_note && "식이", r.mobility_support && "도움", r.vehicle_plate && "주차"].filter(Boolean).join(" · ") || "—"}</td>
              <td>{arrived.has(r.id) ? <span className="tag in">확인</span> : <span className="tag">미도착</span>}</td></tr>
          ))}</tbody>
        </table></div>
      </section>
      <p className="tiny">이 화면은 기록하지 않습니다. 모든 참석 데이터는 스태프 스캔 확정에서만 생성됩니다.</p>
    </OpsShell>
  );
}
