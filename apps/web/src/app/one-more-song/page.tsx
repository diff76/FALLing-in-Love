import Link from "next/link";
import { eventConfig } from "@fil/config";
import { BrandLink } from "@/components/brand-link";
import { OmsPlayer } from "@/components/oms-player";
import { listOms } from "@/lib/oms";

export const metadata = { title: "The One More Song" };
// New uploads show up straight away.
export const dynamic = "force-dynamic";

export default async function OneMoreSongPage() {
  const { tracks, photos } = await listOms();
  return (
    <main className="memoryPage omsPage">
      <header className="omsTop"><BrandLink /><Link href="/">← 초대장으로</Link></header>
      <div className="omsIntro">
        <p className="eyebrow">After the day</p>
        <h1>THE ONE<br /><em>MORE SONG</em></h1>
        <h2>The day is over.<br />The playlist isn’t.</h2>
        <p>그날 연주된 곡과 우리가 함께 남긴 사진입니다. 음악을 틀어 두고 사진을 넘겨 보세요.</p>
      </div>
      <OmsPlayer tracks={tracks} photos={photos} />
      <div className="omsMore">
        <Link className="button omsPhotosBtn" href="/one-more-song/photos">사진 모아 보기 <span aria-hidden="true">→</span></Link>
        <span className="tag">{eventConfig.dateLabel} · {eventConfig.venue.short}</span>
      </div>
    </main>
  );
}
