"use server";

import { generatePassToken, hashPassToken, reservationInputSchema, type ReservationInput } from "@fil/domain";
import { supabaseServer } from "@/lib/supabase-server";

async function db() {
  const client = await supabaseServer();
  if (!client) throw new Error("Supabase is not configured");
  return client;
}

export type ImportRowResult = { row: number; name: string; ok: boolean; code?: string; message?: string };

/** Which of the uploaded (name, phone) pairs are already registered — shown before anything is written. */
export async function checkDuplicates(rows: { name: string; phone: string }[]): Promise<{ name: string; phone: string; code: string }[]> {
  const { data, error } = await (await db()).rpc("find_duplicates", { p_rows: rows });
  if (error) throw new Error(error.message);
  return (data ?? []) as { name: string; phone: string; code: string }[];
}

/**
 * Register hand-written sign-ups one by one through the same validated path the website
 * uses (admin only, `source = import`). Each row gets its own pass token so the party can
 * still be found by name and, if the token is ever printed, scanned.
 */
export async function importRows(rows: (ReservationInput & { rowNo: number })[]): Promise<ImportRowResult[]> {
  const client = await db();
  const out: ImportRowResult[] = [];
  for (const raw of rows) {
    const { rowNo, ...input } = raw;
    const parsed = reservationInputSchema.safeParse(input);
    if (!parsed.success) { out.push({ row: rowNo, name: String(input.applicantName ?? ""), ok: false, message: parsed.error.issues[0]?.message ?? "입력 오류" }); continue; }
    const tokenHash = await hashPassToken(generatePassToken());
    const { data, error } = await client.rpc("admin_create_reservation", { payload: parsed.data, token_hash: tokenHash });
    if (error || !data) {
      const dup = error?.message?.includes("duplicate") || error?.code === "P0002" || error?.code === "23505";
      out.push({ row: rowNo, name: parsed.data.applicantName, ok: false, message: dup ? "이미 등록된 성함·연락처" : (error?.message ?? "저장 실패") });
    } else {
      out.push({ row: rowNo, name: parsed.data.applicantName, ok: true, code: data.code });
    }
  }
  return out;
}
