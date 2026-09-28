import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { eventConfig } from "@fil/config";
import { hashPassToken, isPassTokenShape, passUrl } from "@fil/domain";
import { createAdminSupabaseClient, isSupabaseAdminConfigured, type PassLookup } from "@fil/supabase";
import { BrandLink } from "@/components/brand-link";
import { TicketCard, type TicketBadge } from "@/components/ticket-card";
import { PassActions } from "@/components/pass-actions";
import { InviteGuests, type GuestInvite } from "@/components/invite-guests";

export const dynamic = "force-dynamic";

type Member = { position: number; name: string };
type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ issued?: string; g?: string }> };

const preview: PassLookup = {
  code: "261011-00-000", applicant_name: "미리보기", kind: "host", inviter_name: null, district_label: "신청 DB 연결 전",
  party_size: 2, guest_count: 1, seat_label: null, transport: "shuttle", outbound_label: "12:30", return_label: null,
  mobility_support: false, has_dietary_note: false, vehicle_plate: null, issued_at: new Date().toISOString(),
  attendance: "main", worship_service: null, worship_site: null, checked_in: false,
};
const previewMembers: Member[] = [{ position: 1, name: "김초대" }];

/** One pass + its companions, shared by generateMetadata and the page within a request. */
const loadPass = cache(async (token: string): Promise<{ pass: PassLookup; members: Member[] } | null> => {
  if (token === "preview" || !isSupabaseAdminConfigured()) return { pass: preview, members: previewMembers };
  const db = createAdminSupabaseClient();
  const hash = await hashPassToken(token);
  const { data } = await db.rpc("lookup_pass", { p_token_hash: hash });
  if (!data) return null;
  const pass = data as PassLookup;
  let members: Member[] = [];
  if (pass.kind === "host" && pass.guest_count > 0) {
    const { data: p } = await db.from("passes").select("reservation_id").eq("token_hash", hash).is("revoked_at", null).maybeSingle();
    if (p) {
      const { data: m } = await db.from("reservation_members").select("position, name").eq("reservation_id", p.reservation_id).order("position");
      members = (m ?? []).filter((x) => x.name?.trim());
    }
  }
  return { pass, members };
});

/** ?g=<position> picks the companion this link was sent to; anything else means the host's own view. */
function guestFor(members: Member[], g: string | undefined): Member | null {
  const n = Number(g);
  return Number.isInteger(n) ? members.find((m) => m.position === n) ?? null : null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { token } = await params;
  const { g } = await searchParams;
  const base = { robots: { index: false, follow: false } } satisfies Metadata;
  if (!isPassTokenShape(token) && token !== "preview") return { ...base, title: "Matinée Pass" };
  const loaded = await loadPass(token);
  const guest = loaded ? guestFor(loaded.members, g) : null;
  if (!loaded || !guest) return { ...base, title: "Matinée Pass" };
  // The link preview in KakaoTalk/Messages carries the guest's name, so the invitation is unmistakably theirs.
  const title = `${guest.name} 님을 위한 초대장`;
  const description = `${loaded.pass.applicant_name} 님이 초대했습니다 · ${eventConfig.dateLabel} 낮 ${eventConfig.opensAt} · ${eventConfig.venue.short}`;
  return {
    ...base, title, description,
    openGraph: { title: `${title} · ${eventConfig.name}`, description, type: "website", images: [{ url: "/media/og.jpg", width: 1600, height: 840, alt: "FALLing in Love" }] },
  };
}

