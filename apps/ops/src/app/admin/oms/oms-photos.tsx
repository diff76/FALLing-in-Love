"use client";

import { useMemo, useState } from "react";
import { createBrowserSupabaseClient, OMS_BUCKET, type OmsPhoto } from "@fil/supabase";
import { deletePhotos, listPhotos, photoUploadTicket } from "./actions";
import { ok } from "./oms-console";

/** Shrink in the browser (longest edge 2400px, JPEG, camera rotation applied) so the gallery stays light on phones. */
async function shrink(file: File): Promise<Blob> {
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { throw new Error("이 형식은 읽을 수 없습니다 (JPG·PNG로 바꿔서 올려 주세요)"); }
  const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h); bmp.close();
  return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("이미지 변환 실패"))), "image/jpeg", 0.86));
}

/**
 * Admin: the photos of THE ONE MORE SONG — the web site's photo page and the player's slideshow
 * (oldest first). Pick or drop many at once; each is resized here and uploaded straight to storage.
 */
export function OmsPhotos({ initial, galleryUrl }: { initial: OmsPhoto[]; galleryUrl: string }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [photos, setPhotos] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  const reload = async () => setPhotos(await ok(listPhotos()));

  async function upload(files: FileList | File[] | null) {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name));
    if (!list.length) { setMsg("사진 파일(JPG, PNG 등)을 골라 주세요."); return; }
    setBusy("upload"); setMsg(null); setProgress({ done: 0, total: list.length });
    const fail: string[] = [];
    for (const [n, f] of list.entries()) {
      try {
        const body = await shrink(f);
        const { key, token } = await ok(photoUploadTicket(body.size));
        const { error } = await supabase.storage.from(OMS_BUCKET).uploadToSignedUrl(key, token, body, { contentType: "image/jpeg" });
        if (error) throw error;
      } catch (e) { fail.push(`${f.name} — ${(e as Error).message}`); }
      setProgress({ done: n + 1, total: list.length });
    }
    await reload().catch(() => {});
    setBusy(null); setProgress(null);
    const okCount = list.length - fail.length;
    setMsg(`${okCount}장을 올렸습니다.${fail.length ? ` 실패 ${fail.length}장: ${fail.join(" / ")}` : " 웹사이트 사진 페이지와 플레이어 슬라이드쇼에 바로 반영됩니다."}`);
  }

  async function remove(keys: string[], label: string) {
    if (!window.confirm(`${label}을(를) 삭제할까요? 웹사이트에서도 바로 빠지고 되돌릴 수 없습니다.`)) return;
    setBusy("delete"); setMsg(null);
    try { await ok(deletePhotos(keys)); await reload(); setMsg(`${label}을(를) 삭제했습니다.`); }
    catch (e) { setMsg((e as Error).message); await reload().catch(() => {}); }
    finally { setBusy(null); }
  }

  return (
    <section className="box">
      <h2>사진 <small>{photos.length}장 · <a href={galleryUrl} target="_blank" rel="noreferrer">웹사이트 사진 페이지 열기 ↗</a></small></h2>
      <p className="sub">여러 장을 한꺼번에 올릴 수 있습니다. 긴 변 2400px로 줄여서 올리며, 올린 순서대로 사진 페이지와 플레이어 슬라이드쇼에 나옵니다.</p>
      <label className={`omsDrop ${drag ? "drag" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (!busy) upload(e.dataTransfer.files); }}>
        <b>{busy === "upload" && progress ? `올리는 중… ${progress.done} / ${progress.total}` : "사진 고르기"}</b>
        <small>{busy === "upload" ? "창을 닫지 말고 잠시 기다려 주세요" : "여러 장을 한꺼번에 고르거나, 이곳으로 끌어다 놓으세요"}</small>
        {progress && <i className="omsPhotoBar"><i style={{ width: `${(progress.done / progress.total) * 100}%` }} /></i>}
        <input type="file" accept="image/*" multiple disabled={busy !== null} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
      </label>
      {msg && <p className="tiny omsMsg">{msg}</p>}
      {photos.length > 0 && (
        <ul className="omsPhotoGrid">
            {photos.map((p, i) => (
              <li key={p.key}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`사진 ${i + 1}`} loading="lazy" />
                <span>{i + 1}</span>
                <button type="button" className="miniBtn del" disabled={busy !== null} onClick={() => remove([p.key], `사진 ${i + 1}`)}>삭제</button>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}
