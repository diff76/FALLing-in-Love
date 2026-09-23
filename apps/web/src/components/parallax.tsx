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
    const bands = Array.from(document.querySelectorAll<HTMLElement>(".band, .invitation"));
    let ticking = false;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const update = () => {
      ticking = false;
      if (reduce) return;
      const vh = window.innerHeight;
      bands.forEach((b) => {
        const r = b.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) return;
        const center = r.top + r.height / 2;
        b.style.setProperty("--vp", Math.max(-1, Math.min(1, (center - vh / 2) / vh)).toFixed(3));
      });
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    // Ambient animations (orbs, sweep, leaves) only run while a section is near the viewport:
    // off-screen CSS animations still cost GPU time on phones and were starving the film.
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.target.classList.toggle("is-on", e.isIntersecting)), { rootMargin: "20% 0px 20% 0px" });
    bands.forEach((b) => io.observe(b));
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { io.disconnect(); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, []);
  return null;
}
