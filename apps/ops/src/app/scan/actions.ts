"use server";

import { hashPassToken, isPassTokenShape } from "@fil/domain";
import type { CheckinResult, ReservationSummary } from "@fil/supabase";
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

export async function confirmCheckin(input: { reservationId: string; stationCode: string; arrivedCount: number; method: "qr" | "manual"; distributions: Record<string, number> }): Promise<CheckinResult> {
  const { data, error } = await (await db()).rpc("perform_checkin", {
    p_reservation_id: input.reservationId, p_station_code: input.stationCode, p_arrived_count: input.arrivedCount,
    p_method: input.method, p_distributions: input.distributions,
  });
  if (error) throw new Error(error.message);
  return data as CheckinResult;
}
