import Link from "next/link";
import { eventConfig } from "@fil/config";
import { ReservationForm } from "@/components/reservation-form";

export const metadata = { title: "참여 신청" };

export default function ApplyPage() {
  return (
    <main className="subPage">
      <header className="subHeader"><Link href="/">← FALLing in Love</Link><span>SIGN UP</span></header>
      <section className="formIntro">
        <p className="eyebrow">{eventConfig.edition}</p>
        <h1>함께하실 분을<br />기다리고 있습니다.</h1>
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
