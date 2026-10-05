import { NextResponse } from "next/server";
import { normalizePhone } from "@fil/domain";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@fil/supabase";
import { loadPrefill, reservationForNamePhone, signGrant } from "@/lib/reservation-edit";

export const dynamic = "force-dynamic";

/**
 * "이미 신청하셨나요?": name + phone of an existing sign-up → its contents and a 30-minute grant to change it
 * (or to get a new Pass link). Both must match; a miss says the same thing either way, so it reveals nothing.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { name?: string; phone?: string };
  const name = String(body.name ?? "").trim(), phone = normalizePhone(String(body.phone ?? ""));
  if (!name || !(phone.length === 10 || phone.length === 11)) return NextResponse.json({ message: "신청하신 분의 성함과 연락처를 정확히 적어 주세요." }, { status: 422 });
  if (!isSupabaseAdminConfigured()) return NextResponse.json({ message: "신청 저장소가 아직 연결되지 않았습니다." }, { status: 503 });
  const db = createAdminSupabaseClient();
  const id = await reservationForNamePhone(db, name, phone);
  const data = id ? await loadPrefill(db, id) : null;
  if (!id || !data) return NextResponse.json({ message: "성함과 연락처가 함께 일치하는 신청을 찾지 못했습니다. 신청하실 때 적은 그대로 입력해 주세요." }, { status: 404 });
  return NextResponse.json({ grant: signGrant(id), data }, { headers: { "Cache-Control": "no-store" } });
}
