import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@fil/supabase";
import { isAdminToken, OMS_BUCKET, photoKey, trackKey } from "@/lib/oms";

export const dynamic = "force-dynamic";

/**
 * Admin: get a one-time signed upload URL. The browser then uploads straight to storage
 * (no Vercel body limit). Body: {kind:"photo"} or {kind:"track", title, artist, order, ext}.
 */
export async function POST(request: Request) {
  if (!(await isAdminToken(request.headers.get("authorization")))) return NextResponse.json({ message: "관리자만 올릴 수 있습니다." }, { status: 403 });
  const b = (await request.json().catch(() => ({}))) as { kind?: string; title?: string; artist?: string; order?: number; ext?: string };
  let key: string;
  if (b.kind === "photo") key = photoKey();
  else if (b.kind === "track" && b.title?.trim()) key = trackKey(Math.max(0, Math.min(9999, Math.round(b.order ?? 0))), b.title.slice(0, 120), (b.artist ?? "").slice(0, 120), b.ext ?? "mp3");
  else return NextResponse.json({ message: "곡 제목이 필요합니다." }, { status: 400 });
  const { data, error } = await createAdminSupabaseClient().storage.from(OMS_BUCKET).createSignedUploadUrl(key);
  if (error || !data) return NextResponse.json({ message: error?.message ?? "업로드 주소를 만들지 못했습니다." }, { status: 500 });
  return NextResponse.json({ key, token: data.token });
}
