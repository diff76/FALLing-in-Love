import Link from "next/link";
import { eventConfig } from "@fil/config";

export const metadata = { title: "The One More Song" };

export default function OneMoreSongPage() {
  return (
    <main className="memoryPage">
      <Link href="/">← 초대장으로</Link>
      <div>
        <p className="eyebrow">After the day</p>
        <h1>THE ONE<br /><em>MORE SONG</em></h1>
        <h2>The day is over.<br />The playlist isn’t.</h2>
        <p>행사 후, 당일 연주된 곡과 우리가 함께 남긴 사진이 이곳에 열립니다. 플레이리스트, 사진 갤러리, 사진 올리기는 별도 단계에서 준비됩니다.</p>
        <span className="tag">COMING AFTER · {eventConfig.dateLabel}</span>
      </div>
    </main>
  );
}
