"use client";

import { useState } from "react";

/**
 * Take the pass with you: copy or share its link (the same URL the QR encodes), or save the
 * ticket as a PNG. On phones the image goes through the share sheet ("이미지 저장"); elsewhere
 * it downloads. The capture is the on-screen ticket, flattened (no tilt) at 2×.
 */
export function PassActions({ url, code }: { url: string; code: string }) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const say = (t: string) => { setNote(t); setTimeout(() => setNote(null), 2600); };

  async function copyLink() {
    try { await navigator.clipboard.writeText(url); say("링크를 복사했습니다. 메시지나 메모에 붙여 넣어 두세요."); }
    catch { window.prompt("이 링크를 복사해 두세요", url); }
  }
  async function shareLink() {
    if (navigator.share) {
      try { await navigator.share({ title: "Matinée Pass · FALLing in Love", text: "FALLing in Love 참여 신청 Pass", url }); return; } catch { /* cancelled */ }
    }
    copyLink();
  }
  async function saveImage() {
    const card = document.querySelector<HTMLElement>(".ticket3d");
    const ticket = card?.querySelector<HTMLElement>(".ticket");
    if (!card || !ticket) return;
    setBusy(true);
    const prevTransform = card.style.transform; card.style.transform = "none"; card.classList.remove("shimmer");
    try {
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(ticket, { pixelRatio: 2, cacheBust: true, backgroundColor: "#F7F1E4" });
      if (!blob) throw new Error("no image");
      const file = new File([blob], `matinee-pass-${code}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: "Matinée Pass" }); return; } catch { /* cancelled → fall through to download */ }
      }
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      say("이미지를 저장했습니다.");
    } catch {
      say("이미지를 만들지 못했습니다. 화면을 캡처해 주세요.");
    } finally { card.style.transform = prevTransform; setBusy(false); }
  }

  return (
    <div className="passActions">
      <button type="button" onClick={saveImage} disabled={busy}>{busy ? "만드는 중…" : "티켓 이미지 저장"}</button>
      <button type="button" onClick={shareLink}>링크 공유</button>
      <button type="button" onClick={copyLink}>링크 복사</button>
      <a href={url} target="_blank" rel="noreferrer">새 창에서 열기</a>
      {note && <p role="status">{note}</p>}
    </div>
  );
}
