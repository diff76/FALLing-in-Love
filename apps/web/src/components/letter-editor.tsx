"use client";

import { useState } from "react";
import type { LetterAudience } from "@fil/domain";

type Draft = { one: string; two: string; signer: string };
type Props = { token: string; districtLabel: string; initial: Draft; savedAt: string | null; counts: Record<LetterAudience, number>; links: Record<LetterAudience, string> };

const fmt = (iso: string) => new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * The pastor writes letter ① (VIP · 인도자 · 미래셀) and letter ② (일반 성도) side by side, signs once, saves,
 * and opens each audience's letter to see it as it will arrive.
 */
export function LetterEditor({ token, districtLabel, initial, savedAt, counts, links }: Props) {
  const [d, setD] = useState<Draft>(initial);
  const [saved, setSaved] = useState<Draft>(initial);
  const [at, setAt] = useState(savedAt);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = d.one !== saved.one || d.two !== saved.two || d.signer !== saved.signer;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/letter/save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, ...d }) });
      const j = await r.json();
      if (!r.ok) { setMsg({ ok: false, text: j.message }); return; }
      setSaved(d); setAt(j.savedAt); setMsg({ ok: true, text: "저장했습니다. 아래 ‘미리 보기’로 받는 분 화면을 확인해 보세요." });
    } catch { setMsg({ ok: false, text: "네트워크 상태를 확인한 뒤 다시 저장해 주세요." }); }
    finally { setBusy(false); }
  }

  const preview = (a: LetterAudience, label: string, empty: boolean) => (
    empty ? <span className="lwPreview off" title="글을 저장하면 열 수 있습니다">{label}</span>
      : <a className="lwPreview" href={links[a]} target="_blank" rel="noreferrer">{label} 미리 보기 ↗</a>
  );

  return (
    <form className="lwForm" onSubmit={save}>
      <label className="lwField"><span>서명 <em>편지 끝에 “{districtLabel} 교구장 ○○○ 목사”로 들어갑니다</em></span>
        <input value={d.signer} onChange={(e) => setD({ ...d, signer: e.target.value })} placeholder="성함" maxLength={40} autoComplete="name" />
      </label>

      <div className="lwLetter">
        <div className="lwLetterHead"><b>편지 ①</b><span>VIP {counts.vip}명 · 인도자 {counts.leader}명 · 미래셀 {counts.mirae}명이 받습니다</span></div>
        <textarea value={d.one} onChange={(e) => setD({ ...d, one: e.target.value })} rows={9} maxLength={2000}
          placeholder={"예) 가을 정원의 오후, 함께해 주셔서 고맙습니다.\n\n처음 오신 분도, 소중한 분을 모시고 오신 분도 …"} aria-label="편지 ① 본문" />
        <small>{d.one.length} / 2000자 · 받는 분에 맞는 첫 인사(“귀한 분께”, “성도님께”, “미래셀 가족께”)는 자동으로 붙습니다.</small>
      </div>

      <div className="lwLetter two">
        <div className="lwLetterHead"><b>편지 ②</b><span>혼자 신청한 일반 성도 {counts.member}명이 받습니다</span></div>
        <textarea value={d.two} onChange={(e) => setD({ ...d, two: e.target.value })} rows={7} maxLength={2000}
          placeholder={"예) 바쁜 주일 오후, 자리를 지켜 주셔서 고맙습니다. …"} aria-label="편지 ② 본문" />
        <small>{d.two.length} / 2000자 · 비워 두면 일반 성도 링크는 열리지 않습니다.</small>
      </div>

      <div className="lwActions">
        <button type="submit" className="submitButton" disabled={busy || !dirty}>{busy ? "저장 중…" : dirty ? "편지 저장" : "저장됨"}</button>
        {at && <span className="lwAt">마지막 저장 {fmt(at)}</span>}
      </div>
      {msg && <p className={`formMessage ${msg.ok ? "" : "error"}`} role="status">{msg.text}</p>}

      <div className="lwPreviews">
        <b>받는 분 화면</b>
        <div>
          {preview("vip", "VIP", !saved.one.trim())}
          {preview("leader", "인도자", !saved.one.trim())}
          {preview("mirae", "미래셀", !saved.one.trim())}
          {preview("member", "일반 성도", !saved.two.trim())}
        </div>
        <small>미리 보기는 저장한 글로 열립니다. 봉투를 누르면 음악이 함께 나옵니다.</small>
      </div>
    </form>
  );
}
