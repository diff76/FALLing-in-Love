"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { eventConfig } from "@fil/config";
import type { ReservationInput } from "@fil/domain";

type Guest = { name: string; relation: string; ageGroup: string; dietaryNote: string };
/** How an edit is authorised: the Pass link, or a grant from name + phone (see /api/reservations/lookup). */
type EditAuth = { token: string } | { grant: string };
/** A saved sign-up reopened in the form (shape of lib/reservation-edit Prefill). */
type Prefill = {
  code: string; kind: "host" | "guest_self"; attendance: "main" | "worship"; worshipService: string; worshipSite: string;
  applicantName: string; phone: string; districtCode: string; inviterName: string; ageGroup: string; members: Guest[];
  transport: "shuttle" | "car" | "other"; outboundRun: string; returnRun: string; vehiclePlate: string; dietaryNote: string;
  contactConsent: boolean; checkedIn: boolean;
};
const emptyGuest = (): Guest => ({ name: "", relation: "", ageGroup: "", dietaryNote: "" });
const ORD = ["첫 번째", "두 번째", "세 번째", "네 번째", "다섯 번째"];
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
/** minutes between the first two outbound runs (the timetable is evenly spaced) */
const shuttleGap = toMin(eventConfig.shuttle.outbound[1]) - toMin(eventConfig.shuttle.outbound[0]);
type Seats = Record<string, number>;   // "outbound 12:30" → seats left

/**
 * The sign-up form, in three situations:
 *  - a new sign-up;
 *  - changing one from its Pass (/apply?edit=<pass token>) — reopened as saved, saved in place;
 *  - "이미 신청하셨나요?" / a duplicate phone: name + phone reopen the existing sign-up to check and change,
 *    and a lost Pass link can be re-issued from there.
 * Web edits stop at check-in; ops admins can still change a sign-up afterwards.
 */
