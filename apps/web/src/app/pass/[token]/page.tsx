import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { eventConfig } from "@fil/config";
import { hashPassToken, isPassTokenShape, passUrl } from "@fil/domain";
import { createAdminSupabaseClient, isSupabaseAdminConfigured, type PassLookup } from "@fil/supabase";

export const metadata = { title: "Matinée Pass" };
export const dynamic = "force-dynamic";

const preview: PassLookup = {
  code: "261011-00-000", applicant_name: "미리보기", kind: "host", inviter_name: null, district_label: "예약 DB 연결 전",
  party_size: 2, guest_count: 1, seat_label: null, transport: "shuttle", outbound_label: "12:30", return_label: null,
  mobility_support: false, has_dietary_note: false, vehicle_plate: null, issued_at: new Date().toISOString(),
  attendance: "main", worship_service: null, worship_site: null, checked_in: false,
};

export default async function PassPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ issued?: string }> }) {
  const { token } = await params;
  const { issued } = await searchParams;
  if (!isPassTokenShape(token) && token !== "preview") notFound();

  let pass: PassLookup;
  const configured = isSupabaseAdminConfigured();
  if (token === "preview" || !configured) {
    pass = preview;
  } else {
    const db = createAdminSupabaseClient();
    const { data } = await db.rpc("lookup_pass", { p_token_hash: await hashPassToken(token) });
    if (!data) notFound();
    pass = data;
  }

  const url = passUrl(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000", token);
  const qr = await QRCode.toString(url, { type: "svg", margin: 0, color: { dark: "#2E251C", light: "#FFFFFF" } });
  const shuttle = pass.transport === "shuttle" ? `${pass.outbound_label ?? "미정"} ${eventConfig.origin.name} 출발` : pass.transport === "car" ? "개인 차량" : "개별 이동";
  const arrive = pass.transport === "car" ? "12:30까지 주차" : "12:45 입장 안내";
  const issuedCount = issued ? Number(issued) || pass.party_size : 0;
  const worship = pass.attendance === "worship"
    ? `${eventConfig.worshipServices.find(([c]) => c === String(pass.worship_service))?.[1] ?? "예배"} · ${eventConfig.worshipSites.find(([c]) => c === pass.worship_site)?.[1] ?? ""}`
    : null;

  return (
    <main className="passPage">
      <Link href="/">← FALLing in Love</Link>
      <div className="passHead">
        <p className="eyebrow">Matinée Pass</p>
        <h1>{issuedCount ? `${issuedCount}명의 사전 참여 신청이 완료되었습니다` : "Matinée Pass"}</h1>
        <p>{eventConfig.dateLabel} 낮 {eventConfig.opensAt}, {eventConfig.venue.short}에서 뵙겠습니다.</p>
        {issuedCount > 0 && <p className="passAlert">실제 좌석은 당일 현장에서 체크인하셔야 배정됩니다. 이 QR을 웰컴 스팟이나 채플 로비에서 보여주세요.</p>}
      </div>
      <article className="ticket" aria-label="Matinée Pass">
        <header><span>TICKET NO. {pass.code}</span><b>MATINÉE PASS</b></header>
        <div className="ticketBody">
          <div>
            <h2>{pass.applicant_name} 님{pass.guest_count > 0 ? ` 외 ${pass.guest_count}인` : ""}</h2>
            <p className="party">{pass.kind === "guest_self" ? `${pass.inviter_name ?? ""} 님의 초대` : pass.district_label ?? ""}{pass.guest_count > 0 ? ` · 함께 오시는 분 ${pass.guest_count}명` : " · 혼자 오십니다"}{worship ? ` · ${worship}` : ""}</p>
          </div>
          <dl className="ticketGrid">
            <div><dt>SEAT</dt><dd>{pass.seat_label ?? (pass.checked_in ? "현장 안내" : "체크인 시 배정")}</dd></div>
            <div><dt>SHUTTLE</dt><dd>{shuttle}</dd></div>
            <div><dt>ARRIVE BY</dt><dd>{arrive}</dd></div>
            <div><dt>RETURN</dt><dd>{pass.return_label ? `${pass.return_label} 신청` : "신청 안 함"}</dd></div>
          </dl>
          <div className="badges">
            {worship && <span>예배만 참석</span>}
            {pass.has_dietary_note && <span>식이 확인</span>}
            {pass.vehicle_plate && <span>주차</span>}
            {pass.mobility_support && <span>우회 동선</span>}
            {pass.return_label && <span>복귀 셔틀</span>}
          </div>
          <div className="qrBox">
            <div dangerouslySetInnerHTML={{ __html: qr }} aria-label="체크인 QR" role="img" />
            <p>웰컴 스팟이나 채플 로비에서 이 화면을 보여주세요.<br />일행 모두가 한 번에 확인됩니다.</p>
          </div>
        </div>
        <footer>TICKET NO. {pass.code}</footer>
      </article>
      <aside className="passNote">
        <b>가벼운 식사가 준비되어 있습니다.</b>
        오후 1시에 특별예배로 문을 열고, 실내악을 지나 정원에서 마무리합니다. 편한 신발을 신고 오시면 좋습니다.
      </aside>
      {!configured && token !== "preview" && <aside className="passNote"><b>미리보기</b>예약 저장소가 연결되면 실제 예약 정보가 이 자리에 표시됩니다.</aside>}
    </main>
  );
}
