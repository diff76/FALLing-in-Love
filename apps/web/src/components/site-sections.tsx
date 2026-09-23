import type React from "react";
import Link from "next/link";
import { eventConfig } from "@fil/config";
import { Reveal } from "./reveal";
import { Clauses } from "./clauses";

const LEAF = "M12 2C7 4 3 9 3 15c0 3 2 6 5 7 4-2 9-5 12-11C18 6 15 3 12 2z";
/** Animated background for a section: three drifting colour orbs plus a fall of autumn leaves (CSS only). */
const Fx = () => (
  <div className="fx" aria-hidden="true">
    <i /><i /><i />
    <div className="leaves">
      {Array.from({ length: 10 }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" className={`leaf l${i}`}><path d={LEAF} /></svg>
      ))}
    </div>
  </div>
);

const songCards = [
  { hint: "이 선율, 어디선가 들으셨을 겁니다.", title: "영화 속의 그 곡", body: "선곡이 확정되면 이 자리에서 이야기가 열립니다." },
  { hint: "광고에서 스쳐 가던 그 후렴.", title: "익숙한 멜로디", body: "뒤에 붙어 있던 가사를 알고 나면 조금 다르게 들립니다." },
  { hint: "누구나 흥얼거릴 수 있는 곡.", title: "200년 전에 쓰인 노래", body: "잃은 것을 세지 않고 남은 것을 세어 본 사람의 문장입니다." },
];

export function Invitation() {
  return (
    <section className="invitation" id="invitation">
      <Fx />
      <Reveal><p className="eyebrow">A note for you</p></Reveal>
      <Reveal delay={120}><p className="invitationText">
        <span className="clause">가을 오후의 햇빛 아래,</span><br /><span className="clause">좋은 음악과 잘 차린 테이블을</span> <span className="clause">준비했습니다.</span><br />
        <strong><span className="clause">설명을 듣거나</span> <span className="clause">무엇을 결정하실 필요는 없습니다.</span><br /><span className="clause">그저 한나절 편안히</span> <span className="clause">보내다 가시면 됩니다.</span></strong>
      </p></Reveal>
      <Reveal delay={260}><a className="begin" href="#world">공간으로 들어가기 <span aria-hidden="true">↓</span></a></Reveal>
    </section>
  );
}

