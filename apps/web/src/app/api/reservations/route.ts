import { NextResponse } from "next/server";
import { generatePassToken, hashPassToken, reservationInputSchema } from "@fil/domain";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@fil/supabase";

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
  const { data, error } = await db.rpc("create_reservation", { payload: parsed.data, token_hash: tokenHash });
  if (error || !data) {
    if (error?.message?.includes("duplicate") || error?.code === "P0002" || error?.code === "23505") {
      return NextResponse.json({ message: "같은 성함과 연락처로 이미 신청이 접수되어 있습니다. 변경이 필요하시면 교회로 연락해 주세요." }, { status: 409 });
    }
    console.error("create_reservation failed", error);
    return NextResponse.json({ message: "신청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
  return NextResponse.json({ code: data.code, partySize: data.party_size, token }, { status: 201 });
}
