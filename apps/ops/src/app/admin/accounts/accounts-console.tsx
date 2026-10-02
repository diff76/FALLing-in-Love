"use client";

import { useState } from "react";
import type { StaffRole } from "@fil/domain";
import { createAccessLink, createAccount, deleteAccessLink, deleteAccount, listAccessLinks, listAccounts, renameAccount, renameLoginId, resetPassword, revokeAccessLink, setRoles, type AccessLink, type Account } from "./actions";

const ROLE_LABEL: Record<StaffRole, string> = { staff: "스태프 (스캔·체크인, 주차)", desk: "데스크 (상황판, 디스플레이, 주차)", admin: "관리자 (전체 + 계정)", parking: "주차 (주차 관리만)" };
const ROLES: StaffRole[] = ["staff", "desk", "parking", "admin"];
/** Link expiry presets: the event day (KST end of 2026-10-11), or a rolling window. */
/** First screen an access link opens: the account's home, or the scan desk at a fixed station (?station=). */
const LANDING: { key: string; label: string }[] = [
  { key: "", label: "기본 첫 화면" },
  { key: "gate", label: "스캔 · 창동 THE GATE" },
  { key: "landing", label: "스캔 · 주차장 THE LANDING" },
  { key: "chapel", label: "스캔 · 채플 웰컴센터" },
  { key: "return", label: "스캔 · 복귀 셔틀" },
];
const EXPIRY: { key: string; label: string; at: () => Date }[] = [
  { key: "event", label: "행사 당일까지 (10/11)", at: () => new Date("2026-10-11T23:59:59+09:00") },
  { key: "7d", label: "7일", at: () => new Date(Date.now() + 7 * 864e5) },
  { key: "30d", label: "30일", at: () => new Date(Date.now() + 30 * 864e5) },
];
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

type Run = (key: string, fn: () => Promise<void>, ok: string) => Promise<void>;

export function AccountsConsole({ initial, initialLinks, selfId }: { initial: Account[]; initialLinks: AccessLink[] | null; selfId: string }) {
  const [accounts, setAccounts] = useState<Account[]>(initial);
  const [links, setLinks] = useState<AccessLink[] | null>(initialLinks);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [draft, setDraft] = useState({ loginId: "", displayName: "", password: "", roles: ["staff"] as string[] });

  const refresh = async () => { setAccounts(await listAccounts()); setLinks(await listAccessLinks()); };
  const run: Run = async (key, fn, ok) => {
    setBusy(key); setMsg(null);
    try { await fn(); await refresh(); setMsg({ kind: "ok", text: ok }); }
    catch (e) { setMsg({ kind: "err", text: (e as Error).message }); }
    finally { setBusy(null); }
  };
  const toggle = (list: string[], r: string) => (list.includes(r) ? list.filter((x) => x !== r) : [...list, r]);

  return (
    <div className="accounts">
      {msg && <p className={`tiny ${msg.kind === "err" ? "warn" : "okMsg"}`} role="status">{msg.text}</p>}

      <section className="box">
        <h2>새 계정 만들기</h2>
        <p className="tiny">아이디(영문·숫자)와 비밀번호(8자 이상)를 정해 전달하세요. 로그인 후 첫 화면은 권한으로 정해집니다: 관리자 → 관리자, 스태프 → 스캔·체크인, 데스크 → 웰컴 데스크, 주차 → 주차 관리.</p>
        <form className="acctForm" onSubmit={(e) => { e.preventDefault(); run("create", () => createAccount(draft), `${draft.loginId} 계정을 만들었습니다.`).then(() => setDraft({ loginId: "", displayName: "", password: "", roles: ["staff"] })); }}>
          <label>아이디<input required value={draft.loginId} onChange={(e) => setDraft({ ...draft, loginId: e.target.value })} autoComplete="off" autoCapitalize="none" placeholder="예: staff2" /></label>
          <label>이름 <small>선택</small><input value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} autoComplete="off" /></label>
          <label>비밀번호<input type="text" required minLength={8} value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} autoComplete="new-password" /></label>
          <fieldset><legend>권한</legend>{ROLES.map((r) => <label key={r} className="chk"><input type="checkbox" checked={draft.roles.includes(r)} onChange={() => setDraft({ ...draft, roles: toggle(draft.roles, r) })} />{ROLE_LABEL[r]}</label>)}</fieldset>
          <button className="btn gold small" type="submit" disabled={busy !== null}>{busy === "create" ? "만드는 중…" : "계정 만들기"}</button>
        </form>
      </section>

      {links === null && (
        <section className="box">
          <h2>바로 접속 링크 · 설정 필요</h2>
          <p className="tiny">Supabase SQL Editor에서 <code>supabase/migrations/0005_access_links.sql</code>을 한 번 실행하면 계정별 바로 접속 링크를 만들 수 있습니다.</p>
        </section>
      )}

      <section className="box">
        <h2>계정 목록 <small>{accounts.length}개</small></h2>
        <div className="acctList">
          {accounts.map((a) => <AccountRow key={a.id} a={a} self={a.id === selfId} busy={busy} run={run} links={links === null ? null : links.filter((l) => l.profileId === a.id)} />)}
          {!accounts.length && <p className="tiny">계정이 없습니다.</p>}
        </div>
      </section>
    </div>
  );
}

