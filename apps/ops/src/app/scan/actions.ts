"use server";

import { hashPassToken, isPassTokenShape } from "@fil/domain";
import type { CheckinResult, ReservationSummary, SeatMapCell } from "@fil/supabase";
import { supabaseServer } from "@/lib/supabase-server";

async function db() {
  const client = await supabaseServer();
  if (!client) throw new Error("Supabase is not configured");
  return client;
}

export async function searchReservations(query: string): Promise<ReservationSummary[]> {
  const { data, error } = await (await db()).rpc("find_reservations", { p_query: query });
  if (error) throw new Error(error.message);
  return (data ?? []) as ReservationSummary[];
}

/** Accepts either a raw token or a full pass URL scanned from a QR code. */
export async function lookupByPass(scanned: string): Promise<ReservationSummary | null> {
  const token = scanned.trim().split("/").pop()?.split("?")[0] ?? "";
  if (!isPassTokenShape(token)) return null;
  const { data, error } = await (await db()).rpc("lookup_reservation_by_pass", { p_token_hash: await hashPassToken(token) });
  if (error) throw new Error(error.message);
  return (data as ReservationSummary | null) ?? null;
}

/** The whole chart with current assignments — refreshed every time a party is opened. */
export async function loadSeatMap(): Promise<SeatMapCell[]> {
  const { data, error } = await (await db()).rpc("seat_map");
  if (error) throw new Error(error.message);
  return (data ?? []) as SeatMapCell[];
}

export async function confirmCheckin(input: {
  reservationId: string; stationCode: string; arrivedCount: number; method: "qr" | "manual";
  distributions: Record<string, number>; seatIds: string[]; manual: boolean;
}): Promise<CheckinResult> {
  const { data, error } = await (await db()).rpc("perform_checkin", {
    p_reservation_id: input.reservationId, p_station_code: input.stationCode, p_arrived_count: input.arrivedCount,
    p_method: input.method, p_distributions: input.distributions, p_seat_ids: input.seatIds, p_manual: input.manual,
  });
  if (error) throw new Error(error.message);
  return data as CheckinResult;
}

/** Move an already checked-in party (staff picked new seats on the chart). */
export async function reassignSeats(reservationId: string, seatIds: string[]): Promise<string | null> {
  const { data, error } = await (await db()).rpc("reassign_seats", { p_reservation_id: reservationId, p_seat_ids: seatIds, p_manual: true });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

/** Admin only (RLS): undo a check-in and free its seats. The party can then be checked in again. */
export async function voidCheckin(checkinId: string, reservationId: string): Promise<void> {
  const client = await db();
  const { error } = await client.from("checkins").update({ voided_at: new Date().toISOString() }).eq("id", checkinId);
  if (error) throw new Error(error.message);
  const { error: e2 } = await client.rpc("reassign_seats", { p_reservation_id: reservationId, p_seat_ids: [], p_manual: true });
  if (e2) throw new Error(e2.message);
}

// ---------- re-scan: hospitality items already given (RPCs from migration 0007) ----------
/** {code: qty} of what this check-in already received. Staff cannot read distributions directly. */
export async function loadCheckinItems(checkinId: string): Promise<Record<string, number>> {
  const { data, error } = await (await db()).rpc("checkin_items" as never, { p_checkin_id: checkinId } as never);
  if (error) throw new Error(error.message.includes("checkin_items") ? "DB 함수가 없습니다 (0007 SQL 실행 필요)." : error.message);
  return (data ?? {}) as Record<string, number>;
}
/** Hand out the items that were missed; items already given stay as they were. */
export async function addCheckinItems(checkinId: string, items: Record<string, number>): Promise<Record<string, number>> {
  const { data, error } = await (await db()).rpc("add_checkin_items" as never, { p_checkin_id: checkinId, p_items: items } as never);
  if (error) throw new Error(error.message);
  return (data ?? {}) as Record<string, number>;
}

// ---------- return shuttle desk ----------
export type ReturnRun = { id: string; label: string; capacity: number; booked: number; available: number };
export async function loadReturnBoard(): Promise<ReturnRun[]> {
  const { data, error } = await (await db()).rpc("return_board" as never);
  if (error) throw new Error(error.message.includes("return_board") ? "DB 함수가 없습니다 (0007 SQL 실행 필요)." : error.message);
  return (data ?? []) as ReturnRun[];
}
/** Book or move a party onto a return run (runId), or cancel (null). Refused when the bus is full. */
export async function bookReturn(reservationId: string, runId: string | null): Promise<ReturnRun[]> {
  const { data, error } = await (await db()).rpc("book_return" as never, { p_reservation_id: reservationId, p_run_id: runId } as never);
  if (error) throw new Error(error.message);
  return (data ?? []) as ReturnRun[];
}
