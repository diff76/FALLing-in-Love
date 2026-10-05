"use server";

import { formatPhone, reservationInputSchema } from "@fil/domain";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@fil/supabase";
import { getSession } from "@/lib/auth";

export type AdminEditData = {
  id: string; code: string; kind: "host" | "guest_self"; attendance: "main" | "worship"; worshipService: string; worshipSite: string;
  applicantName: string; phone: string; districtCode: string; inviterName: string; ageGroup: string;
  members: { name: string; relation: string; ageGroup: string; dietaryNote: string }[];
  transport: "shuttle" | "car" | "other"; outboundRun: string; returnRun: string; vehiclePlate: string; dietaryNote: string;
  contactConsent: boolean; checkedIn: boolean; source: string;
};

/** Admin only: service-role access, so the caller's admin role is checked here first. */
async function adminDb() {
  const s = await getSession();
  if (!s?.roles.includes("admin")) throw new Error("관리자만 신청을 수정할 수 있습니다.");
  if (!isSupabaseAdminConfigured()) throw new Error("SUPABASE_SECRET_KEY가 설정되지 않았습니다.");
  return createAdminSupabaseClient();
}

export async function loadReservationForEdit(id: string): Promise<AdminEditData | null> {
  const db = await adminDb();
  const { data: r } = await db.from("reservations")
    .select("id, code, kind, attendance, worship_service, worship_site, applicant_name, phone, district_code, inviter_name, age_group, transport, outbound_run_id, return_run_id, vehicle_plate, dietary_note, contact_consent, source")
    .eq("id", id).eq("status", "active").maybeSingle();
  if (!r) return null;
  const [{ data: members }, { data: runs }, { count }] = await Promise.all([
    db.from("reservation_members").select("name, relation, age_group, dietary_note").eq("reservation_id", id).order("position"),
    db.from("shuttle_runs").select("id, label"),
    db.from("checkins").select("id", { count: "exact", head: true }).eq("reservation_id", id).is("voided_at", null),
  ]);
  const label = (rid: string | null) => (runs ?? []).find((x) => x.id === rid)?.label ?? "";
  return {
    id: r.id, code: r.code, kind: r.kind as AdminEditData["kind"], attendance: (r.attendance ?? "main") as AdminEditData["attendance"],
    worshipService: r.worship_service == null ? "" : String(r.worship_service), worshipSite: r.worship_site ?? "",
    applicantName: r.applicant_name, phone: formatPhone(r.phone), districtCode: r.district_code ?? "", inviterName: r.inviter_name ?? "", ageGroup: r.age_group ?? "",
    members: (members ?? []).map((m) => ({ name: m.name, relation: m.relation ?? "", ageGroup: m.age_group ?? "", dietaryNote: m.dietary_note ?? "" })),
    transport: r.transport as AdminEditData["transport"], outboundRun: label(r.outbound_run_id), returnRun: label(r.return_run_id),
    vehiclePlate: r.vehicle_plate ?? "", dietaryNote: r.dietary_note ?? "", contactConsent: !!r.contact_consent, checkedIn: (count ?? 0) > 0, source: r.source ?? "web",
  };
}

/**
 * Save an admin's changes (update_reservation with p_admin: allowed after check-in, may exceed a bus).
 * Returns an error message, or null when saved — never throws (production hides thrown messages).
 */
export async function adminUpdateReservation(id: string, input: Record<string, unknown>): Promise<{ error: string | null; fieldErrors?: Record<string, string> }> {
  try {
    const db = await adminDb();
    const parsed = reservationInputSchema.safeParse({ ...input, privacyConsent: true });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) { const key = String(issue.path[0] ?? "form"); if (!fieldErrors[key]) fieldErrors[key] = issue.message; }
      return { error: "입력 내용을 확인해 주세요.", fieldErrors };
    }
    const { error } = await db.rpc("update_reservation" as never, { p_id: id, payload: parsed.data, p_admin: true } as never);
    if (!error) return { error: null };
    if (error.code === "P0002" || error.message.includes("duplicate")) return { error: "같은 연락처로 다른 유효한 신청이 있습니다.", fieldErrors: { phone: "다른 신청과 중복" } };
    if (error.code === "P0007") return { error: "신청을 찾을 수 없습니다(취소되었을 수 있습니다)." };
    if (error.message.includes("update_reservation")) return { error: "DB 함수가 아직 없습니다 — Supabase SQL Editor에서 0010 SQL을 실행해 주세요." };
    return { error: error.message };
  } catch (e) { return { error: (e as Error).message }; }
}
