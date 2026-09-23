import Image from "next/image";
import Link from "next/link";
import { eventConfig } from "@fil/config";
import { CinematicWorld } from "@/components/cinematic-world";
import { AfterWorld, Invitation } from "@/components/site-sections";
import { Parallax } from "@/components/parallax";
import { heroImage } from "@/config/hero";

export default function HomePage() {
  return (
    <>
      <section className="overture" id="top">
        <div className="overtureMedia">
          <Image src={heroImage} alt="한신대 서울캠퍼스를 가을 클레이 디오라마로 표현한 전경" fill priority sizes="100vw" />
        </div>
        <div className="overtureWash" aria-hidden="true" />
        <header className="topbar">
          <span className="brand">{eventConfig.edition}</span>
          <Link className="topCta" href="/apply">좌석 예약</Link>
        </header>
        <div className="overtureCopy heroReveal">
          <p className="eyebrow light">Chamber Concert &amp; Garden Party</p>
          <h1 className="title"><span className="line"><span className="fall">FALL</span>ing <em>in</em></span><br /><span className="line">Love</span></h1>
          <p className="subtitle">{eventConfig.subtitle}</p>
          <p className="promise">{eventConfig.taglineKo}</p>
          <div className="eventLine">
            <span>{eventConfig.dateLabel}</span><span>낮 {eventConfig.opensAtLabel} – 오후 {eventConfig.closesAtLabel}</span><span>{eventConfig.venue.short} Chapel &amp; Garden</span>
          </div>
        </div>
        <a className="scrollCue" href="#invitation"><span>하루를 따라가 보세요</span><i aria-hidden="true" /></a>
      </section>
      <Invitation />
      <CinematicWorld />
      <AfterWorld />
      <Parallax />
    </>
  );
}
