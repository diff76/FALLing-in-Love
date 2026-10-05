// Server only (service-role key and the grant secret). Import from route handlers, never from "use client" files.
import { createHmac, timingSafeEqual } from "node:crypto";
import { formatPhone, hashPassToken, isPassTokenShape } from "@fil/domain";
import type { Db } from "@fil/supabase";

/**
 * Changing a sign-up after it was made. Two ways in:
 *  - the Pass link (whoever holds the Pass already holds the reservation), or
 *  - name + phone on the sign-up page (both must match an active sign-up exactly). That proof is turned
 *    into a short-lived signed grant so the following save / Pass re-issue need not ask again.
 * Web edits stop once the party has checked in; staff change things at the desk from then on.
 */
export type Prefill = {
  code: string; kind: "host" | "guest_self"; attendance: "main" | "worship"; worshipService: string; worshipSite: string;
  applicantName: string; phone: string; districtCode: string; inviterName: string; ageGroup: string;
  members: { name: string; relation: string; ageGroup: string; dietaryNote: string }[];
  transport: "shuttle" | "car" | "other"; outboundRun: string; returnRun: string; vehiclePlate: string; dietaryNote: string;
  contactConsent: boolean; checkedIn: boolean;
};

const GRANT_TTL_MS = 30 * 60 * 1000;
const secret = () => `${process.env.SUPABASE_SECRET_KEY ?? ""}:reservation-edit`;
const sign = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

export function signGrant(reservationId: string): string {
  const body = Buffer.from(`${reservationId}.${Date.now() + GRANT_TTL_MS}`).toString("base64url");
  return `${body}.${sign(body)}`;
}
export function verifyGrant(grant: unknown): string | null {
  if (typeof grant !== "string") return null;
  const [body, mac] = grant.split(".");
  if (!body || !mac) return null;
  const expect = sign(body);
  if (expect.length !== mac.length || !timingSafeEqual(Buffer.from(expect), Buffer.from(mac))) return null;
  const [id, exp] = Buffer.from(body, "base64url").toString().split(".");
  return id && Number(exp) > Date.now() ? id : null;
}

/** The reservation behind a Pass link (active pass, active reservation). */
export async function reservationForToken(db: Db, token: unknown): Promise<string | null> {
  if (typeof token !== "string" || !isPassTokenShape(token)) return null;
  const { data } = await db.from("passes").select("reservation_id, reservations!inner(status)").eq("token_hash", await hashPassToken(token)).is("revoked_at", null).maybeSingle();
  const row = data as { reservation_id: string; reservations: { status: string } } | null;
  return row && row.reservations.status === "active" ? row.reservation_id : null;
}

/** name + phone → the matching active reservation (both must match; spaces in the name are ignored). */
export async function reservationForNamePhone(db: Db, name: string, phoneDigits: string): Promise<string | null> {
  const { data } = await db.from("reservations").select("id, applicant_name").eq("status", "active").eq("phone", phoneDigits);
  const want = name.replace(/\s+/g, "");
  return (data ?? []).find((r) => r.applicant_name.replace(/\s+/g, "") === want)?.id ?? null;
}

export async function isCheckedIn(db: Db, reservationId: string): Promise<boolean> {
  const { count } = await db.from("checkins").select("id", { count: "exact", head: true }).eq("reservation_id", reservationId).is("voided_at", null);
  return (count ?? 0) > 0;
}

/** Everything the sign-up form needs to reopen a reservation as it was saved. */
export async function loadPrefill(db: Db, reservationId: string): Promise<Prefill | null> {
  const { data: r } = await db.from("reservations")
    .select("code, kind, attendance, worship_service, worship_site, applicant_name, phone, district_code, inviter_name, age_group, transport, outbound_run_id, return_run_id, vehicle_plate, dietary_note, contact_consent")
    .eq("id", reservationId).eq("status", "active").maybeSingle();
  if (!r) return null;
  const runIds = [r.outbound_run_id, r.return_run_id].filter(Boolean) as string[];
  const [{ data: members }, { data: runs }, checkedIn] = await Promise.all([
    db.from("reservation_members").select("name, relation, age_group, dietary_note").eq("reservation_id", reservationId).order("position"),
    runIds.length ? db.from("shuttle_runs").select("id, label").in("id", runIds) : Promise.resolve({ data: [] as { id: string; label: string }[] }),
    isCheckedIn(db, reservationId),
  ]);
  const label = (id: string | null) => (runs ?? []).find((x) => x.id === id)?.label ?? "";
  return {
    code: r.code, kind: r.kind as Prefill["kind"], attendance: (r.attendance ?? "main") as Prefill["attendance"],
    worshipService: r.worship_service == null ? "" : String(r.worship_service), worshipSite: r.worship_site ?? "",
    applicantName: r.applicant_name, phone: formatPhone(r.phone), districtCode: r.district_code ?? "", inviterName: r.inviter_name ?? "", ageGroup: r.age_group ?? "",
    members: (members ?? []).map((m) => ({ name: m.name, relation: m.relation ?? "", ageGroup: m.age_group ?? "", dietaryNote: m.dietary_note ?? "" })),
    transport: r.transport as Prefill["transport"], outboundRun: label(r.outbound_run_id), returnRun: label(r.return_run_id),
    vehiclePlate: r.vehicle_plate ?? "", dietaryNote: r.dietary_note ?? "", contactConsent: !!r.contact_consent, checkedIn,
  };
}

/** Database error → the message a guest sees (shared by create and update). */
export function reservationError(error: { code?: string; message?: string } | null): { status: number; body: Record<string, unknown> } {
  if (error?.code === "P0005" || error?.code === "P0006") {
    const outbound = error.code === "P0005";
    const left = Number(error.message?.split(":")[1] ?? 0);
    const what = outbound ? "셔틀 편" : "돌아가는 셔틀";
    const text = left > 0 ? `선택하신 ${what}은 이제 ${left}석만 남아 일행 모두 타실 수 없습니다. 다른 시간을 골라 주세요.` : `선택하신 ${what}은 방금 만차가 되었습니다. 다른 시간을 골라 주세요.`;
    return { status: 409, body: { message: text, fieldErrors: { [outbound ? "outboundRun" : "returnRun"]: left > 0 ? `${left}석 남음` : "만차" }, seatsChanged: true } };
  }
  if (error?.code === "P0008") return { status: 409, body: { message: "체크인을 마친 신청은 웹에서 수정할 수 없습니다. 현장 웰컴 데스크에 말씀해 주세요." } };
  if (error?.code === "P0007") return { status: 404, body: { message: "신청을 찾을 수 없습니다. 취소되었을 수 있습니다." } };
  if (error?.message?.includes("duplicate") || error?.code === "P0002" || error?.code === "23505") {
    return { status: 409, body: { message: "이 연락처로 이미 신청이 접수되어 있습니다.", fieldErrors: { phone: "이미 신청된 연락처입니다" }, duplicatePhone: true } };
  }
  if (error?.message?.includes("update_reservation")) return { status: 503, body: { message: "수정 기능을 준비 중입니다. 잠시 후 다시 시도해 주세요." } };
  return { status: 500, body: { message: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." } };
}
