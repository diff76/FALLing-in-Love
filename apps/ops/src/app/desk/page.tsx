import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase-server";
import { OpsShell } from "@/components/ops-shell";
import { LiveRefresh } from "@/components/live-refresh";
import type { OpsStats } from "@fil/supabase";

export const dynamic = "force-dynamic";

export default async function DeskPage() {
  const session = await requireRole("desk", "admin");
  const db = await supabaseServer();
  const stats = db ? ((await db.rpc("ops_stats")).data as OpsStats | null) : null;
  const pending = db
    ? (await db.from("reservations").select("id, applicant_name, party_size, district_code, mobility_support, dietary_note, outbound_run_id").eq("status", "active").order("created_at").limit(200)).data ?? []
    : [];
  const recent = db
    ? (await db.from("checkins").select("id, arrived_count, checked_in_at, reservation_id, station_id").is("voided_at", null).order("checked_in_at", { ascending: false }).limit(10)).data ?? []
    : [];
  const checkedIds = new Set(recent.map((c) => c.reservation_id));

  return (
    <OpsShell eyebrow="Desk · Tablet" title="웰컴 데스크 상황판" roles={session.roles} email={session.email} wide>
      <LiveRefresh />
      <div className="metricGrid">
        <article><span>ARRIVED</span><h2>{stats?.checked_in_people ?? "—"}<em>명</em></h2><p>{stats?.checked_in_parties ?? "—"}팀 확인</p></article>
        <article><span>EXPECTED</span><h2>{stats?.people ?? "—"}<em>명</em></h2><p>{stats?.reservations ?? "—"}팀 신청</p></article>
        <article><span>ASSISTANCE</span><h2>{stats?.mobility_parties ?? "—"}<em>팀</em></h2><p>우회 동선 안내</p></article>
        <article><span>DIETARY</span><h2>{stats?.dietary_parties ?? "—"}<em>팀</em></h2><p>테이블 담당 전달</p></article>
      </div>
      <div className="cols">
        <section className="box"><h2>셔틀 편별 예정</h2>
          <ul className="bars">{(stats?.by_run ?? []).map((b) => <li key={b.label}><span>{b.label}</span><b>{b.people}명</b></li>)}</ul>
          {!stats && <p className="tiny">Supabase가 연결되면 실시간 집계가 표시됩니다.</p>}
        </section>
        <section className="box"><h2>방금 맞이한 분들</h2>
          <ul className="list">{recent.map((c) => <li key={c.id}><b>{c.arrived_count}명</b><span>{new Date(c.checked_in_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span></li>)}</ul>
        </section>
        <section className="box"><h2>아직 안 오신 분</h2>
          <ul className="list">{pending.filter((p) => !checkedIds.has(p.id)).slice(0, 40).map((p) => <li key={p.id}><b>{p.applicant_name} 님 {p.party_size}명</b><span>{p.mobility_support ? "도움 " : ""}{p.dietary_note ? "식이" : ""}</span></li>)}</ul>
        </section>
      </div>
      <p className="tiny">이 화면은 기록하지 않고 보여주기만 합니다. 게스트 쪽에서 보이지 않도록 방향을 잡아주세요.</p>
    </OpsShell>
  );
}
