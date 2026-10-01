"use client";

import { useEffect, useState } from "react";

/** Photo grid with a simple lightbox (tap to open, arrows / swipe-free buttons, Esc to close). */
export function OmsGallery({ photos }: { photos: { key: string; url: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % photos.length));
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i - 1 + photos.length) % photos.length));
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [open, photos.length]);
  if (!photos.length) return null;
  return (
    <>
      <div className="omsGallery">
        {photos.map((p, i) => (
          <button key={p.key} type="button" onClick={() => setOpen(i)} aria-label={`사진 ${i + 1} 크게 보기`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" loading="lazy" decoding="async" />
          </button>
        ))}
      </div>
      {open !== null && (
        <div className="omsLightbox" role="dialog" aria-modal="true" onClick={() => setOpen(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[open].url} alt="" onClick={(e) => e.stopPropagation()} />
          <button type="button" className="lbPrev" onClick={(e) => { e.stopPropagation(); setOpen((open - 1 + photos.length) % photos.length); }} aria-label="이전 사진">‹</button>
          <button type="button" className="lbNext" onClick={(e) => { e.stopPropagation(); setOpen((open + 1) % photos.length); }} aria-label="다음 사진">›</button>
          <button type="button" className="lbClose" onClick={() => setOpen(null)} aria-label="닫기">×</button>
          <span className="lbCount">{open + 1} / {photos.length}</span>
        </div>
      )}
    </>
  );
}
