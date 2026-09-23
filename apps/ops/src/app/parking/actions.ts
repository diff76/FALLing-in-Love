"use server";

import type { ParkingBoard } from "@fil/supabase";
import { supabaseServer } from "@/lib/supabase-server";

async function db() {
  const client = await supabaseServer();
  if (!client) throw new Error("Supabase is not configured");
  return client;
}

export async function loadParking(): Promise<ParkingBoard> {
  const { data, error } = await (await db()).rpc("parking_board");
  if (error) throw new Error(error.message);
  return data as ParkingBoard;
}

/** +1 / −1 on the occupied count, or a new capacity. */
export async function adjustParking(delta: number, capacity?: number): Promise<ParkingBoard["state"]> {
  const { data, error } = await (await db()).rpc("parking_adjust", { p_delta: delta, p_capacity: capacity ?? null });
  if (error) throw new Error(error.message);
  return data as ParkingBoard["state"];
}

export async function markVipArrived(reservationId: string, arrived: boolean): Promise<void> {
  const { error } = await (await db()).rpc("vip_mark", { p_reservation_id: reservationId, p_arrived: arrived });
  if (error) throw new Error(error.message);
}
