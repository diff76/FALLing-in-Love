"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { letterCode, LETTER_AUDIENCES, LETTER_MAX_CHARS, type LetterAudience } from "@fil/domain";
import { createEditorLink, revokeEditorLink, saveLettersAsAdmin } from "./actions";
import type { DistrictLetters } from "./data";

const AUD: Record<LetterAudience, string> = { vip: "VIP", leader: "인도자", mirae: "미래셀", member: "일반 성도" };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "");

/**
 * One card per district: the four letters' status (written · photos · who saved when), the letter links,
 * the pastor's writing links, reading each letter in full, and direct editing.
 */
export function LettersConsole({ districts, webOrigin }: { districts: DistrictLetters[]; webOrigin: string }) {
  const written = districts.reduce((n, d) => n + LETTER_AUDIENCES.filter((a) => d.letters[a]?.body.trim()).length, 0);
  const needed = districts.reduce((n, d) => n + LETTER_AUDIENCES.filter((a) => d.counts[a] > 0).length, 0);
  return (
    <section className="box">
      <h2>교구별 편지 <small>받는 분이 있는 편지 {needed}편 중 {written}편 작성 · 받는 분이 없는 편지는 쓰지 않아도 됩니다</small></h2>
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
  const [mode, setMode] = useState<"none" | "read" | "edit">("none");
  const [view, setView] = useState<LetterAudience>("vip");
  const signer = LETTER_AUDIENCES.map((a) => d.letters[a]?.signer).find(Boolean) ?? "";
  const [draft, setDraft] = useState({ ...(Object.fromEntries(LETTER_AUDIENCES.map((a) => [a, d.letters[a]?.body ?? ""])) as Record<LetterAudience, string>), signer });
  const total = LETTER_AUDIENCES.reduce((n, a) => n + d.counts[a], 0);
  const live = d.editors.filter((e) => !e.revokedAt);
  const has = (a: LetterAudience) => !!d.letters[a]?.body.trim();
  const last = LETTER_AUDIENCES.map((a) => d.letters[a]).filter(Boolean).sort((x, y) => (x!.updatedAt < y!.updatedAt ? 1 : -1))[0];

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
        <span className="tiny">받는 분 {total}명{signer ? ` · 서명 ${signer} 목사` : ""}{last ? ` · 최근 저장 ${fmt(last.updatedAt)} (${last.via === "admin" ? "관리자" : "목사님"})` : ""}</span>
      </header>

      <div className="ltGrid">
        {LETTER_AUDIENCES.map((a) => {
          const url = `${webOrigin}/letter/${letterCode(d.code, a)}`;
          return (
            <div key={a} className={`ltAud ${has(a) ? "ok" : d.counts[a] ? "todo" : "none"}`}>
              <span className="ltAudTop"><b>{AUD[a]}</b><small>{d.counts[a]}명</small></span>
              <span className="ltAudState">{has(a) ? `작성됨 · ${d.letters[a]!.body.length}자${d.photos[a].length ? ` · 사진 ${d.photos[a].length}` : ""}` : d.counts[a] ? "작성 전" : "받는 분 없음"}</span>
              <span className="rowAct">
                <a className="miniBtn" href={url} target="_blank" rel="noreferrer">열기</a>
                <button type="button" className="miniBtn" onClick={() => copy(a, url)}>{copied === a ? "복사됨" : "링크"}</button>
              </span>
            </div>
          );
        })}
      </div>

      <div className="ltEditors">
        <span className="tiny">{live.length ? `작성 링크 ${live.length}개 · ${live.map((e) => `${e.label || "메모 없음"}${e.lastUsedAt ? ` (최근 접속 ${fmt(e.lastUsedAt)})` : " (아직 안 열림)"}`).join(", ")}` : "작성 링크가 없습니다."}</span>
        <span className="rowAct">
          <button type="button" className="miniBtn" disabled={busy !== null} onClick={async () => {
            setBusy("mint"); setErr(null);
            const r = await createEditorLink(d.code, `${d.label} 교구장`);
            if (r.ok) { setMinted(r.data.url); router.refresh(); } else setErr(r.error);
            setBusy(null);
          }}>{busy === "mint" ? "만드는 중…" : "작성 링크 만들기"}</button>
          {live.map((e) => <button key={e.id} type="button" className="miniBtn" disabled={busy !== null} onClick={() => run(`rv${e.id}`, () => revokeEditorLink(e.id))}>{busy === `rv${e.id}` ? "…" : `링크 끊기${live.length > 1 ? ` (${fmt(e.createdAt)})` : ""}`}</button>)}
          <button type="button" className="miniBtn" onClick={() => setMode(mode === "read" ? "none" : "read")}>{mode === "read" ? "내용 닫기" : "내용 보기"}</button>
          <button type="button" className="miniBtn" onClick={() => setMode(mode === "edit" ? "none" : "edit")}>{mode === "edit" ? "직접 쓰기 닫기" : "직접 쓰기"}</button>
        </span>
      </div>

      {minted && (
        <div className="minted">
          <span className="tiny">교구장 목사님께 이 링크를 보내 주세요. 지금 한 번만 보입니다.</span>
          <code>{minted}</code>
          <span className="rowAct">
            <button type="button" className="miniBtn" onClick={() => copy("minted", `${d.label} 감사 편지 작성 링크입니다. VIP · 인도자 · 미래셀 · 일반 성도께 보낼 편지를 각각 써 주세요. 사진도 붙일 수 있습니다.\n${minted}`)}>{copied === "minted" ? "복사됨" : "안내 문구와 복사"}</button>
            <button type="button" className="miniBtn" onClick={() => setMinted(null)}>닫기</button>
          </span>
        </div>
      )}

      {mode === "read" && (
        <div className="ltRead">
          <div className="seg">{LETTER_AUDIENCES.map((a) => <button key={a} type="button" className="miniBtn" aria-pressed={view === a} onClick={() => setView(a)}>{AUD[a]}</button>)}</div>
          {has(view) ? (
            <>
              <div className="ltReadBody">{d.letters[view]!.body}</div>
              {d.letters[view]!.signer && <p className="tiny" style={{ textAlign: "right" }}>{d.label} 교구장 {d.letters[view]!.signer} 목사 올림</p>}
            </>
          ) : <p className="tiny">아직 쓰지 않은 편지입니다.</p>}
          {d.photos[view].length > 0 && (
            <div className="ltReadPhotos">{d.photos[view].map((u) => <a key={u} href={u} target="_blank" rel="noreferrer">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={u} alt="" /></a>)}</div>
          )}
        </div>
      )}

      {mode === "edit" && (
        <form className="ltEdit" onSubmit={async (e) => { e.preventDefault(); if (await run("save", () => saveLettersAsAdmin(d.code, draft))) setMode("none"); }}>
          <label>서명(교구장 성함)<input value={draft.signer} onChange={(e) => setDraft({ ...draft, signer: e.target.value })} maxLength={40} /></label>
          {LETTER_AUDIENCES.map((a) => (
            <label key={a}>{AUD[a]} 편지 <small className="tiny">{draft[a].length} / {LETTER_MAX_CHARS}</small>
              <textarea rows={5} value={draft[a]} onChange={(e) => setDraft({ ...draft, [a]: e.target.value })} maxLength={LETTER_MAX_CHARS} />
            </label>
          ))}
          <p className="tiny">사진은 교구장 목사님의 작성 링크에서 붙이거나 뺄 수 있습니다.</p>
          <span className="rowAct"><button className="btn gold small" disabled={busy !== null}>{busy === "save" ? "저장 중…" : "네 편 저장"}</button></span>
        </form>
      )}
      {err && <p className="tiny warn" role="status">{err}</p>}
    </article>
  );
}