function AccountRow({ a, self, busy, run, links }: { a: Account; self: boolean; busy: string | null; run: Run; links: AccessLink[] | null }) {
  const [roles, setRolesDraft] = useState<string[]>(a.roles);
  const [pw, setPw] = useState("");
  const [name, setName] = useState(a.displayName);
  const [loginId, setLoginId] = useState(a.loginId);
  const [confirmDel, setConfirmDel] = useState(false);
  const [linkLabel, setLinkLabel] = useState("");
  const [expiry, setExpiry] = useState(EXPIRY[0].key);
  const [minted, setMinted] = useState<string | null>(null);
  const [landing, setLanding] = useState("");
  const [copied, setCopied] = useState(false);
  const dirty = roles.slice().sort().join() !== a.roles.slice().sort().join();
  const k = (s: string) => `${s}:${a.id}`;
  const live = (links ?? []).filter((l) => !l.revokedAt && new Date(l.expiresAt).getTime() > Date.now());
  const dead = (links ?? []).filter((l) => l.revokedAt || new Date(l.expiresAt).getTime() <= Date.now());
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt("링크를 복사하세요", t); } };
  const share = async (t: string) => { if (navigator.share) { try { await navigator.share({ title: `FALLing in Love 운영앱 · ${a.loginId}`, text: `${a.loginId} 계정 바로 접속 링크`, url: t }); return; } catch { /* cancelled */ } } copy(t); };

  return (
    <article className={`acct ${self ? "self" : ""}`}>
      <header>
        <div><b>{a.loginId}</b>{self && <span className="tag in">나</span>}<small>{a.lastSignIn ? `마지막 로그인 ${fmt(a.lastSignIn)}` : "아직 로그인 안 함"}</small></div>
      </header>
      <div className="acctRow">
        <label className="grow">아이디<input value={loginId} onChange={(e) => setLoginId(e.target.value)} autoCapitalize="none" /></label>
        <button className="btn ghost small" disabled={busy !== null || loginId.trim().toLowerCase() === a.loginId} onClick={() => run(k("id"), () => renameLoginId(a.id, loginId), "아이디를 바꿨습니다. 해당 계정은 새 아이디로 로그인합니다.")}>아이디 변경</button>
      </div>
      <div className="acctRow">
        <label className="grow">이름<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <button className="btn ghost small" disabled={busy !== null || name === a.displayName} onClick={() => run(k("name"), () => renameAccount(a.id, name), "이름을 바꿨습니다.")}>이름 저장</button>
      </div>
      <div className="acctRow">
        <fieldset className="grow"><legend>권한</legend>{ROLES.map((r) => <label key={r} className="chk"><input type="checkbox" checked={roles.includes(r)} disabled={self && r === "admin"} onChange={() => setRolesDraft(roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r])} />{ROLE_LABEL[r].split(" (")[0]}</label>)}</fieldset>
        <button className="btn gold small" disabled={busy !== null || !dirty} onClick={() => run(k("roles"), () => setRoles(a.id, roles), "권한을 저장했습니다. 해당 계정은 다시 로그인하면 반영됩니다.")}>{busy === k("roles") ? "저장 중…" : "권한 저장"}</button>
      </div>
      <div className="acctRow">
        <label className="grow">새 비밀번호 <small>8자 이상</small><input type="text" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></label>
        <button className="btn ghost small" disabled={busy !== null || pw.length < 8} onClick={() => run(k("pw"), () => resetPassword(a.id, pw), "비밀번호를 바꿨습니다.").then(() => setPw(""))}>비밀번호 변경</button>
      </div>

      {links !== null && (
        <div className="linkBox">
          <div className="linkHead"><b>바로 접속 링크</b><small>링크를 열면 이 계정으로 바로 로그인됩니다. 로그인과 같은 효력이니 유출되면 즉시 무효화하세요.</small></div>
          <div className="acctRow">
            <label className="grow">메모 <small>선택</small><input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="예: 주차팀 김OO 폰" /></label>
            <label>첫 화면<select value={landing} onChange={(e) => setLanding(e.target.value)}>{LANDING.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select></label>
            <label>유효 기간<select value={expiry} onChange={(e) => setExpiry(e.target.value)}>{EXPIRY.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select></label>
            <button className="btn gold small" disabled={busy !== null} onClick={() => run(k("mint"), async () => { const r = await createAccessLink(a.id, linkLabel, EXPIRY.find((x) => x.key === expiry)!.at().toISOString()); setMinted(landing ? `${r.url}?station=${landing}` : r.url); setLinkLabel(""); }, "링크를 만들었습니다. 지금 복사해 전달하세요 — 이 화면을 떠나면 다시 볼 수 없습니다.")}>{busy === k("mint") ? "만드는 중…" : "링크 만들기"}</button>
          </div>
          {minted && (
            <div className="minted">
              <code>{minted}</code>
              <div className="acctRow">
                <button className="btn gold small" onClick={() => share(minted)}>공유</button>
                <button className="btn ghost small" onClick={() => copy(minted)}>{copied ? "복사됨" : "복사"}</button>
                <button className="btn ghost small" onClick={() => setMinted(null)}>닫기</button>
              </div>
            </div>
          )}
          {live.length > 0 && (
            <ul className="linkList">
              {live.map((l) => (
                <li key={l.id}>
                  <span><b>{l.label || "메모 없음"}</b><small>만든 날 {fmt(l.createdAt)} · 만료 {fmt(l.expiresAt)} · 사용 {l.useCount}회{l.lastUsedAt ? ` (최근 ${fmt(l.lastUsedAt)})` : ""}</small></span>
                  <button className="btn small del" disabled={busy !== null} onClick={() => run(k("rev" + l.id), () => revokeAccessLink(l.id), "링크를 무효화했습니다.")}>무효화</button>
                </li>
              ))}
            </ul>
          )}
          {dead.length > 0 && (
            <ul className="linkList dead">
              {dead.map((l) => (
                <li key={l.id}>
                  <span><b>{l.label || "메모 없음"}</b><small>{l.revokedAt ? `무효화 ${fmt(l.revokedAt)}` : `만료 ${fmt(l.expiresAt)}`} · 사용 {l.useCount}회</small></span>
                  <button className="btn ghost small" disabled={busy !== null} onClick={() => run(k("delL" + l.id), () => deleteAccessLink(l.id), "기록을 지웠습니다.")}>기록 삭제</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!self && (
        <div className="acctRow danger">
          {confirmDel ? (
            <>
              <span className="tiny warn">정말 삭제할까요? 이 계정으로는 더 이상 로그인할 수 없고, 바로 접속 링크도 함께 사라집니다.</span>
              <button className="btn small del" disabled={busy !== null} onClick={() => run(k("del"), () => deleteAccount(a.id), "계정을 삭제했습니다.")}>삭제 확정</button>
              <button className="btn ghost small" onClick={() => setConfirmDel(false)}>취소</button>
            </>
          ) : <button className="btn ghost small" disabled={busy !== null} onClick={() => setConfirmDel(true)}>계정 삭제</button>}
        </div>
      )}
    </article>
  );
}
