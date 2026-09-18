# Public experience

## Structure
1. Overture — static hero (anchor overview), title lockup, date, CTA
2. Invitation — one paragraph
3. The world — eight scroll-scrubbed scenes (engine-owned): Opening Track · Landing · Ascent · Garden · Trail · Chamber Concert · Finale · One More Song (added 2026-09-18 at the user's request: a post-event evening vignette — smartphone player with the day's tracks, photo slideshow and the next invitation; the separate /one-more-song page remains the real post-event experience)
4. Standard web content — ACT I (worship), THE TUNING, "그 곡, 사실은" cards, 하루의 리듬 (the only place with clock times), practical info, ONE MORE SONG teaser, footer, sticky 좌석 예약
5. `/apply` → `/pass/[token]`

Decisions: 04 Garden and 07 Finale share the fountain terrace — 04 emphasises conversation, coffee and finger food, 07 the jazz busking, then pulls out to the whole campus. 7 scenes are canonical; the v3 brief's PRELUDE/ACT structure lives in section 4; event 12:00–16:00; no song-request field.

## Scene config
`apps/web/src/config/scenes.ts` — id, label, copy, accent, camera, `scroll`/`linger` pacing, poster paths. `media-manifest.json` adds clips when they exist. Replace final media by file name only.

## Motion and access
- Reduced motion: the engine never loads clips; posters cross-dissolve.
- Posters paint first; clips are fetched lazily near the viewport as blobs.
- Mobile: native 9:16 chain (approved) → `clipMobile`/`stillMobile`.
- Keyboard: route dots and nav are buttons; all copy is real text.

## Campus fidelity
See `CAMPUS_SPATIAL_REFERENCE.md`. The campus map wins over any photo or render.
