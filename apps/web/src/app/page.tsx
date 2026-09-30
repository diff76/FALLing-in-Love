import { getImageProps } from "next/image";
import Link from "next/link";
import { eventConfig } from "@fil/config";
import { CinematicWorld } from "@/components/cinematic-world";
import { AfterWorld, Invitation } from "@/components/site-sections";
import { Parallax } from "@/components/parallax";
import { heroImage, heroImageMobile } from "@/config/hero";

/** Portrait phones only — a narrow but wide-ish window (tablet landscape, a small desktop window)
 *  keeps the landscape anchor. Mirrors the hero rule in globals.css. */
const HERO_MOBILE = "(max-width: 820px) and (orientation: portrait)";

export default function HomePage() {
  const alt = "한신대 서울캠퍼스를 가을 클레이 디오라마로 표현한 전경";
  const { props: desktop } = getImageProps({ src: heroImage, alt, width: 1920, height: 1080, sizes: "100vw", quality: 82 });
  const mobile = heroImageMobile ? getImageProps({ src: heroImageMobile, alt, width: 1290, height: 2796, sizes: "100vw", quality: 80 }).props : null;
  return (
    <>
      <section className="overture" id="top">
        <div className="overtureMedia">
          {/* Art direction: a portrait render for phones, the landscape anchor otherwise. The hero is the LCP image. */}
          <picture>
            {mobile && <source media={HERO_MOBILE} srcSet={mobile.srcSet} sizes="100vw" />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={desktop.src} srcSet={desktop.srcSet} sizes="100vw" alt={alt} decoding="async" fetchPriority="high" loading="eager" />
          </picture>
        </div>
        <div className="overtureWash" aria-hidden="true" />
        <header className="topbar">
          <span className="brand">{eventConfig.edition}</span>
          <Link className="topCta" href="/apply">참여 신청</Link>
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
