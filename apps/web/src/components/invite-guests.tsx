"use client";

import { useState } from "react";

export type GuestInvite = { name: string; url: string; message: string };

/**
 * On the host's pass: one "send" button per companion. Each opens the phone's share sheet with a
 * personal link (/pass/<token>?g=<position>) that shows "○○ 님을 위한 Matinée Pass", plus a short
 * pre-written message. Without a share sheet the message + link go to the clipboard.
 */
export function InviteGuests({ guests }: { guests: GuestInvite[] }) {
  const [note, setNote] = useState<string | null>(null);
  const say = (t: string) => { setNote(t); setTimeout(() => setNote(null), 2600); };

  async function copy(g: GuestInvite, withMessage: boolean) {
    const text = withMessage ? `${g.message}\n${g.url}` : g.url;
    try { await navigator.clipboard.writeText(text); say(`${g.name} 님 초대장 ${withMessage ? "메시지와 링크를" : "링크를"} 복사했습니다.`); }
    catch { window.prompt(`${g.name} 님 초대장 링크`, g.url); }
  }
  async function send(g: GuestInvite) {
    if (navigator.share) {
      try { await navigator.share({ title: `${g.name} 님을 위한 초대장 · FALLing in Love`, text: g.message, url: g.url }); return; }
      catch { return; }   // cancelled by the user
    }
    copy(g, true);
  }

  return (
    <section className="inviteGuests" aria-labelledby="invite-guests-title">
      <h2 id="invite-guests-title">함께 오시는 분께 초대장 보내기</h2>
      <p>한 분씩 그분의 이름이 적힌 초대장 링크를 보낼 수 있습니다. 받으신 분은 이 화면 대신 자기 이름의 Pass를 보게 되고, 같은 QR로 일행과 함께 확인됩니다.</p>
      <ul>
        {guests.map((g) => (
          <li key={g.url}>
            <b>{g.name} 님</b>
            <span>
              <button type="button" onClick={() => send(g)}>초대장 보내기</button>
              <button type="button" className="ghost" onClick={() => copy(g, false)}>링크 복사</button>
            </span>
          </li>
        ))}
      </ul>
      {note && <p className="inviteNote" role="status">{note}</p>}
    </section>
  );
}
