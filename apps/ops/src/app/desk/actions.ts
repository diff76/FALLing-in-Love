"use server";

import { supabaseServer } from "@/lib/supabase-server";

/** Desk/admin: nudge a hospitality item's stock adjustment (RLS "desk adjusts items"). */
export async function adjustStock(itemId: string, delta: number): Promise<void> {
  const client = await supabaseServer();
  if (!client) throw new Error("Supabase is not configured");
  const { data } = await client.from("hospitality_items").select("adjustment").eq("id", itemId).single();
  const { error } = await client.from("hospitality_items").update({ adjustment: (data?.adjustment ?? 0) + delta }).eq("id", itemId);
  if (error) throw new Error(error.message);
}
