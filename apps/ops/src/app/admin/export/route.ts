import * as XLSX from "xlsx";
import { districtName, eventConfig } from "@fil/config";
import { getSession } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const kst = (t: string | null | undefined) => (t ? new Date(t).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16) : "");
const phoneFmt = (d: string | null) => (!d ? "" : d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d);
const yes = (b: unknown) => (b ? "예" : "");

type Seat = { id: string; floor: number; row_label: string; row_index: number; num: number; wheelchair: boolean };
/** "1층 C열 3–4번" — the same wording as seat_label_for() in the database */
function seatLabel(seats: Seat[]): string {
  const rows = new Map<string, Seat[]>();
  [...seats].sort((a, b) => a.floor - b.floor || a.row_index - b.row_index || a.num - b.num).forEach((s) => {
    const k = `${s.floor}|${s.row_label}`; rows.set(k, [...(rows.get(k) ?? []), s]);
  });
  return [...rows.entries()].map(([k, list]) => {
    const [floor, row] = k.split("|");
    const nums = list.filter((s) => !s.wheelchair).map((s) => s.num);
    const spans: string[] = [];
    for (let i = 0; i < nums.length; ) { let j = i; while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++; spans.push(j > i ? `${nums[i]}–${nums[j]}` : `${nums[i]}`); i = j + 1; }
    const wc = list.length - nums.length;
    return [`${floor}층 ${row}열`, spans.length ? `${spans.join(",")}번` : "", wc ? `휠체어석${wc > 1 ? ` ${wc}` : ""}` : ""].filter(Boolean).join(" ");
  }).join(" · ");
}

/**
 * Admin: the active sign-ups as an Excel file — one sheet per team, one per person (applicant + companions).
 * Personal data: admins only, never cached.
 */
