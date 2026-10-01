"use server";

import { hashPassToken, isPassTokenShape } from "@fil/domain";
import type { CheckinResult, ReservationSummary, SeatMapCell } from "@fil/supabase";
import { supabaseServer } from "@/lib/supabase-server";

async function db() {
  const client = await supabaseServer();
  if (!client) throw new Error("Supabase is not configured");
  return client;
}

/**
 * Production builds replace the message of any error THROWN from a server action with
 * "Minified React error #441", so staff would never see "좌석이 부족합니다" and the like.
 * Every action here therefore returns its error as a value; the console unwraps it.
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const MIGRATION_0007 = /checkin_items|add_checkin_items|return_board|book_return/;
function friendly(message: string): string {
  if (/schema cache|does not exist/i.test(message) && MIGRATION_0007.test(message)) return "DB 함수가 아직 없습니다 — Supabase SQL Editor에서 0007 SQL을 실행해 주세요.";
  if (message === "forbidden") return "이 계정에는 이 작업 권한이 없습니다.";
  return message;
}
async function attempt<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try { return { ok: true, data: await fn() }; } catch (e) { return { ok: false, error: friendly((e as Error).message) }; }
}

export async function searchReservations(query: string): Promise<Result<ReservationSummary[]>> {
  return attempt(async () => {
    const { data, error } = await (await db()).rpc("find_reservations", { p_query: query });
    if (error) throw new Error(error.message);
    return (data ?? []) as ReservationSummary[];
  });
}

/** Accepts either a raw token or a full pass URL scanned from a QR code. */
export async function lookupByPass(scanned: string): Promise<Result<ReservationSummary | null>> {
  return attempt(async () => {
    const token = scanned.trim().split("/").pop()?.split("?")[0] ?? "";
    if (!isPassTokenShape(token)) return null;
    const { data, error } = await (await db()).rpc("lookup_reservation_by_pass", { p_token_hash: await hashPassToken(token) });
    if (error) throw new Error(error.message);
    return (data as ReservationSummary | null) ?? null;
  });
}

/** The whole chart with current assignments — refreshed every time a party is opened. */
export async function loadSeatMap(): Promise<Result<SeatMapCell[]>> {
  return attempt(async () => {
    const { data, error } = await (await db()).rpc("seat_map");
    if (error) throw new Error(error.message);
    return (data ?? []) as SeatMapCell[];
  });
}

export async function confirmCheckin(input: {
  reservationId: string; stationCode: string; arrivedCount: number; method: "qr" | "manual";
  distributions: Record<string, number>; seatIds: string[]; manual: boolean;
}): Promise<Result<CheckinResult>> {
  return attempt(async () => {
    const { data, error } = await (await db()).rpc("perform_checkin", {
      p_reservation_id: input.reservationId, p_station_code: input.stationCode, p_arrived_count: input.arrivedCount,
      p_method: input.method, p_distributions: input.distributions, p_seat_ids: input.seatIds, p_manual: input.manual,
    });
    if (error) throw new Error(error.message);
    return data as CheckinResult;
  });
}

/** Move an already checked-in party (staff picked new seats on the chart). */
export async function reassignSeats(reservationId: string, seatIds: string[]): Promise<Result<string | null>> {
  return attempt(async () => {
    const { data, error } = await (await db()).rpc("reassign_seats", { p_reservation_id: reservationId, p_seat_ids: seatIds, p_manual: true });
    if (error) throw new Error(error.message);
    return (data as string | null) ?? null;
  });
}

/** Admin only (RLS): undo a check-in and free its seats. The party can then be checked in again. */
export async function voidCheckin(checkinId: string, reservationId: string): Promise<Result<void>> {
  return attempt(async () => {
    const client = await db();
    const { error } = await client.from("checkins").update({ voided_at: new Date().toISOString() }).eq("id", checkinId);
    if (error) throw new Error(error.message);
    const { error: e2 } = await client.rpc("reassign_seats", { p_reservation_id: reservationId, p_seat_ids: [], p_manual: true });
    if (e2) throw new Error(e2.message);
  });
}

// ---------- re-scan: hospitality items already given (RPCs from migration 0007) ----------
/** {code: qty} of what this check-in already received. Staff cannot read distributions directly. */
export async function loadCheckinItems(checkinId: string): Promise<Result<Record<string, number>>> {
  return attempt(async () => {
    const { data, error } = await (await db()).rpc("checkin_items" as never, { p_checkin_id: checkinId } as never);
    if (error) throw new Error(error.message);
    return (data ?? {}) as Record<string, number>;
  });
}
/** Hand out the items that were missed; items already given stay as they were. */
export async function addCheckinItems(checkinId: string, items: Record<string, number>): Promise<Result<Record<string, number>>> {
  return attempt(async () => {
    const { data, error } = await (await db()).rpc("add_checkin_items" as never, { p_checkin_id: checkinId, p_items: items } as never);
    if (error) throw new Error(error.message);
    return (data ?? {}) as Record<string, number>;
  });
}

// ---------- return shuttle desk ----------
export type ReturnRun = { id: string; label: string; capacity: number; booked: number; available: number };
export async function loadReturnBoard(): Promise<Result<ReturnRun[]>> {
  return attempt(async () => {
    const { data, error } = await (await db()).rpc("return_board" as never);
    if (error) throw new Error(error.message);
    return (data ?? []) as ReturnRun[];
  });
}
/** Book or move a party onto a return run (runId), or cancel (null). Refused when the bus is full. */
export async function bookReturn(reservationId: string, runId: string | null): Promise<Result<ReturnRun[]>> {
  return attempt(async () => {
    const { data, error } = await (await db()).rpc("book_return" as never, { p_reservation_id: reservationId, p_run_id: runId } as never);
    if (error) throw new Error(error.message);
    return (data ?? []) as ReturnRun[];
  });
}
