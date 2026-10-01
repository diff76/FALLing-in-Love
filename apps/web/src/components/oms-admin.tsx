"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@fil/supabase";

type Item = { key: string; url: string; title?: string; artist?: string };
const BUCKET = "oms";
/** Ops accounts sign in with a short id (admin, staff…) that maps to <id>@ops.eventgo.kr. */
const toEmail = (id: string) => (id.includes("@") ? id.trim().toLowerCase() : `${id.trim().toLowerCase()}@ops.eventgo.kr`);

/** Shrink a photo in the browser (longest edge 2400px, JPEG) so the gallery stays light on phones. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h); bmp.close();
  return await new Promise<Blob>((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error("이미지 변환 실패"))), "image/jpeg", 0.86));
}
/** "03 - Title - Artist.mp3" → {order: 3, title, artist} */
function parseName(name: string) {
  const base = name.replace(/\.[^.]+$/, "");
  const m = base.match(/^(\d+)\s*[-_.)]\s*(.*)$/);
  const rest = (m ? m[2] : base).trim();
  const [title, ...artist] = rest.split(/\s+-\s+/);
  return { order: m ? Number(m[1]) : 0, title: title || base, artist: artist.join(" - ") };
}

/**
 * The "관리자 로그인" button on the photo page. Signs in with an ops admin account (same ids and
 * passwords as the ops app), then uploads photos / tracks straight to storage through one-time
 * signed URLs from /api/oms/upload, and can delete them. Non-admins never see the panel.
 */
export function OmsAdmin({ photos, tracks }: { photos: Item[]; tracks: Item[] }) {
  const router = useRouter();
  const supabase = useMemo(() => (isSupabaseConfigured() ? createBrowserSupabaseClient() : null), []);
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  const [openLogin, setOpenLogin] = useState(false);
  const [form, setForm] = useState({ id: "", pw: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const check = async (t: string | null) => {
    setToken(t);
    if (!t) { setAdmin(false); return; }
    const r = await fetch("/api/oms/me", { headers: { authorization: `Bearer ${t}` } }).then((x) => x.json()).catch(() => ({ admin: false }));
    setAdmin(!!r.admin);
  };
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => check(data.session?.access_token ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => check(s?.access_token ?? null));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  async function login(e: React.FormEvent) {
    e.preventDefault(); if (!supabase) return;
    setBusy("login"); setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email: toEmail(form.id), password: form.pw });
    setBusy(null);
    if (error) { setMsg("아이디 또는 비밀번호가 맞지 않습니다."); return; }
    setOpenLogin(false); setForm({ id: "", pw: "" });
  }
  async function upload(kind: "photo" | "track", files: FileList | null) {
    if (!files?.length || !supabase || !token) return;
    setBusy(kind); setMsg(null);
    let ok = 0; const fail: string[] = [];
    for (const [n, f] of Array.from(files).entries()) {
      try {
        setMsg(`${kind === "photo" ? "사진" : "트랙"} 올리는 중… ${n + 1}/${files.length}`);
        const meta = kind === "track" ? { ...parseName(f.name), ext: f.name.split(".").pop() ?? "mp3" } : {};
        if (kind === "track" && !("order" in meta && meta.order)) Object.assign(meta, { order: tracks.length + n + 1 });
        const res = await fetch("/api/oms/upload", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ kind, ...meta }) });
        const j = await res.json(); if (!res.ok) throw new Error(j.message);
        const body = kind === "photo" ? await shrink(f) : f;
        const { error } = await supabase.storage.from(BUCKET).uploadToSignedUrl(j.key, j.token, body, { contentType: kind === "photo" ? "image/jpeg" : f.type || "audio/mpeg" });
        if (error) throw error;
        ok++;
      } catch (e) { fail.push(`${f.name}: ${(e as Error).message}`); }
    }
    setBusy(null);
    setMsg(`${ok}개 올렸습니다.${fail.length ? ` 실패 ${fail.length}개 — ${fail.join(" / ")}` : ""}`);
    router.refresh();
  }
  async function remove(key: string, label: string) {
    if (!token || !window.confirm(`${label}을(를) 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setBusy(key);
    const res = await fetch("/api/oms", { method: "DELETE", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ key }) });
    setBusy(null);
    if (!res.ok) { setMsg((await res.json()).message ?? "삭제하지 못했습니다."); return; }
    router.refresh();
  }

  if (!supabase) return null;
  return (
    <section className="omsAdmin">
      {!token || !admin ? (
        <>
          <button type="button" className="omsAdminBtn" onClick={() => setOpenLogin(true)}>관리자 로그인</button>
          {token && !admin && <p className="tiny">이 계정에는 관리자 권한이 없습니다. <button type="button" className="linkish" onClick={() => supabase.auth.signOut()}>로그아웃</button></p>}
          {openLogin && (
            <div className="omsModal" role="dialog" aria-modal="true" onClick={() => setOpenLogin(false)}>
              <form className="omsLogin" onSubmit={login} onClick={(e) => e.stopPropagation()}>
                <h3>관리자 로그인</h3>
                <p>운영앱 관리자 아이디로 로그인하면 사진과 트랙을 올릴 수 있습니다.</p>
                <label>아이디<input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} autoCapitalize="none" autoComplete="username" required /></label>
                <label>비밀번호<input type="password" value={form.pw} onChange={(e) => setForm({ ...form, pw: e.target.value })} autoComplete="current-password" required /></label>
                <button type="submit" disabled={busy === "login"}>{busy === "login" ? "확인 중…" : "로그인"}</button>
                {msg && <small className="warn">{msg}</small>}
              </form>
            </div>
          )}
        </>
      ) : (
        <div className="omsAdminPanel">
          <header><b>관리자</b><button type="button" className="linkish" onClick={() => supabase.auth.signOut()}>로그아웃</button></header>
          <div className="omsUploads">
            <label className="omsUpload">사진 올리기<small>여러 장 선택 가능 · 긴 변 2400px로 줄여서 올립니다</small>
              <input type="file" accept="image/*" multiple disabled={busy !== null} onChange={(e) => { upload("photo", e.target.files); e.target.value = ""; }} />
            </label>
            <label className="omsUpload">트랙 올리기<small>파일 이름을 “03 - 곡 제목 - 연주자.mp3”처럼 하면 순서·제목이 자동으로 잡힙니다 · 파일당 50MB까지</small>
              <input type="file" accept="audio/*" multiple disabled={busy !== null} onChange={(e) => { upload("track", e.target.files); e.target.value = ""; }} />
            </label>
          </div>
          {msg && <p className="tiny">{msg}</p>}
          {tracks.length > 0 && (
            <ol className="omsAdminTracks">
              {tracks.map((t) => <li key={t.key}><span>{t.title}{t.artist ? ` · ${t.artist}` : ""}</span><button type="button" disabled={busy !== null} onClick={() => remove(t.key, `트랙 “${t.title}”`)}>삭제</button></li>)}
            </ol>
          )}
          {photos.length > 0 && (
            <div className="omsAdminPhotos">
              {photos.map((p, i) => (
                <figure key={p.key}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" loading="lazy" />
                  <button type="button" disabled={busy !== null} onClick={() => remove(p.key, `사진 ${i + 1}`)}>삭제</button>
                </figure>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
