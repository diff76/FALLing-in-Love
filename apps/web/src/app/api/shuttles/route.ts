import { NextResponse } from "next/server";
import { eventConfig } from "@fil/config";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@fil/supabase";

export const dynamic = "force-dynamic";

export type RunSeats = { direction: "outbound" | "return"; label: string; capacity: number; available: number };

/**
 * Public: seats left on each active shuttle run, for the sign-up form (counts only, no names).
 * Every run is one bus (25 seats unless an admin changed it). The real guard is in
 * create_reservation (it locks the run), so this only has to be fresh, not exact.
 */
export async function GET() {
  if (!isSupabaseAdminConfigured()) return NextResponse.json({ runs: [] });
  const db = createAdminSupabaseClient();
  const [{ data: runs }, { data: rows }] = await Promise.all([
    db.from("shuttle_runs").select("id, direction, label, capacity").eq("active", true).order("departs_at"),
    db.from("reservations").select("outbound_run_id, return_run_id, party_size").eq("status", "active"),
  ]);
  const booked = new Map<string, number>();
  (rows ?? []).forEach((r) => {
    if (r.outbound_run_id) booked.set(r.outbound_run_id, (booked.get(r.outbound_run_id) ?? 0) + r.party_size);
    if (r.return_run_id) booked.set(r.return_run_id, (booked.get(r.return_run_id) ?? 0) + r.party_size);
  });
  const out: RunSeats[] = (runs ?? []).map((r) => {
    const capacity = r.capacity ?? eventConfig.shuttle.returnSeats;
    return { direction: r.direction as RunSeats["direction"], label: r.label, capacity, available: Math.max(capacity - (booked.get(r.id) ?? 0), 0) };
  });
  return NextResponse.json({ runs: out }, { headers: { "Cache-Control": "no-store" } });
}
