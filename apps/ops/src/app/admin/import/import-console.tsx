"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { eventConfig } from "@fil/config";
import { normalizePhone, type ReservationInput } from "@fil/domain";
import { checkDuplicates, importRows, type DuplicateHit, type ImportRowResult } from "./actions";

/** Excel columns (Korean headers) → reservation input. Kept in ONE place so the template and the parser agree. */
const COLUMNS = [
  ["성함", "applicantName", "필수"], ["연락처", "phone", "필수 · 010-0000-0000"],
  ["구분", "kind", "초청 / 초대받음 (기본 초청)"], ["참여", "attendance", "메인 / 예배 (기본 메인)"],
  ["예배", "worshipService", "예배만: 1 / 2 / 3"], ["장소", "worshipSite", "예배만: 창동 / 한신"],
  ["교구부서", "districtCode", eventConfig.districts.map(([, l]) => l).join(", ")],
  ["초대자", "inviterName", "초대받음일 때"], ["연령대", "ageGroup", eventConfig.ageGroups.join(" / ")],
  ["동행1", "member1", "성함"], ["동행2", "member2", "성함"], ["동행3", "member3", "성함"], ["동행4", "member4", "성함"],
  ["이동", "transport", "셔틀 / 자차 / 개별 (기본 셔틀)"], ["셔틀편", "outboundRun", eventConfig.shuttle.outbound.join(" / ")],
  ["복귀셔틀", "returnRun", eventConfig.shuttle.return.join(" / ")], ["차량번호", "vehiclePlate", "자차일 때"],
  ["우회동선", "mobilitySupport", "예 / 아니오"], ["도움요청", "mobilityNote", ""], ["식이", "dietaryNote", ""],
  ["사후연락동의", "contactConsent", "예 / 아니오"],
] as const;

type Draft = ReservationInput & { rowNo: number; problems: string[]; duplicate?: DuplicateHit; allowSameName?: boolean };

const yes = (v: unknown) => /^(예|y|yes|o|true|1)$/i.test(String(v ?? "").trim());
const pick = <T extends readonly (readonly [string, string])[]>(table: T, v: unknown): string | undefined => {
  const s = String(v ?? "").trim(); if (!s) return undefined;
  const hit = table.find(([code, label]) => code === s || label === s || label.startsWith(s));
  return hit?.[0];
};

function toDraft(rec: Record<string, unknown>, rowNo: number): Draft {
  const problems: string[] = [];
  const g = (k: string) => String(rec[k] ?? "").trim();
  const kindRaw = g("구분");
  const kind: ReservationInput["kind"] = /초대받|guest/i.test(kindRaw) ? "guest_self" : "host";
  const attendance: ReservationInput["attendance"] = /예배|worship/i.test(g("참여")) ? "worship" : "main";
  const transportRaw = g("이동");
  const transport: ReservationInput["transport"] = /자차|car/i.test(transportRaw) ? "car" : /개별|other/i.test(transportRaw) ? "other" : "shuttle";
  const members = ["동행1", "동행2", "동행3", "동행4"].map(g).filter(Boolean).map((name) => ({ name, relation: undefined, ageGroup: undefined, dietaryNote: undefined }));
  const district = pick(eventConfig.districts, g("교구부서"));
  if (!g("성함")) problems.push("성함 없음");
  const phone = normalizePhone(g("연락처"));
  if (!(phone.length === 10 || phone.length === 11)) problems.push("연락처 형식");
  if (kind === "host" && !district) problems.push("교구/부서 확인");
  const service = (["1", "2", "3"] as const).find((s) => g("예배").startsWith(s));
  const site = /창동/.test(g("장소")) ? "changdong" : /한신/.test(g("장소")) ? "hanshin" : undefined;
  if (attendance === "worship" && (!service || !site)) problems.push("예배/장소 확인");
  let outboundRun = g("셔틀편") || (transport === "shuttle" ? eventConfig.shuttle.outbound[3] : "");
  if (outboundRun && !(eventConfig.shuttle.outbound as readonly string[]).includes(outboundRun)) { problems.push(`셔틀편 ${outboundRun} 없음`); outboundRun = ""; }
  let returnRun = g("복귀셔틀");
  if (returnRun && !(eventConfig.shuttle.return as readonly string[]).includes(returnRun)) { problems.push(`복귀셔틀 ${returnRun} 없음`); returnRun = ""; }
  return {
    rowNo, problems, kind, attendance, worshipService: service, worshipSite: site,
    applicantName: g("성함"), phone, districtCode: district, inviterName: g("초대자") || undefined,
    ageGroup: (eventConfig.ageGroups as readonly string[]).includes(g("연령대")) ? (g("연령대") as ReservationInput["ageGroup"]) : undefined,
    members, transport, outboundRun: outboundRun || undefined, returnRun: returnRun || undefined,
    vehiclePlate: g("차량번호") || undefined, mobilitySupport: yes(g("우회동선")), mobilityNote: g("도움요청") || undefined,
    dietaryNote: g("식이") || undefined, privacyConsent: true, contactConsent: yes(g("사후연락동의")),
  };
}

