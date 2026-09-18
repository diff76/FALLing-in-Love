"use client";

import { useEffect, useRef } from "react";
import { connectors, connectorsMobile, scenes } from "@/config/scenes";
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

/** One sentence per line in scene bodies (the engine escapes HTML, so we split the text after mount). */
function breakSentences(host: HTMLElement) {
  host.querySelectorAll<HTMLElement>(".sw-copy__body").forEach((el) => {
    const parts = (el.textContent ?? "").split(/(?<=[.!?…])\s+/).filter(Boolean);
    if (parts.length < 2) return;
    el.replaceChildren(...parts.flatMap((p, i) => (i ? [document.createElement("br"), document.createTextNode(p)] : [document.createTextNode(p)])));
  });
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
        cta: { label: "좌석 예약", href: "/apply" },
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
          accent: s.accent,
          scroll: s.scroll,
          linger: s.linger,
          eyebrow: s.eyebrow,
          title: s.title,
          body: s.body,
          tags: s.tags,
          cta: i === scenes.length - 1
            ? { primary: { label: "좌석 예약하기", href: "/apply" }, secondary: { label: "One More Song 미리 보기", href: "/one-more-song" } }
            : undefined,
        })),
        connectors: connectors.slice(0, scenes.length - 1),
        connectorsMobile: connectorsMobile.slice(0, scenes.length - 1),
      };
      mountScrollWorld(host, config);
      dressBrand(host);
      breakSentences(host);
    }).catch((error) => console.error("scroll-world failed to mount", error));
    return () => {
      cancelled = true;
      host.replaceChildren();
      host.classList.remove("sw-root", "sw-inactive");
    };
  }, []);
  return <div id="world" ref={ref} aria-label="FALLing in Love 하루 여정" />;
}
