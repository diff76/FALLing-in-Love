import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { letterCode, letterGreeting } from "@fil/domain";
import { loadLetterPage } from "@/lib/letters";
import { LetterView } from "@/components/letter-view";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };
const load = cache((code: string) => loadLetterPage(code));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const d = await load(code);
  const base = { robots: { index: false, follow: false } } satisfies Metadata;
  if (!d) return { ...base, title: "감사 편지" };
  const title = d.audience === "staff" ? "STAFF께 도착한 편지" : `${d.districtLabel} 가족께 도착한 편지`;
  const description = "FALLing in Love에 함께해 주셔서 감사합니다. 교구장 목사님의 편지와 그날의 노래가 담겨 있습니다.";
  return { ...base, title, description, openGraph: { title: `${title} · FALLing in Love`, description, type: "website" } };
}

/** A thank-you letter for one district × audience: the envelope opens on a tap and the first song starts with it. */
export default async function LetterPage({ params }: Props) {
  const { code } = await params;
  const d = await load(code);
  if (!d) notFound();
  const g = letterGreeting(d.audience, d.districtLabel);
  return (
    <LetterView
      envelope={g.envelope} to={g.to} districtLabel={d.districtLabel}
      paragraphs={d.letter.body.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean)}
      signer={d.letter.signer}
      // the STAFF letter is signed with a whole line the admin wrote; district letters with "○○교구 교구장 ○○○ 목사 올림"
      signLine={d.audience === "staff" ? d.letter.signer : null}
      photos={d.letter.photos.map((p) => p.url)}
      tracks={d.tracks.map((t) => ({ url: t.url, title: t.title, artist: t.artist }))}
      numbers={d.numbers}
      // 인도자: pass the VIP letter of the same district on to the companions (they gave no phone number)
      forwardPath={d.audience === "leader" ? `/letter/${letterCode(d.district, "vip")}` : null}
    />
  );
}
