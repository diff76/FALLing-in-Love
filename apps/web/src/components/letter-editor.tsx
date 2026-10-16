"use client";

import { useState } from "react";
import { LETTER_AUDIENCES, LETTER_MAX_CHARS, LETTER_MAX_PHOTOS, type LetterAudience } from "@fil/domain";

type Draft = Record<LetterAudience, string> & { signer: string };
type Photo = { key: string; url: string };
type Props = {
  token: string; districtLabel: string; initial: Draft; photos: Record<LetterAudience, Photo[]>; savedAt: string | null;
  counts: Record<LetterAudience, number>; greetings: Record<LetterAudience, string>; links: Record<LetterAudience, string>;
};

const TAB: Record<LetterAudience, string> = { vip: "VIP", leader: "인도자", mirae: "미래셀", member: "일반 성도" };
const WHO: Record<LetterAudience, string> = { vip: "초대받아 오신 VIP", leader: "VIP를 초대한 인도자", mirae: "미래셀", member: "혼자 신청한 일반 성도" };
const fmt = (iso: string) => new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

/** Phone photos are large: shrink to at most 1800 px and send a JPEG (iPhone HEIC turns into JPEG too). */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h); bmp.close();
  return await new Promise<Blob>((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error("사진을 바꾸지 못했습니다"))), "image/jpeg", 0.86));
}

/**
 * The pastor writes four letters — one per audience — in tabs, signs once, adds photos to each letter,
 * saves, and opens each letter to see it as it will arrive. Photos are saved the moment they are added.
 */
