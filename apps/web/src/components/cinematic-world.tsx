"use client";

import { useEffect, useRef } from "react";
import { connectors, connectorsFramesMobile, connectorsMobile, framesMobile, scenes } from "@/config/scenes";
import type { ScrollWorldConfig } from "@/lib/scroll-world/scrub-engine";

/**
 * Mounts the scroll-scrubbed camera flight. The engine owns only this container:
 * reservation, pass and everything below the world are ordinary React.
 * Without encoded clips the engine shows each scene's poster (a slow push-in), which is
 * the Phase 1 placeholder experience; reduced-motion users always get posters.
 */
/** The engine renders the brand as plain text; restyle it as the title lockup (FALL underlined, "in" italic). */
function dressBrand(host: HTMLElement) {
  const lockup = () => {
    const frag = document.createDocumentFragment();
    const fall = document.createElement("span"); fall.className = "fall"; fall.textContent = "FALL";
    const inEm = document.createElement("em"); inEm.textContent = "in";
    frag.append(fall, document.createTextNode("ing "), inEm, document.createTextNode(" Love"));
    return frag;
  };
  host.querySelectorAll<HTMLElement>(".sw-brand__name").forEach((el) => { el.replaceChildren(lockup()); el.classList.add("lockup"); });
  host.querySelectorAll<HTMLElement>(".sw-copy__title").forEach((el) => {
    if (el.textContent?.trim() === "FALLing in Love") { el.replaceChildren(lockup()); el.classList.add("lockup"); }
  });
}

/**
 * Line-break hygiene for the scene copy (the engine escapes HTML, so we restructure after mount).
 * Titles: each sentence becomes an unbreakable unit — a sentence that does not fit drops to the
 * next line whole ("The Day Is Over." / "The Playlist Isn't.") instead of splitting mid-sentence.
 * Bodies: one sentence per line, and within a sentence each comma-clause is a unit, so wraps
 * land on commas or sentence ends rather than in the middle of a phrase.
 */
function shapeSceneCopy(host: HTMLElement) {
  const unit = (text: string, cls: string) => { const s = document.createElement("span"); s.className = cls; s.textContent = text; return s; };
  host.querySelectorAll<HTMLElement>(".sw-copy__title").forEach((el) => {
    if (el.classList.contains("lockup")) return;
    const sentences = (el.textContent ?? "").split(/(?<=[.!?…])\s+/).filter(Boolean);
    el.replaceChildren(...sentences.flatMap((p, i) => (i ? [document.createTextNode(" "), unit(p, "sent")] : [unit(p, "sent")])));
  });
  host.querySelectorAll<HTMLElement>(".sw-copy__body").forEach((el) => {
    const sentences = (el.textContent ?? "").split(/(?<=[.!?…])\s+/).filter(Boolean);
    const nodes: Node[] = [];
    sentences.forEach((sentence, i) => {
      if (i) nodes.push(document.createElement("br"));
      const clauses = sentence.split(/(?<=[,、，])\s+/).filter(Boolean);
      clauses.forEach((c, j) => { if (j) nodes.push(document.createTextNode(" ")); nodes.push(unit(c, "clause")); });
    });
    el.replaceChildren(...nodes);
  });
}

/**
 * The engine fades each scene's copy block in/out by scroll. On top of that, when a copy block
 * becomes visible its eyebrow → title → body slide up in sequence (and reset when it leaves),
 * so every scene's text "arrives" rather than just appearing. Reduced motion: no slide.
 */
function animateSceneCopy(host: HTMLElement) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const copies = host.querySelectorAll<HTMLElement>(".sw-copy");
  copies.forEach((c) => {
    Array.from(c.children).forEach((child, i) => { (child as HTMLElement).classList.add("swa"); (child as HTMLElement).style.transitionDelay = `${i * 90}ms`; });
  });
  if (reduce) { copies.forEach((c) => c.classList.add("swa-in")); return; }
  let raf = 0;
  const tick = () => {
    copies.forEach((c) => { const on = parseFloat(c.style.opacity || "0") > 0.35; c.classList.toggle("swa-in", on); });
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  window.addEventListener("pagehide", () => cancelAnimationFrame(raf), { once: true });
}

export function CinematicWorld() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    // React dev Strict Mode runs this effect twice (mount → cleanup → mount). The
    // cleanup below cancels a pending mount and empties the container, so the second
    // run rebuilds the world from scratch instead of finding a half-mounted one.
    let cancelled = false;
    import("@/lib/scroll-world/scrub-engine").then(({ mountScrollWorld }) => {
      if (cancelled) return;
      const config: ScrollWorldConfig = {
        brand: { name: "FALLing in Love", href: "#top" },
        cta: { label: "참여 신청", href: "/apply" },
        hint: "스크롤해서 하루를 따라가 보세요",
        nav: true,
        atmosphere: true,
        diveScroll: 1.3,
        connScroll: 0.9,
        crossfade: 0.1,
        sections: scenes.map((s, i) => ({
          id: s.id,
          label: s.label,
          still: s.media.poster,
          stillMobile: s.media.posterMobile,
          clip: s.media.clip ?? undefined,
          clipMobile: s.media.clipMobile ?? undefined,
          framesMobile: framesMobile[s.id] ?? undefined,
          accent: s.accent,
          scroll: s.scroll,
          linger: s.linger,
          eyebrow: s.eyebrow,
          title: s.title,
          body: s.body,
          tags: s.tags,
          cta: i === scenes.length - 1
            ? { primary: { label: "참여 신청하기", href: "/apply" }, secondary: { label: "One More Song 미리 보기", href: "/one-more-song" } }
            : undefined,
        })),
        connectors: connectors.slice(0, scenes.length - 1),
        connectorsMobile: connectorsMobile.slice(0, scenes.length - 1),
        connectorsFramesMobile: connectorsFramesMobile.slice(0, scenes.length - 1),
      };
      mountScrollWorld(host, config);
      dressBrand(host);
      shapeSceneCopy(host);
      animateSceneCopy(host);
    }).catch((error) => console.error("scroll-world failed to mount", error));
    return () => {
      cancelled = true;
      host.replaceChildren();
      host.classList.remove("sw-root", "sw-inactive");
    };
  }, []);
  return <div id="world" ref={ref} aria-label="FALLing in Love 하루 여정" />;
}
