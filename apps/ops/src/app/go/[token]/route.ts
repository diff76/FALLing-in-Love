import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@fil/supabase";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/** ?station=<code> on an access link opens 스캔·체크인 with that station already picked (staff phones at a fixed post). */
const STATIONS = ["gate", "landing", "chapel", "return"];

/**
 * One-tap access: /go/<token> signs the linked staff account in and lands on its home screen
 * (or on the scan desk at a given station with ?station=gate etc.).
 * The token is looked up by hash; then a magic-link OTP is minted server-side for that user
 * and verified on the cookie-bound client, which is exactly a normal sign-in (same roles,
 * same session length). Expired/revoked/unknown → /login with a notice.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const fail = () => NextResponse.redirect(new URL("/login?link=invalid", request.url));
  if (!/^[A-Za-z0-9_-]{32,80}$/.test(token) || !isSupabaseAdminConfigured()) return fail();
  const admin = createAdminSupabaseClient();
  const hash = createHash("sha256").update(token).digest("hex");
  const { data: link } = await admin.from("access_links").select("id, profile_id, expires_at, revoked_at, use_count").eq("token_hash", hash).maybeSingle();
  if (!link || link.revoked_at || new Date(link.expires_at).getTime() < Date.now()) return fail();
  const { data: user } = await admin.auth.admin.getUserById(link.profile_id);
  const email = user?.user?.email;
  if (!email) return fail();
  const { data: gen, error: genErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = gen?.properties?.hashed_token;
  if (genErr || !tokenHash) return fail();
  const db = await supabaseServer();
  if (!db) return fail();
  const { error } = await db.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (error) return fail();
  await admin.from("access_links").update({ last_used_at: new Date().toISOString(), use_count: link.use_count + 1 }).eq("id", link.id);
  const station = new URL(request.url).searchParams.get("station");
  return NextResponse.redirect(new URL(station && STATIONS.includes(station) ? `/scan?station=${station}` : "/", request.url));
}
