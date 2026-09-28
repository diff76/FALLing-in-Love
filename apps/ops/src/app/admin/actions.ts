"use server";

import { getSession } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase-server";

/**
 * Cancel / restore a reservation (admin only; RLS "admin edits reservations" enforces it too).
 * Cancelling only flips status to 'cancelled' — nothing is deleted, so it can be undone. Every
 * other surface (pass, name search, check-in, stats, parking, desk) already reads active rows only.
 * A party that had already checked in is un-checked-in first and its seats are released.
 */
async function adminDb() {
  const s = await getSession();
  if (!s?.roles.includes("admin")) throw new Error("관리자만 신청을 취소할 수 있습니다.");
  const db = await supabaseServer();
  if (!db) throw new Error("Supabase is not configured");
  return db;
}

export async function cancelReservation(reservationId: string): Promise<void> {
  const db = await adminDb();
  const { data: live } = await db.from("checkins").select("id").eq("reservation_id", reservationId).is("voided_at", null);
  if (live?.length) {
    const { error: vErr } = await db.from("checkins").update({ voided_at: new Date().toISOString() }).in("id", live.map((c) => c.id));
    if (vErr) throw new Error(vErr.message);
  }
  // release any seats (no-op when none were assigned)
  const { error: sErr } = await db.rpc("reassign_seats", { p_reservation_id: reservationId, p_seat_ids: [], p_manual: true });
  if (sErr) throw new Error(sErr.message);
  const { error } = await db.from("reservations").update({ status: "cancelled" }).eq("id", reservationId).eq("status", "active");
  if (error) throw new Error(error.message);
}

export async function restoreReservation(reservationId: string): Promise<void> {
  const db = await adminDb();
  const { data: r } = await db.from("reservations").select("applicant_name, phone").eq("id", reservationId).single();
  if (!r) throw new Error("신청을 찾을 수 없습니다.");
  // the same phone may have signed up again after the cancel — never end up with two live sign-ups
  const { data: clash } = await db.from("reservations").select("code").eq("status", "active").eq("phone", r.phone).limit(1);
  if (clash?.length) throw new Error(`같은 연락처로 이미 유효한 신청(${clash[0].code})이 있어 되돌릴 수 없습니다.`);
  const { error } = await db.from("reservations").update({ status: "active" }).eq("id", reservationId).eq("status", "cancelled");
  if (error) throw new Error(error.code === "23505" ? "같은 성함·연락처로 이미 유효한 신청이 있어 되돌릴 수 없습니다." : error.message);
}
