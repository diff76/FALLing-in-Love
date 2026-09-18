"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Scroll-reveal wrapper. With `group`, the direct children stagger in one after another.
 * Honours prefers-reduced-motion (elements are simply visible). Pure CSS transitions,
 * driven by a single IntersectionObserver; no layout thrash.
 */
export function Reveal({ children, delay = 0, group = false }: { children: ReactNode; delay?: number; group?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const targets = group ? Array.from(el.children) as HTMLElement[] : [el];
    targets.forEach((t, i) => { t.classList.add("rv"); t.style.transitionDelay = `${delay + (group ? i * 110 : 0)}ms`; });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { (group ? targets : [el]).forEach((t) => t.classList.add("rv-in")); io.disconnect(); } });
    }, { threshold: 0.18, rootMargin: "0px 0px -8% 0px" });
    // A group wrapper is `display: contents` (no box), so observe its first child instead.
    io.observe(group && targets[0] ? targets[0] : el);
    return () => io.disconnect();
  }, [delay, group]);
  return <div ref={ref} className={group ? "rvGroup" : "rvWrap"}>{children}</div>;
}