export function ReservationForm() {
  const router = useRouter();
  const [edit, setEdit] = useState<{ auth: EditAuth; data: Prefill } | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [lookup, setLookup] = useState<{ name: string; phone: string; open: boolean; why: "duplicate" | "manual" } | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ grant: string; code: string } | null>(null);
  const [reissueBusy, setReissueBusy] = useState(false);

  // /apply?edit=<pass token> — reopen that sign-up
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("edit");
    if (!token) return;
    setLoading(true);
    fetch(`/api/reservations/edit?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.message); return j.data as Prefill; })
      .then((data) => (data.checkedIn ? setNotice("체크인을 마친 신청은 웹에서 수정할 수 없습니다. 현장 웰컴 데스크에 말씀해 주세요.") : setEdit({ auth: { token }, data })))
      .catch((e: Error) => setNotice(e.message || "신청을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  async function openExisting(e: React.FormEvent) {
    e.preventDefault(); if (!lookup) return;
    setLookupBusy(true); setLookupError(null);
    try {
      const r = await fetch("/api/reservations/lookup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: lookup.name, phone: lookup.phone }) });
      const j = await r.json();
      if (!r.ok) { setLookupError(j.message); return; }
      const data = j.data as Prefill;
      if (data.checkedIn) { setLookupError("체크인을 마친 신청은 웹에서 수정할 수 없습니다. 현장 웰컴 데스크에 말씀해 주세요."); return; }
      setEdit({ auth: { grant: j.grant }, data }); setLookup(null); setSaved(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { setLookupError("네트워크 상태를 확인한 뒤 다시 시도해 주세요."); }
    finally { setLookupBusy(false); }
  }
  async function reissue() {
    if (!saved) return;
    setReissueBusy(true);
    try {
      const r = await fetch("/api/reservations/reissue", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ grant: saved.grant }) });
      const j = await r.json();
      if (!r.ok) { setNotice(j.message); return; }
      router.push(`/pass/${j.token}?updated=1`);
    } finally { setReissueBusy(false); }
  }

  if (loading) return <p className="formNote">신청 내용을 불러오는 중…</p>;
  if (saved) return (
    <div className="editDone">
      <p className="eyebrow">Updated</p>
      <h2>신청 내용을 수정했습니다</h2>
      <p>티켓 번호 <b>{saved.code}</b>는 그대로입니다. 이미 받으신 Matinée Pass 링크를 그대로 쓰시면 바뀐 내용이 보입니다.</p>
      <button type="button" className="submitButton" onClick={reissue} disabled={reissueBusy}>{reissueBusy ? "새 링크를 만드는 중…" : "Pass 링크를 잃어버렸어요 · 새 링크 받기"}</button>
      <p className="formNote">새 링크를 받으면 이전 Pass 링크와, 함께 오시는 분께 보낸 초대장 링크는 더 이상 열리지 않습니다. 새 Pass에서 초대장을 다시 보내 주세요.</p>
      {notice && <p className="formMessage error" role="status">{notice}</p>}
    </div>
  );
  return (
    <>
      {notice && <p className="formMessage error" role="status">{notice}</p>}
      {edit ? (
        <div className="editBanner">
          <b>신청 내용 수정 중</b><span>티켓 번호 {edit.data.code} · 바꾸실 내용을 고친 뒤 아래 &lsquo;수정 내용 저장&rsquo;을 눌러 주세요.</span>
          {"token" in edit.auth ? <a href={`/pass/${edit.auth.token}`}>Pass로 돌아가기</a> : <button type="button" className="linkish" onClick={() => setEdit(null)}>새로 신청하기</button>}
        </div>
      ) : !lookup && (
        <p className="alreadyApplied">이미 신청하셨나요? <button type="button" className="linkish" onClick={() => { setLookup({ name: "", phone: "", open: true, why: "manual" }); setLookupError(null); }}>신청 내용 확인 · 수정하기</button></p>
      )}
      {lookup && (
        <form className="lookupPanel" onSubmit={openExisting}>
          <b>{lookup.why === "duplicate" ? "이 연락처로 이미 신청되어 있습니다" : "기존 신청 불러오기"}</b>
          <p>{lookup.why === "duplicate" ? "새로 신청하지 않으셔도 됩니다. 신청하신 분의 성함과 연락처를 확인하면 기존 신청을 불러와 내용을 확인하고 수정하실 수 있습니다." : "신청하실 때 적은 성함과 연락처를 넣어 주세요. 기존 신청을 불러와 확인하고 수정하실 수 있습니다."}</p>
          <div className="lookupRow">
            <label><span>성함</span><input value={lookup.name} onChange={(e) => setLookup({ ...lookup, name: e.target.value })} autoComplete="name" required /></label>
            <label><span>연락처</span><input value={lookup.phone} onChange={(e) => setLookup({ ...lookup, phone: e.target.value })} type="tel" inputMode="tel" placeholder="010-0000-0000" required /></label>
          </div>
          <div className="lookupActions">
            <button type="submit" className="submitButton" disabled={lookupBusy}>{lookupBusy ? "찾는 중…" : "기존 신청 불러오기"}</button>
            <button type="button" className="linkish" onClick={() => setLookup(null)}>닫기</button>
          </div>
          {lookupError && <p className="formMessage error" role="status">{lookupError}</p>}
        </form>
      )}
      <FormBody
        key={edit ? `edit-${edit.data.code}` : "new"}
        edit={edit}
        onDuplicate={(name, phone) => { setLookup({ name, phone, open: true, why: "duplicate" }); setLookupError(null); setTimeout(() => document.querySelector(".lookupPanel")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50); }}
        onSaved={(code) => { if (edit && "grant" in edit.auth) { setSaved({ grant: edit.auth.grant, code }); window.scrollTo({ top: 0, behavior: "smooth" }); } }}
      />
    </>
  );
}

function FormBody({ edit, onDuplicate, onSaved }: { edit: { auth: EditAuth; data: Prefill } | null; onDuplicate: (name: string, phone: string) => void; onSaved: (code: string) => void }) {
  const router = useRouter();
  const pre = edit?.data;
  const [mode, setMode] = useState<"host" | "guest_self">(pre?.kind ?? "host");
  const [attendance, setAttendance] = useState<"main" | "worship">(pre?.attendance ?? "main");
  const [guests, setGuests] = useState<Guest[]>(pre?.members.length ? pre.members : [emptyGuest()]);
  const [transport, setTransport] = useState<"shuttle" | "car" | "other">(pre?.transport ?? "shuttle");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Seats left per run (one 25-seat bus each). A run without room for the whole party can't be picked;
  // the server checks again at the moment of saving.
  const [seats, setSeats] = useState<Seats | null>(null);
  const [outboundRun, setOutboundRun] = useState<string>(pre?.outboundRun ?? "");   // no default: the guest picks a time
  const [returnRun, setReturnRun] = useState(pre?.returnRun ?? "");
  const party = mode === "host" ? 1 + guests.filter((g) => g.name.trim()).length : 1;
  // when editing, the party's own current seats are theirs to keep (or move)
  const ownParty = pre ? 1 + pre.members.length : 0;
  const own = (dir: "outbound" | "return", t: string) => (pre && (dir === "outbound" ? pre.outboundRun : pre.returnRun) === t ? ownParty : 0);
  const left = (dir: "outbound" | "return", t: string) => { const n = seats?.[`${dir} ${t}`]; return n === undefined ? undefined : n + own(dir, t); };
  const fits = (dir: "outbound" | "return", t: string) => { const n = left(dir, t); return n === undefined || n >= party; };
  const runLabel = (dir: "outbound" | "return", t: string) => {
    const n = left(dir, t);
    return n === undefined ? `${t} 출발` : n === 0 ? `${t} 출발 · 만차` : n < party ? `${t} 출발 · ${n}석 남음 (일행 ${party}명)` : `${t} 출발 · ${n}석 남음`;
  };
  const loadSeats = useCallback(async () => {
    try {
      const r = await fetch("/api/shuttles", { cache: "no-store" }).then((x) => x.json()) as { runs: { direction: string; label: string; available: number }[] };
      setSeats(Object.fromEntries(r.runs.map((x) => [`${x.direction} ${x.label}`, x.available])));
    } catch { /* keep the plain timetable; the server still guards */ }
  }, []);
  useEffect(() => { loadSeats(); }, [loadSeats]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {
      kind: mode,
      attendance,
      worshipService: attendance === "worship" ? fd.get("worshipService") ?? "" : "",
      worshipSite: attendance === "worship" ? fd.get("worshipSite") ?? "" : "",
      applicantName: fd.get("applicantName"),
      phone: fd.get("phone"),
      districtCode: fd.get("districtCode") ?? "",
      inviterName: fd.get("inviterName") ?? "",
      ageGroup: fd.get("ageGroup") ?? "",
      members: mode === "host" ? guests.filter((g) => g.name.trim()) : [],
      transport,
      outboundRun: transport === "shuttle" ? outboundRun : "",
      returnRun,
      vehiclePlate: fd.get("vehiclePlate") ?? "",
      // No wheelchair/stroller service this year: the "help needed" field was removed (2026-09-27).
      mobilitySupport: false,
      mobilityNote: "",
      dietaryNote: fd.get("dietaryNote") ?? "",
      privacyConsent: fd.get("privacyConsent") === "on",
      // Playlist + photos go to everyone; the next invitation is opt-OUT (ticked = do not send).
      contactConsent: fd.get("inviteOptOut") !== "on",
    } satisfies Partial<Record<keyof ReservationInput, unknown>>;

    setBusy(true); setMessage(null); setFieldErrors({});
    try {
      const res = await fetch("/api/reservations", { method: edit ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(edit ? { ...body, auth: edit.auth } : body) });
      const data = await res.json();
      if (!res.ok) {
        if (data.seatsChanged) loadSeats();   // someone took the last seats meanwhile: show the new counts
        setFieldErrors(data.fieldErrors ?? {});
        if (data.duplicatePhone && !edit) { setMessage(null); onDuplicate(String(body.applicantName ?? ""), String(body.phone ?? "")); return; }
        setMessage({ kind: "error", text: data.message ?? "신청을 접수하지 못했습니다." });
        return;
      }
      if (edit && "token" in edit.auth) { router.push(`/pass/${edit.auth.token}?updated=1`); return; }
      if (edit) { onSaved(data.code); return; }
      router.push(`/pass/${data.token}?issued=${data.partySize ?? 1}`);
    } catch {
      setMessage({ kind: "error", text: "네트워크 상태를 확인한 뒤 다시 시도해 주세요." });
    } finally {
      setBusy(false);
    }
  }

  const err = (k: string) => fieldErrors[k] ? <span className="fieldError">{fieldErrors[k]}</span> : null;
  const stepNo = (n: number) => String(n).padStart(2, "0");
  let step = 0;

  return (
    <form className="reservationForm" onSubmit={submit} noValidate>
      <fieldset className="modeSwitch">
        <legend>어떻게 참여하시나요? <span className="legendHint">혼자 참여시 &lsquo;제가 초대합니다&rsquo;를 선택</span></legend>
        <button type="button" aria-pressed={mode === "host"} onClick={() => setMode("host")}>제가 초대합니다</button>
        <button type="button" aria-pressed={mode === "guest_self"} onClick={() => setMode("guest_self")}>초대를 받았습니다</button>
      </fieldset>

      <div className="formSection"><span>{stepNo(++step)}</span><div><h2>어디까지 함께하시나요?</h2><p>메인 행사는 오후 1시부터 4시까지 {eventConfig.venue.short}에서 열립니다. 예배만 참석하시는 분도 신청해 주세요.</p></div></div>
      <fieldset className="modeSwitch attendance">
        {eventConfig.attendance.map(([code, label]) => (
          <button type="button" key={code} aria-pressed={attendance === code} onClick={() => setAttendance(code)}>{label}</button>
        ))}
      </fieldset>
      {attendance === "worship" && (
        <div className="formGrid">
          <label><span>참석하시는 예배</span>
            <select name="worshipService" defaultValue={pre?.worshipService ?? ""}>
              <option value="">선택해 주세요</option>
              {eventConfig.worshipServices.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>{err("worshipService")}
          </label>
          <label><span>참석 장소</span>
            <select name="worshipSite" defaultValue={pre?.worshipSite ?? ""}>
              <option value="">선택해 주세요</option>
              {eventConfig.worshipSites.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>{err("worshipSite")}
          </label>
        </div>
      )}

      <div className="formSection"><span>{stepNo(++step)}</span><div><h2>{mode === "host" ? "초청하시는 분(혹은 혼자 오신 분)" : "당신을 알려주세요"}</h2><p>안내와 당일 좌석 배정을 위해 필요한 정보만 받습니다.</p></div></div>
      <div className="formGrid">
        <label><span>성함</span><input name="applicantName" autoComplete="name" required defaultValue={pre?.applicantName} />{err("applicantName")}</label>
        <label><span>연락처</span><input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="010-0000-0000" required defaultValue={pre?.phone} />{err("phone")}</label>
        {mode === "host" ? (
          <label><span>교구 / 부서</span>
            <select name="districtCode" defaultValue={pre?.districtCode ?? ""}>
              <option value="">선택해 주세요</option>
              {eventConfig.districts.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>{err("districtCode")}
          </label>
        ) : (
          <>
            <label><span>초대해주신 분 성함</span><input name="inviterName" defaultValue={pre?.inviterName} />{err("inviterName")}</label>
            <label><span>그분의 교구 / 부서 <em>모르셔도 괜찮습니다</em></span>
              <select name="districtCode" defaultValue={pre?.districtCode ?? ""}>
                <option value="">모릅니다</option>
                {eventConfig.districts.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </label>
            <label><span>연령대 <em>선택</em></span>
              <select name="ageGroup" defaultValue={pre?.ageGroup ?? ""}><option value="">선택 안 함</option>{eventConfig.ageGroups.map((a) => <option key={a}>{a}</option>)}</select>
            </label>
          </>
        )}
      </div>

      {mode === "host" && (
        <>
          <div className="formSection"><span>{stepNo(++step)}</span><div><h2>함께 오시는 분(VIP)</h2><p>최대 다섯 분까지. 당일 체크인 때 한 팀으로 나란히 앉으실 수 있도록 좌석을 배정합니다.</p></div></div>
          <div className="formGrid">
            {guests.map((g, i) => (
              <div className="guestCard" key={i}>
                <header><span>GUEST {String(i + 1).padStart(2, "0")} · {ORD[i]} 분</span>{i > 0 && <button type="button" onClick={() => setGuests(guests.filter((_, k) => k !== i))}>지우기</button>}</header>
                <label><span>성함</span><input value={g.name} onChange={(e) => setGuests(guests.map((x, k) => k === i ? { ...x, name: e.target.value } : x))} /></label>
                <label><span>관계 <em>선택</em></span><input value={g.relation} placeholder="직장 동료, 이웃…" onChange={(e) => setGuests(guests.map((x, k) => k === i ? { ...x, relation: e.target.value } : x))} /></label>
                <label><span>연령대 <em>선택</em></span>
                  <select value={g.ageGroup} onChange={(e) => setGuests(guests.map((x, k) => k === i ? { ...x, ageGroup: e.target.value } : x))}><option value="">선택 안 함</option>{eventConfig.ageGroups.map((a) => <option key={a}>{a}</option>)}</select>
                </label>
                <label><span>가리시는 음식 <em>선택</em></span><input value={g.dietaryNote} onChange={(e) => setGuests(guests.map((x, k) => k === i ? { ...x, dietaryNote: e.target.value } : x))} /></label>
              </div>
            ))}
            {guests.length < eventConfig.maxPartySize - 1 && <button type="button" className="linkButton" onClick={() => setGuests([...guests, emptyGuest()])}>+ 한 분 더 추가</button>}
          </div>
        </>
      )}

      <div className="formSection"><span>{stepNo(++step)}</span><div><h2>오시는 길과 편의</h2><p>{eventConfig.origin.name}에서 {eventConfig.venue.short}까지 셔틀로 {eventConfig.shuttle.rideMinutes}분 안팎입니다. 셔틀은 {eventConfig.shuttle.outbound[0]}부터 {shuttleGap}분 간격, 막차 {eventConfig.shuttle.outbound[eventConfig.shuttle.outbound.length - 1]}입니다.</p></div></div>
      <div className="formGrid">
        <label><span>이동 수단</span>
          <select name="transport" value={transport} onChange={(e) => setTransport(e.target.value as typeof transport)}>
            <option value="shuttle">셔틀 · {eventConfig.origin.name} 출발</option><option value="car">자차</option><option value="other">개별 이동 · 미정</option>
          </select>
        </label>
        {transport === "shuttle" ? (
          <label><span>탑승 예정 편</span>
            <select name="outboundRun" value={outboundRun} onChange={(e) => setOutboundRun(e.target.value)}>
              <option value="" disabled>희망하는 시간을 선택해 주세요</option>
              {eventConfig.shuttle.outbound.map((t) => <option key={t} value={t} disabled={!fits("outbound", t)}>{runLabel("outbound", t)}</option>)}
            </select>{err("outboundRun")}
            {outboundRun && !fits("outbound", outboundRun) && <span className="fieldError">이 편은 일행 {party}명이 함께 타실 자리가 없습니다. 다른 시간을 골라 주세요.</span>}
          </label>
        ) : transport === "car" ? (
          <label><span>차량 번호 <em>주차 안내용</em></span><input name="vehiclePlate" placeholder="12가 3456" defaultValue={pre?.vehiclePlate} />{err("vehiclePlate")}</label>
        ) : <div />}
        <label><span>돌아가는 셔틀 <em>{eventConfig.origin.name} 방면 · 선택</em></span>
          <select name="returnRun" value={returnRun} onChange={(e) => setReturnRun(e.target.value)}><option value="">필요 없습니다</option>{eventConfig.shuttle.return.map((t) => <option key={t} value={t} disabled={!fits("return", t)}>{runLabel("return", t)}</option>)}</select>{err("returnRun")}
          {returnRun && !fits("return", returnRun) && <span className="fieldError">이 편은 일행 {party}명이 함께 타실 자리가 없습니다. 다른 시간을 골라 주세요.</span>}
        </label>
        <label><span>가리시는 음식 <em>선택</em></span><input name="dietaryNote" placeholder="알레르기, 채식 등" defaultValue={pre?.dietaryNote} /></label>
      </div>

      <label className="consent"><input type="checkbox" name="privacyConsent" required defaultChecked={!!pre} /><span>좌석 배정과 행사 안내를 위한 성함·연락처 수집에 동의합니다. 행사 후 {eventConfig.dataRetentionDays}일 안에 삭제됩니다.<b>필수</b></span></label>
      {err("privacyConsent")}
      <p className="consentNote">행사 후 그날의 플레이리스트와 사진은 신청하신 모든 분께 보내드립니다. 다음에 좋은 자리가 생기면 초대장도 함께 전해드리려 합니다.</p>
      <label className="consent"><input type="checkbox" name="inviteOptOut" defaultChecked={pre ? !pre.contactConsent : false} /><span>다음 초대장은 받지 않겠습니다.<b className="opt">선택</b></span></label>

      <p className="formNote">좌석은 당일 현장 체크인 때 배정됩니다. 신청만으로는 좌석이 확정되지 않습니다.</p>
      <button className="submitButton" type="submit" disabled={busy}>{busy ? (edit ? "저장하는 중…" : "접수하는 중…") : edit ? "수정 내용 저장 →" : "참여 신청하기 →"}</button>
      {message && <p className={`formMessage ${message.kind === "error" ? "error" : ""}`} role="status">{message.text}</p>}
    </form>
  );
}