export function LetterEditor({ token, districtLabel, initial, photos: initialPhotos, savedAt, counts, greetings, links }: Props) {
  const [d, setD] = useState<Draft>(initial);
  const [saved, setSaved] = useState<Draft>(initial);
  const [photos, setPhotos] = useState(initialPhotos);
  const [tab, setTab] = useState<LetterAudience>("vip");
  const [at, setAt] = useState(savedAt);
  const [busy, setBusy] = useState(false);
  const [upload, setUpload] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = LETTER_AUDIENCES.some((a) => d[a] !== saved[a]) || d.signer !== saved.signer;

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

  const api = (method: "POST" | "PUT" | "DELETE", body: object) =>
    fetch("/api/letter/photo", { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ token, ...body }) })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.message); return j; });

  async function addPhotos(files: FileList | null, a: LetterAudience) {
    if (!files?.length) return;
    setMsg(null);
    const list = [...files].slice(0, Math.max(0, LETTER_MAX_PHOTOS - photos[a].length));
    if (!list.length) { setMsg({ ok: false, text: `사진은 편지마다 ${LETTER_MAX_PHOTOS}장까지 붙일 수 있습니다.` }); return; }
    try {
      for (const [n, f] of list.entries()) {
        setUpload(`사진 올리는 중… ${n + 1} / ${list.length}`);
        const blob = await shrink(f);
        const { signedUrl } = await api("POST", { audience: a }) as { signedUrl: string };
        const form = new FormData(); form.append("cacheControl", "3600"); form.append("", blob, "photo.jpg");
        const r = await fetch(signedUrl, { method: "PUT", body: form, headers: { "x-upsert": "false" } });
        if (!r.ok) throw new Error("사진을 올리지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
      const j = await api("PUT", { audience: a }) as { photos: Photo[] };
      setPhotos({ ...photos, [a]: j.photos });
      setMsg({ ok: true, text: "사진을 붙였습니다. 사진은 바로 저장됩니다." });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setUpload(null); }
  }
  async function removePhoto(a: LetterAudience, key: string) {
    try { await api("DELETE", { key }); setPhotos({ ...photos, [a]: photos[a].filter((p) => p.key !== key) }); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  }

  const state = (a: LetterAudience) => (d[a] !== saved[a] ? "고치는 중" : saved[a].trim() ? "작성됨" : "비어 있음");
  const others = LETTER_AUDIENCES.filter((a) => a !== tab && d[a].trim());

  return (
    <form className="lwForm" onSubmit={save}>
      <label className="lwField"><span>서명 <em>편지 끝에 “{districtLabel} 교구장 {d.signer || "○○○"} 목사 올림”으로 들어갑니다</em></span>
        <input value={d.signer} onChange={(e) => setD({ ...d, signer: e.target.value })} placeholder="성함" maxLength={40} autoComplete="name" />
      </label>

      <div className="lwTabs" role="tablist" aria-label="받는 분">
        {LETTER_AUDIENCES.map((a) => (
          <button key={a} type="button" role="tab" aria-selected={tab === a} className={`lwTab ${state(a) === "작성됨" ? "done" : state(a) === "고치는 중" ? "dirty" : ""}`} onClick={() => setTab(a)}>
            <b>{TAB[a]}</b><span>{counts[a]}명 · {state(a)}</span>
          </button>
        ))}
      </div>

      <div className="lwLetter" role="tabpanel">
        <div className="lwLetterHead"><b>{TAB[tab]}에게 보내는 편지</b><span>{WHO[tab]} {counts[tab]}명이 받습니다</span></div>
        <p className="lwGreeting">첫 인사(자동) · <i>{greetings[tab]}</i></p>
        <textarea value={d[tab]} onChange={(e) => setD({ ...d, [tab]: e.target.value })} rows={11} maxLength={LETTER_MAX_CHARS}
          placeholder={"예) 가을 정원의 오후, 함께해 주셔서 고맙습니다. …"} aria-label={`${TAB[tab]} 편지 본문`} />
        <div className="lwRow">
          <small>{d[tab].length} / {LETTER_MAX_CHARS}자 · 비워 두면 이 분들께 가는 링크는 열리지 않습니다.</small>
          {others.length > 0 && (
            <select value="" onChange={(e) => { const from = e.target.value as LetterAudience; if (from) setD({ ...d, [tab]: d[from] }); }} aria-label="다른 편지 내용 가져오기">
              <option value="">다른 편지 내용 가져오기</option>
              {others.map((o) => <option key={o} value={o}>{TAB[o]} 편지 내용으로 채우기</option>)}
            </select>
          )}
        </div>

        <div className="lwPhotos">
          <span className="lwPhotosHead"><b>사진</b> <small>{photos[tab].length} / {LETTER_MAX_PHOTOS}장 · 편지 글 아래에 보입니다. 붙이는 즉시 저장됩니다.</small></span>
          <div className="lwThumbs">
            {photos[tab].map((p) => (
              <figure key={p.key}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" />
                <button type="button" onClick={() => removePhoto(tab, p.key)} aria-label="사진 빼기">✕</button>
              </figure>
            ))}
            {photos[tab].length < LETTER_MAX_PHOTOS && (
              <label className={`lwAdd ${upload ? "busy" : ""}`}>
                <input type="file" accept="image/*" multiple disabled={!!upload} onChange={(e) => { addPhotos(e.target.files, tab); e.target.value = ""; }} />
                <span>{upload ?? "+ 사진 추가"}</span>
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="lwActions">
        <button type="submit" className="submitButton" disabled={busy || !dirty}>{busy ? "저장 중…" : dirty ? "편지 저장 (네 편 모두)" : "저장됨"}</button>
        {at && <span className="lwAt">마지막 저장 {fmt(at)}</span>}
      </div>
      {msg && <p className={`formMessage ${msg.ok ? "" : "error"}`} role="status">{msg.text}</p>}

      <div className="lwPreviews">
        <b>받는 분 화면</b>
        <div>
          {LETTER_AUDIENCES.map((a) => saved[a].trim()
            ? <a key={a} className="lwPreview" href={links[a]} target="_blank" rel="noreferrer">{TAB[a]} 미리 보기 ↗</a>
            : <span key={a} className="lwPreview off" title="글을 저장하면 열 수 있습니다">{TAB[a]}</span>)}
        </div>
        <small>미리 보기는 저장한 글로 열립니다. 봉투를 누르면 음악이 함께 나옵니다.</small>
      </div>
    </form>
  );
}
