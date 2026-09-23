"use server";

import { generatePassToken, hashPassToken, reservationInputSchema, type ReservationInput } from "@fil/domain";
import { supabaseServer } from "@/lib/supabase-server";

async function db() {
  const client = await supabaseServer();
  if (!client) throw new Error("Supabase is not configured");
  return client;
}

export type ImportRowResult = { row: number; name: string; ok: boolean; code?: string; message?: string };
/** How an uploaded row collides with an existing reservation. `phone` blocks; `name` needs an explicit override. */
export type DuplicateHit = { name: string; phone: string; code: string; by: "phone" | "name" };

/**
 * Collisions with what is already registered. Same phone = the same person, full stop.
 * Same name with a different phone is *probably* the same person typed with another
 * number — flagged, and only registered if the admin ticks "동명이인" on that row.
 */
export async function checkDuplicates(rows: { name: string; phone: string }[]): Promise<DuplicateHit[]> {
  if (!rows.length) return [];
  const client = await db();
  const phones = [...new Set(rows.map((r) => r.phone).filter(Boolean))];
  const names = [...new Set(rows.map((r) => r.name).filter(Boolean))];
  const { data, error } = await client.from("reservations").select("applicant_name, phone, code").eq("status", "active")
    .or(`phone.in.(${phones.map((p) => `"${p}"`).join(",")}),applicant_name.in.(${names.map((n) => `"${n.replace(/"/g, "")}"`).join(",")})`);
  if (error) throw new Error(error.message);
  const hits: DuplicateHit[] = [];
  for (const r of rows) {
    const byPhone = (data ?? []).find((x) => x.phone === r.phone);
    if (byPhone) { hits.push({ name: r.name, phone: r.phone, code: byPhone.code, by: "phone" }); continue; }
    const byName = (data ?? []).find((x) => x.applicant_name === r.name);
    if (byName) hits.push({ name: r.name, phone: r.phone, code: byName.code, by: "name" });
  }
  return hits;
}

/**
 * Register hand-written sign-ups one by one through the same validated path the website
 * uses (admin only, `source = import`). Duplicates are re-checked here, right before the
 * write, so nothing slips through between preview and confirm.
 */
export async function importRows(rows: (ReservationInput & { rowNo: number; allowSameName?: boolean })[]): Promise<ImportRowResult[]> {
  const client = await db();
  const out: ImportRowResult[] = [];
  const hits = await checkDuplicates(rows.map((r) => ({ name: String(r.applicantName ?? ""), phone: String(r.phone ?? "") })));
  const seenPhones = new Set<string>();
  for (const raw of rows) {
    const { rowNo, allowSameName, ...input } = raw;
    const parsed = reservationInputSchema.safeParse(input);
    if (!parsed.success) { out.push({ row: rowNo, name: String(input.applicantName ?? ""), ok: false, message: parsed.error.issues[0]?.message ?? "입력 오류" }); continue; }
    const hit = hits.find((h) => h.name === parsed.data.applicantName && h.phone === parsed.data.phone);
    if (hit && (hit.by === "phone" || !allowSameName)) { out.push({ row: rowNo, name: parsed.data.applicantName, ok: false, message: `건너뜀 · 이미 등록됨 (${hit.code}${hit.by === "name" ? ", 같은 성함" : ""})` }); continue; }
    if (seenPhones.has(parsed.data.phone)) { out.push({ row: rowNo, name: parsed.data.applicantName, ok: false, message: "건너뜀 · 파일 안 같은 연락처" }); continue; }
    seenPhones.add(parsed.data.phone);
    const tokenHash = await hashPassToken(generatePassToken());
    const { data, error } = await client.rpc("admin_create_reservation", { payload: parsed.data, token_hash: tokenHash });
    if (error || !data) {
      const dup = error?.message?.includes("duplicate") || error?.code === "P0002" || error?.code === "23505";
      out.push({ row: rowNo, name: parsed.data.applicantName, ok: false, message: dup ? "건너뜀 · 이미 등록됨" : (error?.message ?? "저장 실패") });
    } else {
      out.push({ row: rowNo, name: parsed.data.applicantName, ok: true, code: data.code });
    }
  }
  return out;
}
