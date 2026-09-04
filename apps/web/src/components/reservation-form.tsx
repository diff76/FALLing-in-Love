"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { eventConfig } from "@fil/config";
import type { ReservationInput } from "@fil/domain";

type Guest = { name: string; relation: string; ageGroup: string; dietaryNote: string };
const emptyGuest = (): Guest => ({ name: "", relation: "", ageGroup: "", dietaryNote: "" });
const ORD = ["첫 번째", "두 번째", "세 번째", "네 번째"];

export function ReservationForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"host" | "guest_self">("host");
  const [guests, setGuests] = useState<Guest[]>([emptyGuest()]);
  const [transport, setTransport] = useState<"shuttle" | "car" | "other">("shuttle");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {
      kind: mode,
      applicantName: fd.get("applicantName"),
      phone: fd.get("phone"),
      districtCode: fd.get("districtCode") ?? "",
      inviterName: fd.get("inviterName") ?? "",
      ageGroup: fd.get("ageGroup") ?? "",
      members: mode === "host" ? guests.filter((g) => g.name.trim()) : [],
      transport,
      outboundRun: fd.get("outboundRun") ?? "",
      returnRun: fd.get("returnRun") ?? "",
      vehiclePlate: fd.get("vehiclePlate") ?? "",
      mobilitySupport: fd.get("mobilitySupport") === "on",
      mobilityNote: fd.get("mobilityNote") ?? "",
      dietaryNote: fd.get("dietaryNote") ?? "",
      privacyConsent: fd.get("privacyConsent") === "on",
      contactConsent: fd.get("contactConsent") === "on",
    } satisfies Partial<Record<keyof ReservationInput, unknown>>;

    setBusy(true); setMessage(null); setFieldErrors({});
    try {
      const res = await fetch("/api/reservations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        setFieldErrors(data.fieldErrors ?? {});
        setMessage({ kind: "error", text: data.message ?? "신청을 접수하지 못했습니다." });
        return;
      }
      router.push(`/pass/${data.token}?issued=1`);
    } catch {
      setMessage({ kind: "error", text: "네트워크 상태를 확인한 뒤 다시 시도해 주세요." });
    } finally {
      setBusy(false);
    }
  }

  const err = (k: string) => fieldErrors[k] ? <span className="fieldError">{fieldErrors[k]}</span> : null;

  return (
    <form className="reservationForm" onSubmit={submit} noValidate>
      <fieldset className="modeSwitch">
        <legend>어떻게 참여하시나요?</legend>
        <button type="button" aria-pressed={mode === "host"} onClick={() => setMode("host")}>제가 초대합니다</button>
        <button type="button" aria-pressed={mode === "guest_self"} onClick={() => setMode("guest_self")}>초대를 받았습니다</button>
      </fieldset>

      <div className="formSection"><span>01</span><div><h2>{mode === "host" ? "초청하시는 분" : "당신을 알려주세요"}</h2><p>좌석과 안내를 위해 필요한 정보만 받습니다.</p></div></div>
      <div className="formGrid">
        <label><span>성함</span><input name="applicantName" autoComplete="name" required />{err("applicantName")}</label>
        <label><span>연락처</span><input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="010-0000-0000" required />{err("phone")}</label>
        {mode === "host" ? (
          <label><span>교구 / 부서</span>
            <select name="districtCode" defaultValue="">
              <option value="">선택해 주세요</option>
              {eventConfig.districts.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>{err("districtCode")}
          </label>
        ) : (
          <>
            <label><span>초대해주신 분 성함</span><input name="inviterName" />{err("inviterName")}</label>
            <label><span>그분의 교구 / 부서 <em>모르셔도 괜찮습니다</em></span>
              <select name="districtCode" defaultValue="">
                <option value="">모릅니다</option>
                {eventConfig.districts.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </label>
            <label><span>연령대 <em>선택</em></span>
              <select name="ageGroup" defaultValue=""><option value="">선택 안 함</option>{eventConfig.ageGroups.map((a) => <option key={a}>{a}</option>)}</select>
            </label>
          </>
        )}
      </div>

      {mode === "host" && (
        <>
          <div className="formSection"><span>02</span><div><h2>함께 오시는 분</h2><p>최대 네 분까지, 나란히 앉으실 수 있도록 한 팀으로 좌석을 마련합니다.</p></div></div>
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

      <div className="formSection"><span>{mode === "host" ? "03" : "02"}</span><div><h2>오시는 길과 편의</h2><p>{eventConfig.origin.name}에서 {eventConfig.venue.short}까지 셔틀로 {eventConfig.shuttle.rideMinutes}분 안팎입니다.</p></div></div>
      <div className="formGrid">
        <label><span>이동 수단</span>
          <select name="transport" value={transport} onChange={(e) => setTransport(e.target.value as typeof transport)}>
            <option value="shuttle">셔틀 · {eventConfig.origin.name} 출발</option><option value="car">자차</option><option value="other">개별 이동 · 미정</option>
          </select>
        </label>
        {transport === "shuttle" ? (
          <label><span>탑승 예정 편 {eventConfig.shuttle.provisional && <em>시각은 확정 전 임시 안내입니다</em>}</span>
            <select name="outboundRun" defaultValue={eventConfig.shuttle.outbound[3]}>
              {eventConfig.shuttle.outbound.map((t) => <option key={t} value={t}>{t} 출발</option>)}
            </select>{err("outboundRun")}
          </label>
        ) : transport === "car" ? (
          <label><span>차량 번호 <em>주차 안내용</em></span><input name="vehiclePlate" /></label>
        ) : <div />}
        <label><span>돌아가는 셔틀 <em>{eventConfig.origin.name} 방면 · 선택</em></span>
          <select name="returnRun" defaultValue=""><option value="">필요 없습니다</option>{eventConfig.shuttle.return.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        </label>
        <label><span>가리시는 음식 <em>선택</em></span><input name="dietaryNote" placeholder="알레르기, 채식 등" /></label>
        <label className="checkRow"><input type="checkbox" name="mobilitySupport" /> 계단 대신 우회 동선 안내가 필요합니다</label>
        <label className="full"><span>미리 알려주실 내용 <em>선택</em></span><textarea name="mobilityNote" placeholder="휠체어, 유모차, 그 외 도움이 필요한 일" /></label>
      </div>

      <label className="consent"><input type="checkbox" name="privacyConsent" required /><span>좌석 배정과 행사 안내를 위한 성함·연락처 수집에 동의합니다. 행사 후 {eventConfig.dataRetentionDays}일 안에 삭제됩니다.<b>필수</b></span></label>
      {err("privacyConsent")}
      <label className="consent"><input type="checkbox" name="contactConsent" /><span>행사 후 플레이리스트와 사진, 다음 소식을 받아보겠습니다.<b className="opt">선택</b></span></label>

      <button className="submitButton" type="submit" disabled={busy}>{busy ? "자리를 마련하는 중…" : "좌석 예약하기 →"}</button>
      {message && <p className={`formMessage ${message.kind === "error" ? "error" : ""}`} role="status">{message.text}</p>}
    </form>
  );
}
