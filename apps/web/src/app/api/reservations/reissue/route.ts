import { NextResponse } from "next/server";
import { generatePassToken, hashPassToken } from "@fil/domain";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@fil/supabase";
import { verifyGrant } from "@/lib/reservation-edit";

export const dynamic = "force-dynamic";

/**
 * Lost the Pass link: with a grant (name + phone) issue a new one. The old link — and the companions'
 * invitation links built on it — stop working, because only one Pass per sign-up is ever valid.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { grant?: string };
  const id = verifyGrant(body.grant);
  if (!id) return NextResponse.json({ message: "확인 시간이 지났습니다. 성함과 연락처로 다시 불러와 주세요." }, { status: 403 });
  if (!isSupabaseAdminConfigured()) return NextResponse.json({ message: "신청 저장소가 아직 연결되지 않았습니다." }, { status: 503 });
  const db = createAdminSupabaseClient();
  const token = generatePassToken();
  const { data, error } = await db.from("passes").update({ token_hash: await hashPassToken(token), issued_at: new Date().toISOString() } as never).eq("reservation_id", id).is("revoked_at", null).select("id");
  if (error || !data?.length) return NextResponse.json({ message: "새 Pass를 만들지 못했습니다. 교회로 문의해 주세요." }, { status: 500 });
  return NextResponse.json({ token });
}
