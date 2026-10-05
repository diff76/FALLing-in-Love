import { NextResponse } from "next/server";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@fil/supabase";
import { loadPrefill, reservationForToken } from "@/lib/reservation-edit";

export const dynamic = "force-dynamic";

/** The sign-up behind a Pass link, to reopen it in the form (/apply?edit=<token>). */
export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured()) return NextResponse.json({ message: "신청 저장소가 아직 연결되지 않았습니다." }, { status: 503 });
  const db = createAdminSupabaseClient();
  const id = await reservationForToken(db, new URL(request.url).searchParams.get("token"));
  const data = id ? await loadPrefill(db, id) : null;
  if (!data) return NextResponse.json({ message: "이 Pass로는 신청을 찾을 수 없습니다. 취소되었거나 새 링크로 바뀌었을 수 있습니다." }, { status: 404 });
  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