export default async function PassPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { issued, g } = await searchParams;
  if (!isPassTokenShape(token) && token !== "preview") notFound();

  const configured = isSupabaseAdminConfigured();
  const loaded = await loadPass(token);
  if (!loaded) notFound();
  const { pass, members } = loaded;
  const guest = guestFor(members, g);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const url = passUrl(siteUrl, token);
  const qr = await QRCode.toString(url, { type: "svg", margin: 0, color: { dark: "#2E251C", light: "#FFFFFF" } });
  const issuedCount = !guest && issued ? Number(issued) || pass.party_size : 0;
  const worship = pass.attendance === "worship"
    ? `${eventConfig.worshipServices.find(([c]) => c === String(pass.worship_service))?.[1] ?? "예배"} · ${eventConfig.worshipSites.find(([c]) => c === pass.worship_site)?.[1] ?? ""}`
    : null;
  const shuttle = pass.transport === "shuttle" ? `${pass.outbound_label ?? "미정"} ${eventConfig.origin.name} 출발` : pass.transport === "car" ? "개인 차량" : "개별 이동";
  // "Arrive by" = 늦어도 이 시각까지 도착. 자차는 주차까지 마치는 시각, 셔틀·도보는 입장 안내 시각.
  const arrive = pass.transport === "car" ? "12:30 · 주차 완료" : "12:45 · 입장 안내";
  const returnLabel = pass.return_label ? `${pass.return_label} 신청` : "신청 안 함";

  // ---------- a companion's own invitation ----------
  if (guest) {
    const guestUrl = `${url}?g=${guest.position}`;
    const badges: TicketBadge[] = [
      { text: "초대 손님", tone: "plain" },
      ...(pass.checked_in ? [{ text: "일행 체크인 완료", tone: "acc" as const }] : []),
    ];
    return (
      <main className="passPage">
        <BrandLink />
        <div className="passHead">
          <p className="eyebrow">Matinée Pass · For You</p>
          <h1>{guest.name} 님, 초대합니다</h1>
          <p>{pass.applicant_name} 님이 {guest.name} 님을 가을 정원의 오후에 초대했습니다.</p>
          <p>{eventConfig.dateLabel} 낮 {eventConfig.opensAt}, {eventConfig.venue.short}에서 뵙겠습니다.</p>
        </div>
        <TicketCard
          code={pass.code}
          name={<>{guest.name} 님</>}
          party={`${pass.applicant_name} 님의 초대 · 일행 ${pass.party_size}명`}
          fields={[
            { k: "Seats", v: pass.seat_label ? `일행과 함께 · ${pass.seat_label}` : "일행과 나란히 · 체크인 시 배정" },
            { k: "Shuttle", v: shuttle },
            { k: "Arrive by", v: arrive },
            { k: "Return", v: returnLabel },
          ]}
          badges={badges}
          qrSvg={qr}
          qrNote={<>웰컴 스팟이나 채플 로비에서 이 화면을 보여주세요.<br />{pass.applicant_name} 님 일행으로 확인됩니다.</>}
        />
        <PassActions url={guestUrl} code={pass.code} shareTitle={`${guest.name} 님을 위한 초대장 · FALLing in Love`} shareText={`${guest.name} 님의 Matinée Pass`} />
        <aside className="passNote">
          <b>먼저 도착하셔도 괜찮습니다.</b>
          이 QR을 보여주시면 {pass.applicant_name} 님 일행으로 바로 안내해 드립니다. 좌석은 일행이 나란히 앉도록 배정됩니다.
        </aside>
        <aside className="passNote">
          <b>가벼운 식사가 준비되어 있습니다.</b>
          오후 1시에 특별예배로 문을 열고, 실내악을 지나 정원에서 마무리합니다. 편한 신발을 신고 오시면 좋습니다.
        </aside>
      </main>
    );
  }

  // ---------- the host's (or a self-registered guest's) pass ----------
  const seats = pass.seat_label ? `${pass.party_size}석 · ${pass.seat_label}` : `${pass.party_size}석 · 체크인 시 배정`;
  const badges: TicketBadge[] = [
    ...(worship ? [{ text: "예배만 참석", tone: "plain" as const }] : []),
    ...(pass.has_dietary_note ? [{ text: "식이 확인", tone: "diet" as const }] : []),
    ...(pass.vehicle_plate ? [{ text: "주차", tone: "park" as const }] : []),
    ...(pass.mobility_support ? [{ text: "도움 요청", tone: "acc" as const }] : []),
    ...(pass.return_label ? [{ text: `복귀 셔틀 ${pass.return_label}`, tone: "ret" as const }] : []),
    ...(pass.checked_in ? [{ text: "체크인 완료", tone: "acc" as const }] : []),
  ];
  const invites: GuestInvite[] = members.map((m) => ({
    name: m.name,
    url: `${url}?g=${m.position}`,
    message: `${m.name} 님, ${eventConfig.dateLabel} 낮 ${eventConfig.opensAt} ${eventConfig.venue.short}에서 열리는 가을 정원 마티네 'FALLing in Love'에 초대합니다. 아래 링크가 ${m.name} 님의 입장권(Matinée Pass)입니다. — ${pass.applicant_name} 드림`,
  }));

  return (
    <main className="passPage">
      <BrandLink />
      <div className="passHead">
        <p className="eyebrow">Matinée Pass</p>
        <h1>{issuedCount ? `${issuedCount}명의 사전 참여 신청이 완료되었습니다` : "Matinée Pass"}</h1>
        <p>{eventConfig.dateLabel} 낮 {eventConfig.opensAt}, {eventConfig.venue.short}에서 뵙겠습니다.</p>
        {issuedCount > 0 && <p className="passAlert">실제 좌석은 당일 현장에서 체크인하셔야 배정됩니다. 이 QR을 웰컴 스팟이나 채플 로비에서 보여주세요.</p>}
      </div>
      <TicketCard
        code={pass.code}
        issued={issuedCount > 0}
        name={<>{pass.applicant_name} 님{pass.guest_count > 0 ? ` 외 ${pass.guest_count}인` : ""}</>}
        party={`${pass.kind === "guest_self" ? `${pass.inviter_name ?? ""} 님의 초대` : pass.district_label ?? ""}${pass.guest_count > 0 ? ` · 함께 오시는 분 ${pass.guest_count}명` : " · 혼자 오십니다"}${worship ? ` · ${worship}` : ""}`}
        fields={[
          { k: "Seats", v: seats },
          { k: "Shuttle", v: shuttle },
          { k: "Arrive by", v: arrive },
          { k: "Return", v: returnLabel },
        ]}
        badges={badges}
        qrSvg={qr}
        qrNote={<>웰컴 스팟이나 채플 로비에서 이 화면을 보여주세요.<br />일행 모두가 한 번에 확인됩니다.</>}
      />
      <PassActions url={url} code={pass.code} />
      {invites.length > 0 && <InviteGuests guests={invites} />}
      <aside className="passNote">
        <b>이 페이지 주소가 곧 Pass입니다.</b>
        링크를 저장해 두시면 언제든 다시 열 수 있습니다. 함께 오시는 분께는 위의 초대장 보내기로 그분 이름의 Pass를 보내 주세요.
      </aside>
      <aside className="passNote">
        <b>가벼운 식사가 준비되어 있습니다.</b>
        오후 1시에 특별예배로 문을 열고, 실내악을 지나 정원에서 마무리합니다. 편한 신발을 신고 오시면 좋습니다.
      </aside>
      {!configured && token !== "preview" && <aside className="passNote"><b>미리보기</b>신청 저장소가 연결되면 실제 신청 정보가 이 자리에 표시됩니다.</aside>}
    </main>
  );
}
