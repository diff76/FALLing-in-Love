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

/**
 * Seats on one shuttle bus, outbound or return (admins; RLS "admin writes runs"). Web sign-ups and the
 * return desk count bookings against it. Returns an error message instead of throwing (production hides
 * thrown server-action messages).
 */
export async function setRunCapacity(runId: string, capacity: number): Promise<string | null> {
  try {
    const db = await adminDb();
    if (!Number.isInteger(capacity) || capacity < 0 || capacity > 200) return "좌석 수는 0~200 사이 숫자로 넣어주세요.";
    const { error } = await db.from("shuttle_runs").update({ capacity }).eq("id", runId);
    return error ? error.message : null;
  } catch (e) { return (e as Error).message; }
}

/**
 * Starting stock of one hospitality item (admins; RLS "desk adjusts items"). The desk's −/+ nudges
 * stay in `adjustment`, so left = initial + adjustment − handed out. Returns an error message
 * instead of throwing: production builds hide thrown server-action messages (React #441).
 */
export async function setInitialStock(itemId: string, qty: number): Promise<string | null> {
  try {
    const db = await adminDb();
    if (!Number.isInteger(qty) || qty < 0 || qty > 10000) return "수량은 0~10000 사이 숫자로 넣어주세요.";
    const { error } = await db.from("hospitality_items").update({ initial_stock: qty }).eq("id", itemId);
    return error ? error.message : null;
  } catch (e) { return (e as Error).message; }
}
