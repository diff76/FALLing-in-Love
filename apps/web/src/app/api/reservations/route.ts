import { NextResponse } from "next/server";
import { generatePassToken, hashPassToken, reservationInputSchema } from "@fil/domain";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@fil/supabase";
import { isCheckedIn, reservationError, reservationForToken, verifyGrant } from "@/lib/reservation-edit";

export const runtime = "nodejs";

/**
 * Public reservation write path. Anonymous callers never touch Supabase directly:
 * the server validates, generates the pass token, stores only its hash, and calls
 * the `create_reservation` RPC with the secret key. No seat is assigned here — seats
 * are given at check-in on the day, so a no-show never blocks a chair.
 */
export async function POST(request: Request) {
  let json: unknown;
  try { json = await request.json(); } catch { return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 }); }

  const parsed = reservationInputSchema.safeParse(json);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return NextResponse.json({ message: "입력 내용을 확인해 주세요.", fieldErrors }, { status: 422 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ message: "신청 저장소가 아직 연결되지 않았습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }

  const token = generatePassToken();
  const tokenHash = await hashPassToken(token);
  const db = createAdminSupabaseClient();
  const { data: same } = await db.from("reservations").select("code").eq("status", "active").eq("phone", parsed.data.phone).limit(1);
  if (same && same.length) {
    // not a dead end: the form offers to open that sign-up (name + phone) and change it
    return NextResponse.json({ message: "이 연락처로 이미 신청이 접수되어 있습니다.", fieldErrors: { phone: "이미 신청된 연락처입니다" }, duplicatePhone: true }, { status: 409 });
  }
  const { data, error } = await db.rpc("create_reservation", { payload: parsed.data, token_hash: tokenHash });
  if (error || !data) {
    if (!["P0002", "P0005", "P0006", "23505"].includes(error?.code ?? "") && !error?.message?.includes("duplicate")) console.error("create_reservation failed", error);
    const { status, body } = reservationError(error);
    return NextResponse.json(body, { status });
  }
  return NextResponse.json({ code: data.code, partySize: data.party_size, token }, { status: 201 });
}

/**
 * Change a sign-up. Body = the same input as a new sign-up plus `auth`: { token } (the Pass link) or
 * { grant } (from name + phone, see /api/reservations/lookup). Ticket number and Pass link stay the same.
 */
export async function PUT(request: Request) {
  let json: Record<string, unknown>;
  try { json = await request.json(); } catch { return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 }); }
  if (!isSupabaseAdminConfigured()) return NextResponse.json({ message: "신청 저장소가 아직 연결되지 않았습니다." }, { status: 503 });
  const db = createAdminSupabaseClient();
  const auth = (json.auth ?? {}) as { token?: string; grant?: string };
  const id = auth.token ? await reservationForToken(db, auth.token) : verifyGrant(auth.grant);
  if (!id) return NextResponse.json({ message: "수정 권한이 확인되지 않았습니다. Pass 링크로 다시 들어오시거나 성함·연락처로 다시 불러와 주세요." }, { status: 403 });
  if (await isCheckedIn(db, id)) return NextResponse.json(reservationError({ code: "P0008" }).body, { status: 409 });

  const parsed = reservationInputSchema.safeParse(json);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) { const key = String(issue.path[0] ?? "form"); if (!fieldErrors[key]) fieldErrors[key] = issue.message; }
    return NextResponse.json({ message: "입력 내용을 확인해 주세요.", fieldErrors }, { status: 422 });
  }
  const { data, error } = await db.rpc("update_reservation" as never, { p_id: id, payload: parsed.data, p_admin: false } as never);
  if (error || !data) {
    if (!["P0002", "P0005", "P0006", "P0008"].includes(error?.code ?? "")) console.error("update_reservation failed", error);
    const { status, body } = reservationError(error);
    return NextResponse.json(body, { status });
  }
  const r = data as { code: string; party_size: number };
  return NextResponse.json({ code: r.code, partySize: r.party_size });
}