export function downloadTemplate() {
  const header = COLUMNS.map(([h]) => h);
  const hint = COLUMNS.map(([, , h]) => h);
  const sample = ["예시 홍길동", "010-1234-5678", "초청", "메인", "", "", "11교구", "", "40대", "예시 동행", "", "", "", "셔틀", "12:30", "16:15", "", "아니오", "", "", "예"];
  const sample2 = ["예시 김영희", "010-2222-3333", "초청", "예배", "2", "창동", "21교구", "", "", "", "", "", "", "개별", "", "", "", "예", "휠체어", "", "아니오"];
  const ws = XLSX.utils.aoa_to_sheet([header, hint, sample, sample2]);
  ws["!cols"] = header.map(() => ({ wch: 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "참여신청");
  XLSX.writeFile(wb, "FALLing-in-Love_참여신청_양식.xlsx");
}

export function ImportConsole() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [fileName, setFileName] = useState("");
  const [results, setResults] = useState<ImportRowResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setBusy(true); setError(null); setResults(null); setFileName(file.name);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      // row 2 of the template is the hint line: skip rows whose phone is not numeric-ish
      const parsed = rows.map((r, i) => toDraft(r, i + 2)).filter((d) => d.applicantName && !/필수/.test(d.applicantName) && !/^예시 /.test(d.applicantName));
      // duplicates inside the file: same phone, or same name
      const seenPhone = new Map<string, number>(), seenName = new Map<string, number>();
      parsed.forEach((d) => {
        if (seenPhone.has(d.phone)) d.problems.push(`파일 안 중복 연락처 (${seenPhone.get(d.phone)}행)`); else seenPhone.set(d.phone, d.rowNo);
        if (seenName.has(d.applicantName)) d.problems.push(`파일 안 같은 성함 (${seenName.get(d.applicantName)}행)`); else seenName.set(d.applicantName, d.rowNo);
      });
      // duplicates against the database (phone blocks; same name needs an explicit tick)
      const dups = await checkDuplicates(parsed.map((d) => ({ name: d.applicantName, phone: d.phone })));
      parsed.forEach((d) => { d.duplicate = dups.find((h) => h.name === d.applicantName && h.phone === d.phone); });
      setDrafts(parsed);
      if (!parsed.length) setError("읽을 수 있는 행이 없습니다. 양식의 1행(제목)을 그대로 두고 3행부터 입력해 주세요.");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function run() {
    const ready = drafts.filter(canRegister);
    if (!ready.length) return setError("등록할 수 있는 행이 없습니다.");
    setBusy(true); setError(null);
    try { setResults(await importRows(ready.map((d) => { const rest = { ...d } as Partial<Draft>; delete rest.problems; delete rest.duplicate; return rest as Draft; }))); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const canRegister = (d: Draft) => !d.problems.length && (!d.duplicate || (d.duplicate.by === "name" && !!d.allowSameName));
  const ok = drafts.filter(canRegister).length;
  const dup = drafts.filter((d) => d.duplicate && !canRegister(d)).length;
  const bad = drafts.filter((d) => d.problems.length).length;

  return (
    <div className="importConsole">
      <div className="importSteps">
        <section className="box"><h2>1. 양식 내려받기</h2><p className="tiny">1행 제목, 2행 안내, 3행부터 한 사람(팀)당 한 줄입니다. 메인 행사 참여자와 예배만 참석하는 분 모두 같은 양식에 적습니다.</p><button className="btn small" onClick={downloadTemplate}>엑셀 양식 다운로드</button></section>
        <section className="box"><h2>2. 작성한 파일 올리기</h2><p className="tiny">올리면 바로 검사만 합니다. 아직 저장되지 않습니다.</p>
          <label className="fileDrop"><input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} /><span>{fileName || "파일 선택 (.xlsx)"}</span></label></section>
      </div>
      {error && <p className="tiny warn">{error}</p>}
      {drafts.length > 0 && !results && (
        <section className="box">
          <h2>3. 검사 결과 <small>등록 가능 {ok} · 중복 {dup} · 오류 {bad}</small></h2>
          <div className="scroll"><table>
            <thead><tr><th>행</th><th>성함</th><th>연락처</th><th>참여</th><th>교구/부서</th><th>인원</th><th>이동</th><th>상태</th></tr></thead>
            <tbody>{drafts.map((d) => (
              <tr key={d.rowNo} className={d.duplicate ? "dup" : d.problems.length ? "bad" : ""}>
                <td className="mono">{d.rowNo}</td><td>{d.applicantName}</td><td className="mono">{d.phone}</td>
                <td>{d.attendance === "worship" ? `예배 ${d.worshipService ?? "?"}부 · ${d.worshipSite === "changdong" ? "창동" : d.worshipSite === "hanshin" ? "한신" : "?"}` : "메인"}</td>
                <td>{eventConfig.districts.find(([c]) => c === d.districtCode)?.[1] ?? (d.kind === "guest_self" ? `초대: ${d.inviterName ?? ""}` : "—")}</td>
                <td className="mono">{1 + d.members.length}</td>
                <td>{d.transport === "shuttle" ? `셔틀 ${d.outboundRun ?? ""}` : d.transport === "car" ? `자차 ${d.vehiclePlate ?? ""}` : "개별"}</td>
                <td>{d.problems.length ? <span className="tag bad">{d.problems.join(", ")}</span>
                  : d.duplicate?.by === "phone" ? <span className="tag bad">중복 · 같은 연락처 {d.duplicate.code}</span>
                  : d.duplicate?.by === "name" ? <label className="tag same"><input type="checkbox" checked={!!d.allowSameName} onChange={(e) => setDrafts(drafts.map((x) => x.rowNo === d.rowNo ? { ...x, allowSameName: e.target.checked } : x))} /> 같은 성함 {d.duplicate.code} · 동명이인이면 체크</label>
                  : <span className="tag in">등록 가능</span>}</td>
              </tr>
            ))}</tbody>
          </table></div>
          <button className="btn gold" onClick={run} disabled={busy || !ok}>{busy ? "등록 중…" : `${ok}건 등록하기`}</button>
          <p className="tiny">같은 연락처는 등록되지 않습니다. 같은 성함만 겹치면 동명이인일 때에 한해 체크해 등록하세요. 오류 행은 건너뜁니다.</p>
        </section>
      )}
      {results && (
        <section className="box">
          <h2>4. 등록 결과 <small>성공 {results.filter((r) => r.ok).length} · 실패 {results.filter((r) => !r.ok).length}</small></h2>
          <ul className="list">{results.map((r) => <li key={r.row} className={r.ok ? "" : "skipped"}><b>{r.row}행 {r.name}</b><span>{r.ok ? `등록됨 · ${r.code}` : r.message}</span></li>)}</ul>
          <button className="btn ghost" onClick={() => { setResults(null); setDrafts([]); setFileName(""); }}>다른 파일 올리기</button>
        </section>
      )}
    </div>
  );
}
