"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { eventConfig } from "@fil/config";
import { adminUpdateReservation, type AdminEditData } from "../actions";

type Member = AdminEditData["members"][number];
const emptyMember = (): Member => ({ name: "", relation: "", ageGroup: "", dietaryNote: "" });

/**
 * Admin editor for one sign-up — the same fields as the web form, saved through update_reservation
 * (admin: allowed after check-in, not blocked by bus seats). Ticket number and Pass link stay the same.
 */
export function AdminReservationEditor({ initial }: { initial: AdminEditData }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [members, setMembers] = useState<Member[]>(initial.members);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const set = <K extends keyof AdminEditData>(k: K, v: AdminEditData[K]) => setF({ ...f, [k]: v });
  const err = (k: string) => (errs[k] ? <small className="warn">{errs[k]}</small> : null);
  const party = f.kind === "host" ? 1 + members.filter((m) => m.name.trim()).length : 1;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null); setErrs({});
    const res = await adminUpdateReservation(f.id, {
      kind: f.kind, attendance: f.attendance,
      worshipService: f.attendance === "worship" ? f.worshipService : "", worshipSite: f.attendance === "worship" ? f.worshipSite : "",
      applicantName: f.applicantName, phone: f.phone, districtCode: f.districtCode,
      inviterName: f.kind === "guest_self" ? f.inviterName : "", ageGroup: f.ageGroup,
      members: f.kind === "host" ? members.filter((m) => m.name.trim()) : [],
      transport: f.transport, outboundRun: f.transport === "shuttle" ? f.outboundRun : "", returnRun: f.returnRun,
      vehiclePlate: f.transport === "car" ? f.vehiclePlate : "", mobilitySupport: false, mobilityNote: "",
      dietaryNote: f.dietaryNote, contactConsent: f.contactConsent,
    });
    setBusy(false);
    if (res.error) { setErrs(res.fieldErrors ?? {}); setMsg({ ok: false, text: res.error }); return; }
    setMsg({ ok: true, text: "저장했습니다. Pass와 대시보드에 바로 반영됩니다." });
    router.refresh();
  }

  return (
    <form className="box resEdit" onSubmit={save}>
      {initial.checkedIn && <p className="stationNote">이미 체크인한 일행입니다. 인원을 바꿔도 이미 배정된 좌석은 그대로이니, 필요하면 스캔 화면에서 좌석을 다시 배정해 주세요.</p>}
      <p className="tiny">티켓 번호 <b className="mono">{initial.code}</b>{initial.source === "import" ? " · 수기 등록" : " · 웹 신청"} · 저장해도 티켓 번호와 Pass 링크는 바뀌지 않습니다. 관리자 수정은 셔틀 좌석 제한을 받지 않습니다(초과 시 좌석 표에 빨간색으로 표시).</p>

      <div className="resGrid">
        <label>구분<select value={f.kind} onChange={(e) => set("kind", e.target.value as AdminEditData["kind"])}><option value="host">초청자 (제가 초대합니다)</option><option value="guest_self">초대받음</option></select></label>
        <label>참여<select value={f.attendance} onChange={(e) => set("attendance", e.target.value as AdminEditData["attendance"])}>{eventConfig.attendance.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</select></label>
        {f.attendance === "worship" && <>
          <label>예배<select value={f.worshipService} onChange={(e) => set("worshipService", e.target.value)}><option value="">선택</option>{eventConfig.worshipServices.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</select>{err("worshipService")}</label>
          <label>장소<select value={f.worshipSite} onChange={(e) => set("worshipSite", e.target.value)}><option value="">선택</option>{eventConfig.worshipSites.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</select>{err("worshipSite")}</label>
        </>}
        <label>성함<input value={f.applicantName} onChange={(e) => set("applicantName", e.target.value)} required />{err("applicantName")}</label>
        <label>연락처<input value={f.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" required />{err("phone")}</label>
        <label>교구 / 부서<select value={f.districtCode} onChange={(e) => set("districtCode", e.target.value)}><option value="">{f.kind === "host" ? "선택" : "모름"}</option>{eventConfig.districts.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</select>{err("districtCode")}</label>
        {f.kind === "guest_self" && <label>초대해 주신 분<input value={f.inviterName} onChange={(e) => set("inviterName", e.target.value)} />{err("inviterName")}</label>}
        <label>연령대<select value={f.ageGroup} onChange={(e) => set("ageGroup", e.target.value)}><option value="">선택 안 함</option>{eventConfig.ageGroups.map((a) => <option key={a}>{a}</option>)}</select></label>
      </div>

      {f.kind === "host" && (
        <>
          <h3>함께 오시는 분 (VIP) <small>일행 {party}명</small></h3>
          <div className="resMembers">
            {members.map((m, i) => (
              <div className="resMember" key={i}>
                <input placeholder="성함" value={m.name} onChange={(e) => setMembers(members.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
                <input placeholder="관계 (선택)" value={m.relation} onChange={(e) => setMembers(members.map((x, k) => (k === i ? { ...x, relation: e.target.value } : x)))} />
                <select value={m.ageGroup} onChange={(e) => setMembers(members.map((x, k) => (k === i ? { ...x, ageGroup: e.target.value } : x)))}><option value="">연령대</option>{eventConfig.ageGroups.map((a) => <option key={a}>{a}</option>)}</select>
                <input placeholder="가리는 음식 (선택)" value={m.dietaryNote} onChange={(e) => setMembers(members.map((x, k) => (k === i ? { ...x, dietaryNote: e.target.value } : x)))} />
                <button type="button" className="miniBtn" onClick={() => setMembers(members.filter((_, k) => k !== i))}>빼기</button>
              </div>
            ))}
            {members.length < eventConfig.maxPartySize - 1 && <button type="button" className="miniBtn" onClick={() => setMembers([...members, emptyMember()])}>+ 동행 추가</button>}
          </div>
        </>
      )}

      <h3>이동 · 편의</h3>
      <div className="resGrid">
        <label>이동 수단<select value={f.transport} onChange={(e) => set("transport", e.target.value as AdminEditData["transport"])}><option value="shuttle">셔틀</option><option value="car">자차</option><option value="other">개별 이동 · 미정</option></select></label>
        {f.transport === "shuttle" && <label>출발 셔틀<select value={f.outboundRun} onChange={(e) => set("outboundRun", e.target.value)}><option value="">선택</option>{eventConfig.shuttle.outbound.map((t) => <option key={t} value={t}>{t}</option>)}</select>{err("outboundRun")}</label>}
        {f.transport === "car" && <label>차량 번호<input value={f.vehiclePlate} onChange={(e) => set("vehiclePlate", e.target.value)} /></label>}
        <label>복귀 셔틀<select value={f.returnRun} onChange={(e) => set("returnRun", e.target.value)}><option value="">필요 없음</option>{eventConfig.shuttle.return.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
        <label>가리시는 음식 (본인)<input value={f.dietaryNote} onChange={(e) => set("dietaryNote", e.target.value)} /></label>
        <label className="chk"><input type="checkbox" checked={f.contactConsent} onChange={(e) => set("contactConsent", e.target.checked)} /> 다음 초대장 받기</label>
      </div>

      <div className="resActions">
        <button className="btn gold small" type="submit" disabled={busy}>{busy ? "저장 중…" : "수정 내용 저장"}</button>
        <button className="btn ghost small" type="button" onClick={() => router.push("/admin")}>목록으로</button>
      </div>
      {msg && <p className={`tiny ${msg.ok ? "" : "warn"}`} role="status">{msg.text}</p>}
    </form>
  );
}
