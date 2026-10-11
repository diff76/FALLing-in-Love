import { NextResponse } from "next/server";
import { normalizePhone } from "@fil/domain";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@fil/supabase";
import { loadPrefill, reservationsForLookup, signGrant } from "@/lib/reservation-edit";

export const dynamic = "force-dynamic";

/**
 * "이미 신청하셨나요?": the name or the phone of an existing sign-up (either one; both given must both match)
 * → its contents and a 30-minute grant to change it (or to get a new Pass link). Several sign-ups under one
 * name → ask for the phone as well.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { name?: string; phone?: string };
  const name = String(body.name ?? "").trim(), rawPhone = String(body.phone ?? "").trim(), phone = normalizePhone(rawPhone);
  if (!name && !rawPhone) return NextResponse.json({ message: "신청하신 분의 성함이나 연락처 중 하나를 적어 주세요." }, { status: 422 });
  if (rawPhone && !(phone.length === 10 || phone.length === 11)) return NextResponse.json({ message: "연락처를 정확히 적어 주세요. (예: 010-0000-0000)" }, { status: 422 });
  if (!isSupabaseAdminConfigured()) return NextResponse.json({ message: "신청 저장소가 아직 연결되지 않았습니다." }, { status: 503 });
  const db = createAdminSupabaseClient();
  const ids = await reservationsForLookup(db, name, phone);
  if (ids.length > 1) return NextResponse.json({ message: "같은 성함으로 신청이 여러 건 있습니다. 연락처를 함께 넣어 주세요." }, { status: 409 });
  const id = ids[0];
  const data = id ? await loadPrefill(db, id) : null;
  if (!id || !data) return NextResponse.json({ message: name && phone ? "성함과 연락처가 함께 일치하는 신청을 찾지 못했습니다. 신청하실 때 적은 그대로 입력해 주세요." : "일치하는 신청을 찾지 못했습니다. 신청하실 때 적은 그대로 입력해 주세요." }, { status: 404 });
  return NextResponse.json({ grant: signGrant(id), data }, { headers: { "Cache-Control": "no-store" } });
}
