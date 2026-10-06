import { BrandLink } from "@/components/brand-link";

/**
 * A Pass link that no longer opens: the sign-up was taken again, cancelled, or a new link was issued.
 * Instead of a bare 404, point the holder to the name + phone lookup (where a new Pass can be issued)
 * and tell an invited companion to ask for a fresh invitation.
 */
export default function PassNotFound() {
  return (
    <main className="subPage">
      <header className="subHeader"><BrandLink /><span>MATINÉE PASS</span></header>
      <section className="formIntro">
        <h1>이 Pass 링크는<br />지금 열리지 않습니다.</h1>
        <p className="lede">신청이 다시 접수되었거나 새 Pass 링크가 발급되면, 예전 링크와 그 링크로 보낸 초대장은 더 이상 열리지 않습니다.</p>
        <div className="passGone">
          <article>
            <b>신청하신 분</b>
            <p>참여 신청 페이지에서 신청하실 때 적은 성함과 연락처로 내 신청을 불러온 뒤 새 Pass 링크를 받으실 수 있습니다.</p>
            <a className="button primary" href="/apply?find=1">내 신청 불러오기 <span>→</span></a>
          </article>
          <article>
            <b>초대받으신 분</b>
            <p>초대해 주신 분께 새 초대장 링크를 다시 보내 달라고 말씀해 주세요. 당일 현장 웰컴 데스크에서도 성함으로 확인해 드립니다.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
