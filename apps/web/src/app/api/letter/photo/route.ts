import { NextResponse } from "next/server";
import { LETTER_AUDIENCES, type LetterAudience } from "@fil/domain";
import { districtForEditorToken, letterPhotos, photoUploadTicket, removeLetterPhoto } from "@/lib/letters";

export const dynamic = "force-dynamic";

const denied = () => NextResponse.json({ message: "편지 작성 링크가 바뀌었거나 사용이 끝났습니다. 관리자에게 새 링크를 요청해 주세요." }, { status: 403 });
const fail = (e: unknown) => NextResponse.json({ message: (e as Error).message || "처리하지 못했습니다." }, { status: 400 });

/**
 * Photos on a letter, through the pastor's link.
 * POST {token, audience} → a one-time upload address (the browser uploads the shrunk JPEG itself).
 * DELETE {token, key} → remove one photo.  PUT {token, audience} → the letter's photos now.
 */
export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { token?: string; audience?: string };
  const district = await districtForEditorToken(b.token);
  if (!district) return denied();
  if (!LETTER_AUDIENCES.includes(b.audience as LetterAudience)) return fail(new Error("편지를 골라 주세요."));
  try { return NextResponse.json(await photoUploadTicket(district, b.audience as LetterAudience)); } catch (e) { return fail(e); }
}

export async function PUT(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { token?: string; audience?: string };
  const district = await districtForEditorToken(b.token);
  if (!district) return denied();
  if (!LETTER_AUDIENCES.includes(b.audience as LetterAudience)) return fail(new Error("편지를 골라 주세요."));
  return NextResponse.json({ photos: await letterPhotos(district, b.audience as LetterAudience) }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { token?: string; key?: string };
  const district = await districtForEditorToken(b.token);
  if (!district) return denied();
  try { await removeLetterPhoto(district, String(b.key ?? "")); return NextResponse.json({ ok: true }); } catch (e) { return fail(e); }
}
