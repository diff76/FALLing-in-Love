"use client";

import { useEffect, useState } from "react";
import { issuePassLink, loadPassInfo, setPassLinkRevoked, type MintedPass, type PassInfo } from "../pass-actions";

const fmt = (t: string) => new Date(t).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * Admin: this sign-up's Matinée Pass — what its holder sees, the live and cut links, and a new link
 * (shown once, with a QR the person at the desk can scan and the companions' invitation links).
 */
export function PassPanel({ reservationId }: { reservationId: string }) {
  const [info, setInfo] = useState<PassInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [revokeOthers, setRevokeOthers] = useState(false);
  const [minted, setMinted] = useState<MintedPass | null>(null);
  const [ask, setAsk] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const reload = async () => { const r = await loadPassInfo(reservationId); if (r.ok) setInfo(r.data); else setErr(r.error); };
  useEffect(() => { reload(); }, [reservationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(key); setErr(null);
    const r = await fn();
    if (!r.ok) setErr(r.error ?? "처리하지 못했습니다.");
    await reload(); setBusy(null); setAsk(null);
  };
  const issue = () => run("issue", async () => {
    const r = await issuePassLink(reservationId, revokeOthers);
    if (r.ok) { setMinted(r.data); setRevokeOthers(false); }
    return r;
  });
  const copy = async (key: string, t: string) => {
    try { await navigator.clipboard.writeText(t); setCopied(key); setTimeout(() => setCopied(null), 2000); } catch { window.prompt("복사하세요", t); }
  };
  const share = async (key: string, title: string, text: string, url: string) => {
    if (navigator.share) { try { await navigator.share({ title, text, url }); return; } catch { return; } }
    copy(key, text);
  };

  const live = info?.links.filter((l) => !l.revokedAt) ?? [];
  const cut = info?.links.filter((l) => l.revokedAt) ?? [];
  const v = info?.view;
  const shuttle = v ? (v.transport === "shuttle" ? `${v.outbound_label ?? "미정"} 출발` : v.transport === "car" ? `자차${v.vehicle_plate ? ` · ${v.vehicle_plate}` : ""}` : "개별 이동") : "";

  return (
    <section className="box passPanel" id="pass">
      <h2>Matinée Pass <small>{info ? `열리는 링크 ${live.length}개` : "불러오는 중…"}</small></h2>

      {v ? (
        <dl className="passView">
          <div><dt>티켓</dt><dd className="mono">{v.code}</dd></div>
          <div><dt>이름</dt><dd>{v.applicant_name} 님{v.guest_count > 0 ? ` 외 ${v.guest_count}인` : ""}</dd></div>
          <div><dt>좌석</dt><dd>{v.seat_label ?? "체크인 시 배정"}</dd></div>
          <div><dt>셔틀</dt><dd>{shuttle}</dd></div>
          <div><dt>복귀</dt><dd>{v.return_label ? `${v.return_label} 신청` : "신청 안 함"}</dd></div>
          <div><dt>체크인</dt><dd>{v.checked_in ? <b className="ok">완료</b> : "전"}</dd></div>
        </dl>
      ) : info && <p className="stationNote">지금 열리는 Pass 링크가 없습니다. 아래에서 새 링크를 만들어 보내 주세요.</p>}

      {live.length > 0 && (
        <ul className="linkList">
          {live.map((l, i) => (
            <li key={l.id}>
              <span><b>링크 {live.length - i}{i === 0 ? " · 최근" : ""}</b><small>발급 {fmt(l.issuedAt)} · 이 링크와 이 링크로 보낸 초대장이 열립니다</small></span>
              {ask === l.id ? (
                <span className="rowAct confirm">
                  <em>{live.length === 1 ? "마지막 링크입니다. 끊으면 신청자가 Pass를 열 수 없습니다." : "이 링크와 초대장이 더 이상 열리지 않습니다."}</em>
                  <button className="miniBtn del" disabled={busy !== null} onClick={() => run(l.id, () => setPassLinkRevoked(l.id, true))}>끊기 확정</button>
                  <button className="miniBtn" onClick={() => setAsk(null)}>아니오</button>
                </span>
              ) : <button className="miniBtn" disabled={busy !== null} onClick={() => setAsk(l.id)}>링크 끊기</button>}
            </li>
          ))}
        </ul>
      )}
      {cut.length > 0 && (
        <ul className="linkList dead">
          {cut.map((l) => (
            <li key={l.id}>
              <span><b>끊은 링크</b><small>발급 {fmt(l.issuedAt)} · 끊음 {fmt(l.revokedAt!)}</small></span>
              <button className="miniBtn" disabled={busy !== null} onClick={() => run(l.id, () => setPassLinkRevoked(l.id, false))}>{busy === l.id ? "…" : "되살리기"}</button>
            </li>
          ))}
        </ul>
      )}

      <div className="linkBox">
        <div className="linkHead"><b>새 Pass 링크</b><small>보안을 위해 링크 주소는 저장하지 않아(암호화된 값만 보관) 기존 링크 주소는 다시 볼 수 없습니다. 링크를 잃어버렸다면 새로 만들어 보내 주세요. 새 링크는 지금 한 번만 보입니다.</small></div>
        <label className="chk"><input type="checkbox" checked={revokeOthers} onChange={(e) => setRevokeOthers(e.target.checked)} /> 기존 링크는 모두 끊기 <small>(링크가 다른 사람에게 잘못 전달된 경우)</small></label>
        <div className="resActions">
          <button className="btn gold small" disabled={busy !== null || !info} onClick={issue}>{busy === "issue" ? "만드는 중…" : "새 Pass 링크 만들기"}</button>
        </div>
        {!revokeOthers && live.length > 0 && <p className="tiny">기존 링크를 끊지 않으면 예전 Pass와 이미 보낸 초대장도 그대로 열립니다.</p>}
      </div>

      {minted && (
        <div className="minted passMinted">
          <div className="passQr" dangerouslySetInnerHTML={{ __html: minted.qrSvg }} aria-label="Pass QR" />
          <div className="passLinks">
            <b>신청자 Pass</b>
            <code>{minted.url}</code>
            <div className="resActions">
              <button className="btn gold small" onClick={() => share("p", "Matinée Pass · FALLing in Love", minted.message, minted.url)}>공유</button>
              <button className="btn ghost small" onClick={() => copy("p", minted.message)}>{copied === "p" ? "복사됨" : "메시지 복사"}</button>
              <button className="btn ghost small" onClick={() => copy("pu", minted.url)}>{copied === "pu" ? "복사됨" : "링크만 복사"}</button>
              <a className="btn ghost small" href={minted.url} target="_blank" rel="noreferrer">Pass 열기</a>
            </div>
            {minted.invites.length > 0 && <>
              <b>함께 오시는 분 초대장</b>
              {minted.invites.map((g, i) => (
                <div className="inviteRow" key={g.url}>
                  <span>{g.name} 님</span>
                  <button className="miniBtn" onClick={() => share(`g${i}`, `${g.name} 님을 위한 초대장 · FALLing in Love`, g.message, g.url)}>공유</button>
                  <button className="miniBtn" onClick={() => copy(`g${i}`, g.message)}>{copied === `g${i}` ? "복사됨" : "메시지 복사"}</button>
                </div>
              ))}
            </>}
            <p className="tiny">현장에서는 신청자가 이 QR을 휴대폰 카메라로 찍으면 Pass가 바로 열립니다. 이 화면을 떠나면 링크를 다시 볼 수 없습니다.</p>
            <button className="btn ghost small" onClick={() => setMinted(null)}>닫기</button>
          </div>
        </div>
      )}
      {err && <p className="tiny warn" role="status">{err}</p>}
    </section>
  );
}