export async function GET() {
  const session = await getSession();
  if (!session?.roles.includes("admin")) return new Response("관리자만 내려받을 수 있습니다.", { status: 403 });
  const db = await supabaseServer();
  if (!db) return new Response("Supabase가 연결되지 않았습니다.", { status: 503 });

  const [res, mem, runs, chk, stations, assigns, seats] = await Promise.all([
    db.from("reservations").select("id, code, kind, applicant_name, phone, district_code, inviter_name, age_group, party_size, transport, outbound_run_id, return_run_id, vehicle_plate, mobility_support, mobility_note, dietary_note, contact_consent, attendance, worship_service, worship_site, source, created_at, updated_at").eq("status", "active").order("created_at"),
    db.from("reservation_members").select("reservation_id, position, name, relation, age_group, dietary_note").order("position"),
    db.from("shuttle_runs").select("id, label"),
    db.from("checkins").select("reservation_id, station_id, arrived_count, checked_in_at").is("voided_at", null),
    db.from("stations").select("id, name"),
    db.from("seat_assignments").select("reservation_id, seat_id"),
    db.from("seats").select("id, floor, row_label, row_index, num, wheelchair"),
  ]);
  if (res.error) return new Response(`명단을 읽지 못했습니다: ${res.error.message}`, { status: 500 });

  const rows = res.data ?? [];
  const members = mem.data ?? [];
  const run = (id: string | null) => (runs.data ?? []).find((r) => r.id === id)?.label ?? "";
  const station = (id: string) => (stations.data ?? []).find((s) => s.id === id)?.name ?? "";
  const checkin = new Map((chk.data ?? []).map((c) => [c.reservation_id, c]));
  const seatById = new Map(((seats.data ?? []) as Seat[]).map((s) => [s.id, s]));
  const seatsFor = new Map<string, Seat[]>();
  ((assigns.data ?? []) as { reservation_id: string; seat_id: string }[]).forEach((a) => {
    const s = seatById.get(a.seat_id); if (s) seatsFor.set(a.reservation_id, [...(seatsFor.get(a.reservation_id) ?? []), s]);
  });
  const attendance = (r: (typeof rows)[number]) => r.attendance === "worship"
    ? `예배만 ${r.worship_service ?? "?"}부 · ${eventConfig.worshipSites.find(([c]) => c === r.worship_site)?.[1] ?? ""}` : "메인 행사";
  const transport = (t: string) => (t === "shuttle" ? "셔틀" : t === "car" ? "자차" : "개별 이동 · 미정");

  // ---------- sheet 1: one row per team ----------
  const teamHead = ["티켓 번호", "구분", "성함", "연락처", "교구/부서", "초대해 주신 분", "연령대", "참여", "인원", "함께 오시는 분", "이동", "출발 셔틀", "복귀 셔틀", "차량 번호", "가리시는 음식", "이동 도움", "다음 초대장 수신", "체크인 인원", "체크인 시각", "체크인 장소", "좌석", "신청 경로", "신청 시각", "최근 수정"];
  const team = rows.map((r) => {
    const c = checkin.get(r.id);
    const ms = members.filter((m) => m.reservation_id === r.id && m.name?.trim());
    return [
      r.code, r.kind === "host" ? "초청자" : "초대받음", r.applicant_name, phoneFmt(r.phone), districtName(r.district_code), r.inviter_name ?? "", r.age_group ?? "",
      attendance(r), r.party_size, ms.map((m) => m.relation ? `${m.name}(${m.relation})` : m.name).join(", "),
      transport(r.transport), run(r.outbound_run_id), run(r.return_run_id), r.vehicle_plate ?? "", r.dietary_note ?? "",
      r.mobility_support ? (r.mobility_note || "예") : "", yes(r.contact_consent),
      c ? c.arrived_count : "", kst(c?.checked_in_at), c ? station(c.station_id) : "", seatLabel(seatsFor.get(r.id) ?? []),
      r.source === "import" ? "수기" : "웹", kst(r.created_at), r.updated_at && r.updated_at !== r.created_at ? kst(r.updated_at) : "",
    ];
  });

  // ---------- sheet 2: one row per person ----------
  const personHead = ["티켓 번호", "구분", "성함", "관계", "연령대", "가리시는 음식", "신청자", "신청자 연락처", "교구/부서", "참여", "이동", "출발 셔틀", "복귀 셔틀", "일행 체크인"];
  const persons = rows.flatMap((r) => {
    const c = checkin.get(r.id);
    const common = [districtName(r.district_code), attendance(r), transport(r.transport), run(r.outbound_run_id), run(r.return_run_id), c ? "확인" : ""];
    const self = [r.code, r.kind === "host" ? "초청자" : "초대받음(VIP)", r.applicant_name, "본인", r.age_group ?? "", r.dietary_note ?? "", r.applicant_name, phoneFmt(r.phone), ...common];
    const ms = members.filter((m) => m.reservation_id === r.id && m.name?.trim())
      .map((m) => [r.code, "함께 오시는 분(VIP)", m.name, m.relation ?? "", m.age_group ?? "", m.dietary_note ?? "", r.applicant_name, phoneFmt(r.phone), ...common]);
    return [self, ...ms];
  });

  const sheet = (head: string[], body: unknown[][], widths: number[]) => {
    const ws = XLSX.utils.aoa_to_sheet([head, ...body]);
    ws["!cols"] = widths.map((wch) => ({ wch }));
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: body.length, c: head.length - 1 } }) };
    return ws;
  };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(teamHead, team, [15, 9, 10, 14, 11, 12, 8, 16, 5, 30, 13, 9, 9, 11, 16, 12, 9, 8, 16, 14, 18, 7, 16, 16]), "신청 명단(팀별)");
  XLSX.utils.book_append_sheet(wb, sheet(personHead, persons, [15, 16, 10, 9, 8, 16, 10, 14, 11, 16, 13, 9, 9, 9]), "전체 인원(개인별)");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const stamp = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16).replace(/[-: ]/g, "").replace(/^(\d{8})/, "$1-");
  const name = `FALLing in Love 신청 명단 ${stamp}.xlsx`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="falling-in-love-${stamp}.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}
