import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@fil/supabase";
import { isAdminToken, listOms, OMS_BUCKET } from "@/lib/oms";

export const dynamic = "force-dynamic";

/** Public: the playlist and the photo list (short CDN cache). */
export async function GET() {
  const data = await listOms();
  return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } });
}

/** Admin: delete one track or photo. Body {key}. */
export async function DELETE(request: Request) {
  if (!(await isAdminToken(request.headers.get("authorization")))) return NextResponse.json({ message: "관리자만 삭제할 수 있습니다." }, { status: 403 });
  const { key } = (await request.json().catch(() => ({}))) as { key?: string };
  if (!key || !/^(tracks|photos)\/[A-Za-z0-9._-]+$/.test(key)) return NextResponse.json({ message: "잘못된 파일입니다." }, { status: 400 });
  const { error } = await createAdminSupabaseClient().storage.from(OMS_BUCKET).remove([key]);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
