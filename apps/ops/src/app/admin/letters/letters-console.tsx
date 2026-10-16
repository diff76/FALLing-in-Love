"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { letterCode, LETTER_AUDIENCES, type LetterAudience } from "@fil/domain";
import { createEditorLink, revokeEditorLink, saveLettersAsAdmin } from "./actions";
import type { DistrictLetters } from "./data";

const AUD_LABEL: Record<LetterAudience, string> = { vip: "VIP", leader: "인도자", mirae: "미래셀", member: "일반 성도" };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "");

/** One card per district: letter ① / ② status, the four letter links, the pastor's writing links, and direct editing. */
export function LettersConsole({ districts, webOrigin }: { districts: DistrictLetters[]; webOrigin: string }) {
  const done = districts.filter((d) => d.one?.body.trim()).length;
  return (
    <section className="box">
      <h2>교구별 편지 <small>편지 ① 작성 {done} / {districts.length}교구</small></h2>
      <div className="ltCards">{districts.map((d) => <DistrictCard key={d.code} d={d} webOrigin={webOrigin} />)}</div>
    </section>
  );
}

function DistrictCard({ d, webOrigin }: { d: DistrictLetters; webOrigin: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [minted, setMinted] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ one: d.one?.body ?? "", two: d.two?.body ?? "", signer: d.one?.signer || d.two?.signer || "" });
  const total = d.counts.vip + d.counts.leader + d.counts.mirae + d.counts.member;
  const live = d.editors.filter((e) => !e.revokedAt);
  const has = (k: "one" | "two") => !!(k === "one" ? d.one : d.two)?.body.trim();

  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(key); setErr(null);
    const r = await fn();
    if (!r.ok) setErr(r.error ?? "처리하지 못했습니다."); else router.refresh();
    setBusy(null);
    return r.ok;
  };
  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1800); } catch { window.prompt("복사하세요", text); }
  };

  return (
    <article className={`ltCard ${total ? "" : "empty"}`}>
      <header>
        <b>{d.label}</b>
        <span className="tiny">받는 분 {total}명 · VIP {d.counts.vip} · 인도자 {d.counts.leader} · 미래셀 {d.counts.mirae} · 일반 성도 {d.counts.member}</span>
      </header>
      <div className="ltStatus">
        <span className={`tag ${has("one") ? "in" : ""}`}>① {has("one") ? "작성됨" : "작성 전"}</span>
        <span className={`tag ${has("two") ? "in" : ""}`}>② {has("two") ? "작성됨" : "작성 전"}</span>
        {(d.one?.signer || d.two?.signer) && <span className="tiny">서명 {d.one?.signer || d.two?.signer} 목사</span>}
        {(d.one || d.two) && <span className="tiny">· {fmt((d.one ?? d.two)!.updatedAt)} {((d.one ?? d.two)!.via === "admin") ? "관리자 저장" : "목사님 저장"}</span>}
      </div>

      <div className="ltLinks">
        {LETTER_AUDIENCES.map((a) => {
          const ready = a === "member" ? has("two") : has("one");
          const url = `${webOrigin}/letter/${letterCode(d.code, a)}`;
          return (
            <span key={a} className={`ltLink ${ready ? "" : "off"}`}>
              <a href={url} target="_blank" rel="noreferrer">{AUD_LABEL[a]}</a>
              <button type="button" className="miniBtn" onClick={() => copy(a, url)}>{copied === a ? "복사됨" : "링크 복사"}</button>
            </span>
          );
        })}
      </div>

      <div className="ltEditors">
        {live.length > 0 && <span className="tiny">작성 링크 {live.length}개 · {live.map((e) => `${e.label || "메모 없음"}${e.lastUsedAt ? ` (최근 ${fmt(e.lastUsedAt)})` : " (아직 안 열림)"}`).join(", ")}</span>}
        <span className="rowAct">
          <button type="button" className="miniBtn" disabled={busy !== null} onClick={async () => {
            setBusy("mint"); setErr(null);
            const r = await createEditorLink(d.code, `${d.label} 교구장`);
            if (r.ok) { setMinted(r.data.url); router.refresh(); } else setErr(r.error);
            setBusy(null);
          }}>{busy === "mint" ? "만드는 중…" : "작성 링크 만들기"}</button>
          {live.map((e) => <button key={e.id} type="button" className="miniBtn" disabled={busy !== null} onClick={() => run(`rv${e.id}`, () => revokeEditorLink(e.id))}>{busy === `rv${e.id}` ? "…" : `링크 끊기${live.length > 1 ? ` (${fmt(e.createdAt)})` : ""}`}</button>)}
          <button type="button" className="miniBtn" onClick={() => setEditing(!editing)}>{editing ? "직접 쓰기 닫기" : "직접 쓰기"}</button>
        </span>
      </div>

      {minted && (
        <div className="minted">
          <span className="tiny">교구장 목사님께 이 링크를 보내 주세요. 지금 한 번만 보입니다.</span>
          <code>{minted}</code>
          <span className="rowAct">
            <button type="button" className="miniBtn" onClick={() => copy("minted", `${d.label} 감사 편지 작성 링크입니다. 편지 ①(VIP · 인도자 · 미래셀)과 ②(일반 성도)를 써 주세요.\n${minted}`)}>{copied === "minted" ? "복사됨" : "안내 문구와 복사"}</button>
            <button type="button" className="miniBtn" onClick={() => setMinted(null)}>닫기</button>
          </span>
        </div>
      )}

      {editing && (
        <form className="ltEdit" onSubmit={async (e) => { e.preventDefault(); if (await run("save", () => saveLettersAsAdmin(d.code, draft))) setEditing(false); }}>
          <label>서명(교구장 성함)<input value={draft.signer} onChange={(e) => setDraft({ ...draft, signer: e.target.value })} maxLength={40} /></label>
          <label>편지 ① · VIP · 인도자 · 미래셀<textarea rows={6} value={draft.one} onChange={(e) => setDraft({ ...draft, one: e.target.value })} maxLength={2000} /></label>
          <label>편지 ② · 일반 성도<textarea rows={5} value={draft.two} onChange={(e) => setDraft({ ...draft, two: e.target.value })} maxLength={2000} /></label>
          <span className="rowAct"><button className="btn gold small" disabled={busy !== null}>{busy === "save" ? "저장 중…" : "저장"}</button></span>
        </form>
      )}
      {err && <p className="tiny warn" role="status">{err}</p>}
    </article>
  );
}