export function AfterWorld() {
  return (
    <main className="after" id="after">
      <section className="band worship" id="act-one">
        <Fx />
        <div className="wrap narrow">
          <Reveal group>
          <p className="eyebrow">ACT I · 13:00 · 특별예배</p>
          <h2 className="head">오늘을 위해 준비한 예배</h2>
          <blockquote>
            <span className="clause">“그 넓이와 길이와 높이와 깊이가</span> <span className="clause">어떠함을 깨달아 알고</span><br /><span className="clause">그 지식에 넘치는</span> <span className="clause">그리스도의 사랑을 알고”</span>
            <cite>에베소서 3:18–19</cite>
          </blockquote>
          <p className="lede"><Clauses text={"오늘의 모든 곡이 이 한 문장 위에 놓여 있습니다. 초청하신 분과 나란히 앉아 함께 드립니다."} /></p>
        </Reveal>
        </div>
      </section>

      <section className="band tuning" id="tuning">
        <Fx />
        <div className="wrap narrow">
          <Reveal group>
          <p className="eyebrow">THE TUNING · 13:40</p>
          <h2 className="head">조율하는 시간도 순서입니다</h2>
          <p className="lede"><Clauses text={"예배가 끝나면 무대를 바꿉니다. 그 시간을 감추지 않고 그대로 열어 둡니다. 악기를 조율하는 소리 위로, 오늘 연주될 곡을 하나씩 소개합니다."} /></p>
        </Reveal>
        </div>
      </section>

      <section className="band songs" id="songs">
        <Fx />
        <div className="wrap">
          <Reveal group>
          <p className="eyebrow">ACT II · The Chamber</p>
          <h2 className="head">그 곡, 사실은</h2>
          <p className="lede"><Clauses text={"영화와 광고에서 여러 번 들으셨을 곡들입니다. 그 뿌리가 찬송이거나 크리스천 음악이었다는 사실은, 아마 오늘 처음 아시게 될 겁니다."} /></p>
          <div className="songGrid">
            {songCards.map((c, i) => (
              <article className="songCard" key={c.title}>
                <span>0{i + 1}</span>
                <p><Clauses text={c.hint} /></p>
                <h3>{c.title}</h3>
                <i aria-hidden="true" />
                <small><Clauses text={c.body} /></small>
                <em>오늘, 정원에서 직접 들으시게 됩니다.</em>
              </article>
            ))}
          </div>
          <p className="lede closing"><Clauses text={"사랑에 관한 이야기는 이미 충분히 들으셨을 겁니다. 오늘 들으실 곡들도 다르지 않습니다. 다만 그 사랑이 어디서 왔는지가 조금 다를 뿐입니다."} /></p>
        </Reveal>
        </div>
      </section>

      <section className="band day" id="day">
        <Fx />
        <div className="wrap dayGrid">
          <Reveal group>
          <div>
            <p className="eyebrow">Sunday, October 11</p>
            <h2 className="head">하루의 리듬</h2>
            <p className="lede"><Clauses text={"정오의 밝은 빛에서 시작해 오후 네 시의 낮은 금빛으로 마무리됩니다. 시각은 이 표에만 적어 두었습니다."} /></p>
            <Link className="button primary" href="/apply">좌석 예약하기 <span aria-hidden="true">→</span></Link>
          </div>
          <ol className="schedule">
            {eventConfig.schedule.map((s, i) => (
              <li key={s.time} style={{ "--i": i } as React.CSSProperties}><time>{s.time}</time><span><b>{s.title}</b>{"note" in s ? <small>{s.note}</small> : null}</span></li>
            ))}
          </ol>
        </Reveal>
        </div>
      </section>

      <section className="band practical" id="practical">
        <Fx />
        <div className="wrap">
          <Reveal group>
          <p className="eyebrow">Before you arrive</p>
          <h2 className="head">알아두시면 좋은 것들</h2>
          <div className="practicalGrid">
            <article><span>01</span><h3>오시는 길</h3><p>{eventConfig.venue.name}<br />{eventConfig.venue.address}</p></article>
            <article><span>02</span><h3>셔틀</h3><p>{eventConfig.origin.name} {eventConfig.origin.note}. 정확한 시각은 좌석 예약 후 Matinée Pass에 담아 안내드립니다.</p></article>
            <article><span>03</span><h3>편안한 하루</h3><p><Clauses text="야외 정원 시간이 있어 걷기 편한 신발을 권해드립니다. 짧은 숲 계단 대신 이용할 수 있는 우회 동선도 준비합니다." /></p></article>
            <article><span>04</span><h3>개인정보</h3><p>좌석 배정과 안내를 위해 성함과 연락처만 받습니다. 행사 후 {eventConfig.dataRetentionDays}일 안에 모두 삭제합니다.</p></article>
          </div>
        </Reveal>
        </div>
      </section>

      <section className="band memory" id="one-more-song">
        <Fx />
        <div className="wrap narrow">
          <Reveal group>
          <p className="eyebrow">After the day</p>
          <h2 className="head display">THE ONE<br /><em>MORE SONG</em></h2>
          <p className="lede"><Clauses text={"하루가 끝난 뒤에도 플레이리스트와 사진은 이곳에 남습니다."} /></p>
          <Link className="button ghost" href="/one-more-song">미리 보기 <span aria-hidden="true">→</span></Link>
        </Reveal>
        </div>
      </section>

      <footer className="siteFooter">
        <div><strong>FALLing in Love</strong><span>{eventConfig.edition} · {eventConfig.host}</span></div>
        <p>{eventConfig.dateLabel} · {eventConfig.venue.short} Chapel &amp; Garden</p>
      </footer>
      <Link className="stickyApply" href="/apply">좌석 예약</Link>
    </main>
  );
}
