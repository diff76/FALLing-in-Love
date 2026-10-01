import Link from "next/link";
import { BrandLink } from "@/components/brand-link";
import { OmsGallery } from "@/components/oms-gallery";
import { OmsAdmin } from "@/components/oms-admin";
import { listOms } from "@/lib/oms";

export const metadata = { title: "Photos · The One More Song" };
export const dynamic = "force-dynamic";

export default async function OmsPhotosPage() {
  const { tracks, photos } = await listOms();
  return (
    <main className="memoryPage omsPage">
      <header className="omsTop"><BrandLink /><Link href="/one-more-song">← 플레이어로</Link></header>
      <div className="omsIntro">
        <p className="eyebrow">Photos</p>
        <h1>그날의<br /><em>사진</em></h1>
        <p>{photos.length ? `${photos.length}장의 사진이 있습니다. 눌러서 크게 보세요.` : "행사가 끝나면 그날의 사진이 이곳에 올라옵니다."}</p>
      </div>
      <OmsGallery photos={photos} />
      <OmsAdmin photos={photos} tracks={tracks} />
    </main>
  );
}
