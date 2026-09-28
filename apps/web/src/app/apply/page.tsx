import { BrandLink } from "@/components/brand-link";
import { eventConfig } from "@fil/config";
import { ReservationForm } from "@/components/reservation-form";

export const metadata = { title: "참여 신청" };
// Re-render at most once a minute so the headline below flips on time without a deploy.
export const revalidate = 60;

/** Headline switch (KST): welcome copy until the eve of the event, then the original line. */
const SWITCH_AT = Date.parse("2026-10-10T20:00:00+09:00");

export default function ApplyPage() {
  const headline = Date.now() >= SWITCH_AT
    ? <>함께하실 분을<br />기다리고 있습니다.</>
    : <>환영합니다!<br />기다리고 있었습니다!</>;
  return (
    <main className="subPage">
      <header className="subHeader"><BrandLink /><span>SIGN UP</span></header>
      <section className="formIntro">
        <p className="eyebrow">{eventConfig.edition}</p>
        <h1>{headline}</h1>
        <p className="lede">신청을 마치시면 개인 QR이 담긴 Matinée Pass가 바로 열립니다. 좌석은 당일 현장 체크인 때 초청하신 분과 나란히 앉으실 수 있도록 배정합니다.</p>
        <dl>
          <div><dt>DATE</dt><dd>{eventConfig.dateLabel}</dd></div>
          <div><dt>TIME</dt><dd>{eventConfig.opensAt}–{eventConfig.closesAt}</dd></div>
          <div><dt>PLACE</dt><dd>{eventConfig.venue.short}</dd></div>
        </dl>
      </section>
      <section className="formPanel"><ReservationForm /></section>
    </main>
  );
}
