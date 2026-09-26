"use client";

import { useState } from "react";
import type { StaffRole } from "@fil/domain";
import { createAccount, deleteAccount, listAccounts, renameAccount, resetPassword, setRoles, type Account } from "./actions";

const ROLE_LABEL: Record<StaffRole, string> = { staff: "스태프 (스캔·체크인, 주차)", desk: "데스크 (상황판, 디스플레이, 주차)", admin: "관리자 (전체 + 계정)" };
const ROLES: StaffRole[] = ["staff", "desk", "admin"];

export function AccountsConsole({ initial, selfId }: { initial: Account[]; selfId: string }) {
  const [accounts, setAccounts] = useState<Account[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [draft, setDraft] = useState({ email: "", displayName: "", password: "", roles: ["staff"] as string[] });

  const run = async (key: string, fn: () => Promise<void>, ok: string) => {
    setBusy(key); setMsg(null);
    try { await fn(); setAccounts(await listAccounts()); setMsg({ kind: "ok", text: ok }); }
    catch (e) { setMsg({ kind: "err", text: (e as Error).message }); }
    finally { setBusy(null); }
  };
  const toggle = (list: string[], r: string) => (list.includes(r) ? list.filter((x) => x !== r) : [...list, r]);

  return (
    <div className="accounts">
      {msg && <p className={`tiny ${msg.kind === "err" ? "warn" : "okMsg"}`} role="status">{msg.text}</p>}

      <section className="box">
        <h2>새 계정 만들기</h2>
        <p className="tiny">이메일과 비밀번호(8자 이상)를 정해 전달하세요. 로그인 확인 메일은 보내지 않습니다.</p>
        <form className="acctForm" onSubmit={(e) => { e.preventDefault(); run("create", () => createAccount(draft), `${draft.email} 계정을 만들었습니다.`).then(() => setDraft({ email: "", displayName: "", password: "", roles: ["staff"] })); }}>
          <label>이메일<input type="email" required value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} autoComplete="off" /></label>
          <label>이름 <small>선택</small><input value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} autoComplete="off" /></label>
          <label>비밀번호<input type="text" required minLength={8} value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} autoComplete="new-password" /></label>
          <fieldset><legend>권한</legend>{ROLES.map((r) => <label key={r} className="chk"><input type="checkbox" checked={draft.roles.includes(r)} onChange={() => setDraft({ ...draft, roles: toggle(draft.roles, r) })} />{ROLE_LABEL[r]}</label>)}</fieldset>
          <button className="btn gold small" type="submit" disabled={busy !== null}>{busy === "create" ? "만드는 중…" : "계정 만들기"}</button>
        </form>
      </section>

      <section className="box">
        <h2>계정 목록 <small>{accounts.length}개</small></h2>
        <div className="acctList">
          {accounts.map((a) => <AccountRow key={a.id} a={a} self={a.id === selfId} busy={busy} run={run} />)}
          {!accounts.length && <p className="tiny">계정이 없습니다.</p>}
        </div>
      </section>
    </div>
  );
}

function AccountRow({ a, self, busy, run }: { a: Account; self: boolean; busy: string | null; run: (key: string, fn: () => Promise<void>, ok: string) => Promise<void> }) {
  const [roles, setRolesDraft] = useState<string[]>(a.roles);
  const [pw, setPw] = useState("");
  const [name, setName] = useState(a.displayName);
  const [confirmDel, setConfirmDel] = useState(false);
  const dirty = roles.slice().sort().join() !== a.roles.slice().sort().join();
  const k = (s: string) => `${s}:${a.id}`;
  return (
    <article className={`acct ${self ? "self" : ""}`}>
      <header>
        <div><b>{a.email}</b>{self && <span className="tag in">나</span>}<small>{a.lastSignIn ? `마지막 로그인 ${new Date(a.lastSignIn).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : "아직 로그인 안 함"}</small></div>
      </header>
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
      {!self && (
        <div className="acctRow danger">
          {confirmDel ? (
            <>
              <span className="tiny warn">정말 삭제할까요? 이 계정으로는 더 이상 로그인할 수 없습니다.</span>
              <button className="btn small del" disabled={busy !== null} onClick={() => run(k("del"), () => deleteAccount(a.id), "계정을 삭제했습니다.")}>삭제 확정</button>
              <button className="btn ghost small" onClick={() => setConfirmDel(false)}>취소</button>
            </>
          ) : <button className="btn ghost small" disabled={busy !== null} onClick={() => setConfirmDel(true)}>계정 삭제</button>}
        </div>
      )}
    </article>
  );
}
