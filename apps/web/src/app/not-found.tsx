import Link from "next/link";

export default function NotFound() {
  return (
    <main className="subPage">
      <header className="subHeader"><Link href="/">← FALLing in Love</Link></header>
      <section className="formIntro"><h1>찾을 수 없는 페이지입니다.</h1><p className="lede">Pass 링크라면 발급받은 주소를 다시 확인해 주세요.</p></section>
    </main>
  );
}
