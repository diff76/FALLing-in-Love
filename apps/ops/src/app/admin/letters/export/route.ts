import * as XLSX from "xlsx";
import { districtName } from "@fil/config";
import { LETTER_AUDIENCE_LABEL, LETTER_AUDIENCES, type LetterAudience } from "@fil/domain";
import { getSession } from "@/lib/auth";
import { letterUrl, loadLetterOverview, loadRecipients } from "../data";

export const dynamic = "force-dynamic";

const phoneFmt = (d: string) => (d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d);

/**
 * Admin: the sending list for the thank-you letters — one row per applicant (name, phone, the letter link they
 * receive, a ready-to-send message) plus a sheet of the letter links per district. Personal data: never cached.
 */
export async function GET() {
  const session = await getSession();
  if (!session?.roles.includes("admin")) return new Response("관리자만 내려받을 수 있습니다.", { status: 403 });
  let overview, recipients;
  try { [overview, recipients] = await Promise.all([loadLetterOverview(), loadRecipients()]); }
  catch (e) { return new Response(`명단을 읽지 못했습니다: ${(e as Error).message}`, { status: 500 }); }
  const ready = (district: string, a: LetterAudience) => !!overview.districts.find((d) => d.code === district)?.letters[a]?.body.trim();

  const head = ["성함", "연락처", "교구/부서", "받는 편지", "편지 준비", "받을 링크", "함께 오신 분(연락처 없음)", "문자 문구"];
  const body = recipients.map((r) => {
    if (!r.district) return [r.name, phoneFmt(r.phone), "교구 확인 필요", LETTER_AUDIENCE_LABEL[r.audience], "교구를 먼저 정해 주세요", "", r.companions || "", ""];
    const label = districtName(r.district), url = letterUrl(r.district, r.audience), ok = ready(r.district, r.audience);
    const text = `[창동염광교회] ${r.name} 님, FALLing in Love에 함께해 주셔서 고맙습니다. ${label} 교구장 목사님의 편지가 도착했어요.${r.audience === "leader" ? " 함께 오신 분께도 편지를 전해 주세요." : ""}\n${url}`;
    return [r.name, phoneFmt(r.phone), label, LETTER_AUDIENCE_LABEL[r.audience], ok ? "준비됨" : "작성 전", url, r.audience === "leader" ? r.companions : "", text];
  });
  const links = overview.districts.flatMap((d) => LETTER_AUDIENCES.map((a) => [d.label, LETTER_AUDIENCE_LABEL[a], d.counts[a], ready(d.code, a) ? "준비됨" : "작성 전", d.photos[a].length, letterUrl(d.code, a)]));

  const sheet = (rows: unknown[][], widths: number[]) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = widths.map((wch) => ({ wch }));
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: rows[0].length - 1 } }) };
    return ws;
  };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet([head, ...body], [10, 14, 11, 18, 10, 40, 12, 70]), "발송 명단");
  XLSX.utils.book_append_sheet(wb, sheet([["교구/부서", "받는 사람", "인원", "편지 준비", "사진", "링크"], ...links], [11, 18, 6, 10, 6, 42]), "편지 링크");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const stamp = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16).replace(/[-: ]/g, "").replace(/^(\d{8})/, "$1-");
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="falling-in-love-letters-${stamp}.xlsx"; filename*=UTF-8''${encodeURIComponent(`FALLing in Love 감사 편지 발송 명단 ${stamp}.xlsx`)}`,
      "Cache-Control": "no-store",
    },
  });
}
