import Link from "next/link";
import { BrandLink } from "@/components/brand-link";

/** A letter link whose letter is not written yet (or a mistyped link). */
export default function LetterNotFound() {
  return (
    <main className="subPage">
      <header className="subHeader"><BrandLink /><span>THANK YOU</span></header>
      <section className="formIntro">
        <h1>편지가 아직<br />도착하지 않았습니다.</h1>
        <p className="lede">교구장 목사님이 편지를 쓰고 계시거나, 링크 주소가 조금 달라졌을 수 있습니다. 받으신 문자나 카카오톡의 링크를 그대로 다시 눌러 주세요.</p>
        <p className="lede">그날의 노래와 사진은 지금도 들어 보실 수 있습니다.</p>
        <Link className="button primary" href="/one-more-song">The One More Song <span>→</span></Link>
      </section>
    </main>
  );
}
