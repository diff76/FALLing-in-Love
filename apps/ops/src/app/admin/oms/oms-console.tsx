"use client";

import { useMemo, useState } from "react";
import { createBrowserSupabaseClient, OMS_BUCKET, type OmsTrack } from "@fil/supabase";
import { deleteTrack, editTrack, listTracks, reorderTracks, trackUploadTicket, type Result, type TrackFolder } from "./actions";

type Staged = { id: string; file: File; title: string; artist: string; status: "wait" | "up" | "done" | "fail"; msg?: string };
const MAX_BYTES = 50 * 1024 * 1024;
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)}MB`;
/** Server actions return {ok, data | error} (thrown messages are hidden in production); turn a failure back into a throw here. */
export async function ok<T>(p: Promise<Result<T>>): Promise<T> { const r = await p; if (!r.ok) throw new Error(r.error); return r.data; }

/** "03 - 제목 - 연주자.mp3" → {n: 3, title, artist}; anything else → the file name as the title. */
function fromFileName(name: string) {
  const base = name.replace(/\.[^.]+$/, "");
  const m = base.match(/^(\d+)\s*[-_.)]\s*(.*)$/);
  const [title, ...artist] = (m ? m[2] : base).trim().split(/\s+-\s+/);
  return { n: m ? Number(m[1]) : Number.MAX_SAFE_INTEGER, title: title || base, artist: artist.join(" - ") };
}

/**
 * Admin: the playlist THE ONE MORE SONG plays on the web site (falling.eventgo.kr/one-more-song).
 * Pick files → check title/artist → upload. Files go straight to storage through one-time signed URLs,
 * so long tracks are fine (up to 50MB each). Order, titles and deletions apply to the site right away.
 */
export function OmsConsole({ initial, playerUrl, loadError, folder = "tracks" }: { initial: OmsTrack[]; playerUrl: string; loadError: boolean; folder?: TrackFolder }) {
  const bgm = folder === "bgm";
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [tracks, setTracks] = useState(initial);
  const [staged, setStaged] = useState<Staged[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(loadError ? "곡 목록을 불러오지 못했습니다. 새로고침해 보세요." : null);
  const [edit, setEdit] = useState<{ key: string; title: string; artist: string } | null>(null);
  const [drag, setDrag] = useState(false);

  const reload = async () => setTracks(await ok(listTracks(folder)));
  const run = async (tag: string, fn: () => Promise<void>, done?: string) => {
    setBusy(tag); setMsg(null);
    try { await fn(); await reload(); if (done) setMsg(done); }
    catch (e) { setMsg((e as Error).message); await reload().catch(() => {}); }
    finally { setBusy(null); }
  };

  const stage = (files: FileList | File[] | null) => {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("audio/") || /\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(f.name));
    if (!list.length) { setMsg("음악 파일(mp3, m4a, wav 등)을 골라 주세요."); return; }
    const rows = list
      .map((f) => ({ f, p: fromFileName(f.name) }))
      .sort((a, b) => a.p.n - b.p.n || a.f.name.localeCompare(b.f.name, "ko"))
      .map(({ f, p }) => ({ id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 6)}`, file: f, title: p.title, artist: p.artist, status: "wait" as const }));
    setStaged((s) => [...s.filter((x) => x.status !== "done"), ...rows]); setMsg(null);
  };
  const patch = (id: string, p: Partial<Staged>) => setStaged((s) => s.map((x) => (x.id === id ? { ...x, ...p } : x)));

  async function uploadAll() {
    const todo = staged.filter((s) => s.status === "wait" || s.status === "fail");
    if (!todo.length) return;
    setBusy("upload"); setMsg(null);
    let uploaded = 0;
    for (const s of todo) {
      if (!s.title.trim()) { patch(s.id, { status: "fail", msg: "제목을 적어 주세요." }); continue; }
      if (s.file.size > MAX_BYTES) { patch(s.id, { status: "fail", msg: "50MB를 넘습니다." }); continue; }
      patch(s.id, { status: "up", msg: undefined });
      try {
        const ext = s.file.name.split(".").pop() ?? "mp3";
        const { key, token } = await ok(trackUploadTicket({ title: s.title, artist: s.artist, ext, size: s.file.size, folder }));
        const { error } = await supabase.storage.from(OMS_BUCKET).uploadToSignedUrl(key, token, s.file, { contentType: s.file.type || "audio/mpeg" });
        if (error) throw error;
        patch(s.id, { status: "done" }); uploaded++;
      } catch (e) { patch(s.id, { status: "fail", msg: (e as Error).message }); }
    }
    await reload().catch(() => {});
    setBusy(null);
    setMsg(`${uploaded}곡을 올렸습니다.${uploaded < todo.length ? ` ${todo.length - uploaded}곡은 실패했습니다 — 아래에서 확인 후 다시 올려 주세요.` : (bgm ? " 웹사이트 배경음악에 바로 반영됩니다." : " 웹사이트 플레이어에 바로 반영됩니다.")}`);
  }

  const move = (i: number, d: -1 | 1) => {
    const keys = tracks.map((t) => t.key); const j = i + d;
    if (j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j], keys[i]];
    return run(`move-${i}`, () => ok(reorderTracks(keys)));
  };
  const pending = staged.filter((s) => s.status === "wait" || s.status === "fail").length;

  return (
    <div className="omsConsole">
      <section className="box">
        <h2>{bgm ? "배경음악 올리기" : "곡 올리기"}</h2>
        <p className="sub">파일 이름을 <code>03 - 곡 제목 - 연주자.mp3</code>처럼 하면 제목·연주자가 자동으로 채워집니다. 올린 곡은 목록 맨 뒤에 붙고, 순서는 아래에서 바꿀 수 있습니다. 파일당 50MB까지.</p>
        <label className={`omsDrop ${drag ? "drag" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); stage(e.dataTransfer.files); }}>
          <b>음악 파일 고르기</b><small>여러 곡을 한꺼번에 고르거나, 이곳으로 끌어다 놓으세요</small>
          <input type="file" accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.flac" multiple disabled={busy !== null} onChange={(e) => { stage(e.target.files); e.target.value = ""; }} />
        </label>
        {staged.length > 0 && (
          <>
            <table className="omsTable staged">
              <thead><tr><th>파일</th><th>곡 제목</th><th>연주자</th><th>상태</th><th /></tr></thead>
              <tbody>{staged.map((s) => (
                <tr key={s.id} className={s.status}>
                  <td className="file"><span>{s.file.name}</span><small>{mb(s.file.size)}</small></td>
                  <td><input value={s.title} disabled={s.status === "up" || s.status === "done"} onChange={(e) => patch(s.id, { title: e.target.value })} aria-label="곡 제목" /></td>
                  <td><input value={s.artist} disabled={s.status === "up" || s.status === "done"} onChange={(e) => patch(s.id, { artist: e.target.value })} placeholder="(선택)" aria-label="연주자" /></td>
                  <td className="state">{s.status === "wait" ? "대기" : s.status === "up" ? "올리는 중…" : s.status === "done" ? "완료" : <em title={s.msg}>실패 · {s.msg}</em>}</td>
                  <td>{s.status !== "up" && s.status !== "done" && <button type="button" className="miniBtn" disabled={busy !== null} onClick={() => setStaged((x) => x.filter((y) => y.id !== s.id))} aria-label="목록에서 빼기">빼기</button>}</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="omsStageAct">
              {(pending > 0 || busy === "upload") && <button type="button" className="btn gold small" disabled={busy !== null} onClick={uploadAll}>{busy === "upload" ? "올리는 중…" : `${pending}곡 올리기`}</button>}
              <button type="button" className="btn ghost small" disabled={busy !== null} onClick={() => setStaged([])}>{pending ? "목록 비우기" : "닫기"}</button>
            </div>
          </>
        )}
        {msg && <p className="tiny omsMsg">{msg}</p>}
      </section>

      <section className="box">
        <h2>{bgm ? "배경음악 목록" : "재생 목록"} <small>{tracks.length}곡 · <a href={playerUrl} target="_blank" rel="noreferrer">{bgm ? "웹사이트 열기 ↗" : "웹사이트 플레이어 열기 ↗"}</a></small></h2>
        {!tracks.length ? <p className="tiny">{bgm ? "아직 올린 곡이 없습니다. 곡이 없으면 웹사이트에 배경음악 버튼이 나오지 않습니다." : "아직 올린 곡이 없습니다. 웹사이트에는 “트랙이 아직 없습니다”로 보입니다."}</p> : (
          <ol className="omsTracks">
            {tracks.map((t, i) => (
              <li key={t.key}>
                <b className="num">{String(i + 1).padStart(2, "0")}</b>
                {edit?.key === t.key ? (
                  <div className="omsEdit">
                    <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} aria-label="곡 제목" autoFocus />
                    <input value={edit.artist} onChange={(e) => setEdit({ ...edit, artist: e.target.value })} placeholder="연주자 (선택)" aria-label="연주자" />
                    <button type="button" className="miniBtn" disabled={busy !== null} onClick={() => run("edit", async () => { await ok(editTrack(t.key, edit.title, edit.artist)); setEdit(null); }, "곡 정보를 고쳤습니다.")}>저장</button>
                    <button type="button" className="miniBtn" onClick={() => setEdit(null)}>취소</button>
                  </div>
                ) : (
                  <div className="meta"><span>{t.title}</span>{t.artist && <small>{t.artist}</small>}</div>
                )}
                <audio controls preload="none" src={t.url} />
                <div className="rowBtns">
                  <button type="button" className="miniBtn" disabled={busy !== null || i === 0} onClick={() => move(i, -1)} aria-label="위로">↑</button>
                  <button type="button" className="miniBtn" disabled={busy !== null || i === tracks.length - 1} onClick={() => move(i, 1)} aria-label="아래로">↓</button>
                  <button type="button" className="miniBtn" disabled={busy !== null} onClick={() => setEdit({ key: t.key, title: t.title, artist: t.artist })}>수정</button>
                  <button type="button" className="miniBtn del" disabled={busy !== null}
                    onClick={() => window.confirm(`“${t.title}”을(를) 삭제할까요? 웹사이트에서도 바로 빠지고 되돌릴 수 없습니다.`) && run(`del-${t.key}`, () => ok(deleteTrack(t.key)), "삭제했습니다.")}>삭제</button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
