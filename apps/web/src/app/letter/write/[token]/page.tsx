import type { Metadata } from "next";
import { districtName } from "@fil/config";
import { LETTER_AUDIENCES, letterAudienceOf, letterCode, linkedHostNames, type LetterAudience } from "@fil/domain";
import { createAdminSupabaseClient } from "@fil/supabase";
import { BrandLink } from "@/components/brand-link";
import { LetterEditor } from "@/components/letter-editor";
import { districtForEditorToken, loadDistrictLetters } from "@/lib/letters";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "감사 편지 쓰기", robots: { index: false, follow: false } };

/** A district pastor's link: write the two thank-you letters of that district (and only that district). */
export default async function LetterWritePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const district = await districtForEditorToken(token);
  if (!district) {
    return (
      <main className="subPage">
        <header className="subHeader"><BrandLink /><span>LETTER</span></header>
        <section className="formIntro"><h1>열 수 없는 링크입니다.</h1><p className="lede">편지 작성 링크가 바뀌었거나 사용이 끝났습니다. 행사 관리자에게 새 링크를 요청해 주세요.</p></section>
      </main>
    );
  }
  const label = districtName(district);
  const [letters, counts] = await Promise.all([loadDistrictLetters(district), audienceCounts(district)]);
  return (
    <main className="subPage">
      <header className="subHeader"><BrandLink /><span>LETTER · {label}</span></header>
      <section className="formIntro">
        <p className="eyebrow">Thank-you letter</p>
        <h1>{label} 감사 편지</h1>
        <p className="lede">행사에 함께한 {label} 분들께 보낼 편지 두 편을 써 주세요. 받는 분이 링크를 열면 봉투가 열리고, 목사님 글과 그날의 노래(The One More Song)가 함께 나옵니다.</p>
      </section>
      <section className="formPanel">
        <LetterEditor token={token} districtLabel={label} initial={{ one: letters.one.body, two: letters.two.body, signer: letters.one.signer || letters.two.signer }}
          savedAt={letters.one.updatedAt ?? letters.two.updatedAt} counts={counts}
          links={Object.fromEntries(LETTER_AUDIENCES.map((a) => [a, `/letter/${letterCode(district, a)}`])) as Record<LetterAudience, string>} />
      </section>
    </main>
  );
}

/** How many people of this district receive each letter (applicants; VIP also counts the companions). */
async function audienceCounts(district: string): Promise<Record<LetterAudience, number>> {
  const { data } = await createAdminSupabaseClient().from("reservations").select("kind, party_size, applicant_name, inviter_name, district_code").eq("status", "active");
  const rows = data ?? [];
  const linked = linkedHostNames(rows);
  const out: Record<LetterAudience, number> = { vip: 0, leader: 0, mirae: 0, member: 0 };
  rows.filter((r) => r.district_code === district).forEach((r) => {
    const a = letterAudienceOf(r, linked);
    out[a] += a === "vip" ? r.party_size : 1;
    if (a === "leader") out.vip += r.party_size - 1;   // the companions receive the VIP letter (passed on by the 인도자)
  });
  return out;
}
