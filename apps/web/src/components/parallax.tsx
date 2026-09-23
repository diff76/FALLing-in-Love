"use client";

import { useEffect } from "react";

/**
 * Continuous scroll motion for the standard sections: each `.band` / `.invitation` gets a CSS
 * variable `--vp` (-1 → 1 as it crosses the viewport). The stylesheet turns that into a slow
 * counter-drift of the copy and a faster drift of the background orbs, so the page keeps
 * moving as long as the reader scrolls. Reduced motion: variables stay at 0.
 */
export function Parallax() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bands = Array.from(document.querySelectorAll<HTMLElement>(".band, .invitation"));
    let ticking = false;
    const update = () => {
      ticking = false;
      const vh = window.innerHeight;
      bands.forEach((b) => {
        const r = b.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) return;
        const center = r.top + r.height / 2;
        b.style.setProperty("--vp", Math.max(-1, Math.min(1, (center - vh / 2) / vh)).toFixed(3));
      });
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, []);
  return null;
}
