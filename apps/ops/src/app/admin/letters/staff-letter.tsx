"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LETTER_MAX_CHARS, LETTER_MAX_PHOTOS } from "@fil/domain";
import { removeStaffPhoto, saveStaffLetter, staffPhotos, staffPhotoTicket } from "./actions";
import type { StaffLetter } from "./data";

const fmt = (iso: string) => new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

/** Phone photos are large: shrink to at most 1800 px and send a JPEG. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h); bmp.close();
  return await new Promise<Blob>((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error("사진을 바꾸지 못했습니다"))), "image/jpeg", 0.86));
}

/**
 * Admin: the one letter for all the STAFF (/letter/staff) — same look as the district letters, written here with a
 * free signature line and up to six photos (saved the moment they are added).
 */
export function StaffLetterBox({ initial }: { initial: StaffLetter }) {
  const router = useRouter();
  const [body, setBody] = useState(initial.body);
  const [sign, setSign] = useState(initial.signer);
  const [saved, setSaved] = useState({ body: initial.body, sign: initial.signer });
  const [photos, setPhotos] = useState(initial.photos);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const dirty = body !== saved.body || sign !== saved.sign;

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy("save"); setMsg(null);
    const r = await saveStaffLetter(body, sign);
    if (r.ok) { setSaved({ body, sign }); setMsg({ ok: true, text: "저장했습니다. ‘편지 열기’로 받는 분 화면을 확인해 보세요." }); router.refresh(); }
    else setMsg({ ok: false, text: r.error });
    setBusy(null);
  };
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = [...files].slice(0, Math.max(0, LETTER_MAX_PHOTOS - photos.length));
    setMsg(null);
    try {
      for (const [n, f] of list.entries()) {
        setBusy(`사진 올리는 중… ${n + 1} / ${list.length}`);
        const blob = await shrink(f);
        const t = await staffPhotoTicket();
        if (!t.ok) throw new Error(t.error);
        const form = new FormData(); form.append("cacheControl", "3600"); form.append("", blob, "photo.jpg");
        const r = await fetch(t.data.signedUrl, { method: "PUT", body: form, headers: { "x-upsert": "false" } });
        if (!r.ok) throw new Error("사진을 올리지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
      const p = await staffPhotos();
      if (p.ok) setPhotos(p.data);
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setBusy(null); }
  };
  const remove = async (key: string) => {
    const r = await removeStaffPhoto(key);
    if (r.ok) setPhotos(photos.filter((p) => p.key !== key)); else setMsg({ ok: false, text: r.error });
  };
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { window.prompt("복사하세요", text); }
  };

  return (
    <section className="box staffLetter">
      <h2>STAFF 편지 <small>모든 STAFF에게 같은 링크 하나로 보냅니다 · 관리자만 쓸 수 있습니다</small></h2>
      <div className="ltStaffTop">
        <span className={`tag ${saved.body.trim() ? "in" : ""}`}>{saved.body.trim() ? `작성됨 · ${saved.body.length}자${photos.length ? ` · 사진 ${photos.length}` : ""}` : "작성 전"}</span>
        {initial.updatedAt && <span className="tiny">최근 저장 {fmt(initial.updatedAt)}</span>}
        <span className="rowAct">
          {saved.body.trim() && <a className="miniBtn" href={initial.url} target="_blank" rel="noreferrer">편지 열기</a>}
          <button type="button" className="miniBtn" onClick={() => copy(initial.url)}>{copied ? "복사됨" : "링크 복사"}</button>
          <button type="button" className="miniBtn" onClick={() => copy(`[창동염광교회] FALLing in Love를 함께 섬겨 주셔서 감사합니다. STAFF 여러분께 보내는 감사 편지가 도착했어요.\n${initial.url}`)}>문자 문구 복사</button>
        </span>
      </div>
      <form className="ltEdit" onSubmit={save}>
        <p className="tiny">편지 첫 인사는 “그날을 함께 섬겨 주신 STAFF께”로 자동으로 나옵니다.</p>
        <label>편지 <small className="tiny">{body.length} / {LETTER_MAX_CHARS}</small>
          <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} maxLength={LETTER_MAX_CHARS} placeholder="예) 그날 주차장과 채플, 정원 곳곳을 지켜 주신 STAFF 여러분, 감사합니다. …" />
        </label>
        <label>서명 <small className="tiny">편지 끝에 이 문구가 그대로 들어갑니다 (예: 2026 온출전 준비위원회 올림)</small>
          <input value={sign} onChange={(e) => setSign(e.target.value)} maxLength={80} placeholder="2026 온출전 준비위원회 올림" />
        </label>
        <div className="ltStaffPhotos">
          <span className="tiny">사진 {photos.length} / {LETTER_MAX_PHOTOS}장 · 편지 글 아래에 보입니다. 붙이는 즉시 저장됩니다.</span>
          <div className="ltReadPhotos">
            {photos.map((p) => (
              <figure key={p.key}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" />
                <button type="button" onClick={() => remove(p.key)} aria-label="사진 빼기">✕</button>
              </figure>
            ))}
            {photos.length < LETTER_MAX_PHOTOS && (
              <label className="ltAddPhoto">
                <input type="file" accept="image/*" multiple disabled={busy !== null} onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
                <span>{busy?.startsWith("사진") ? busy : "+ 사진 추가"}</span>
              </label>
            )}
          </div>
        </div>
        <span className="rowAct"><button className="btn gold small" disabled={busy !== null || !dirty}>{busy === "save" ? "저장 중…" : dirty ? "STAFF 편지 저장" : "저장됨"}</button></span>
        {msg && <p className={`tiny ${msg.ok ? "" : "warn"}`} role="status">{msg.text}</p>}
      </form>
    </section>
  );
}
