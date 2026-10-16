import { NextResponse } from "next/server";
import { LETTER_AUDIENCES } from "@fil/domain";
import { districtForEditorToken, saveDistrictLetters, type LetterDraft } from "@/lib/letters";

export const dynamic = "force-dynamic";

/** A district pastor saves the four letters of their district (the link's token decides which district). */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<LetterDraft> & { token?: string };
  const district = await districtForEditorToken(body.token);
  if (!district) return NextResponse.json({ message: "편지 작성 링크가 바뀌었거나 사용이 끝났습니다. 관리자에게 새 링크를 요청해 주세요." }, { status: 403 });
  try {
    const draft = Object.fromEntries(LETTER_AUDIENCES.map((a) => [a, String(body[a] ?? "")])) as LetterDraft;
    draft.signer = String(body.signer ?? "");
    await saveDistrictLetters(district, draft, "pastor");
    return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ message: (e as Error).message || "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
