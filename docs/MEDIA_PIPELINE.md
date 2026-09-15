# Media pipeline (scroll-world, architecture B, refined sepia clay)

Approved: engine = scroll-world v0.8.0 (vendored), camera = World Flythrough (dive + connector), art = matte clay diorama in a vivid-but-soft pastel palette (user revised 2026-09-04: no sepia; lovely, cheerful, close to the scroll-world demo look), faceless figures, mobile = native 9:16 chain, biller = Higgsfield credits (`gpt_image_2` stills, `seedance_2_0_mini` previz → `seedance_2_0` final).

Order of work
1. Anchor overview regenerated on Higgsfield (`media/anchor/`). Current: `anchor-v5a.png` (pastel palette; easel gallery up the stair; trail with photo-zone arch, stamp table, easels, X-banners, balloons, bunting; no monument stone; alternatives `anchor-v5b.png`, `anchor-v4-*.png`; terrain as natural hill above the terrace, S-curve sleeper stair from the car park to the chapel–main-building gap, chapel forward of the main building). `anchor-v5.txt` holds the corrected site description; reuse it verbatim in every still.
2. Seven scene stills — DONE 2026-09-04 via `media/scripts/01-stills.sh` → `media/work/stills/still_<scene>.png` (git-ignored, ~5 MB each; 8 gens ≈ 68 credits). They are now the scene posters (`posters.py` prefers a still over a photo plate). 2026-09-15: opening-track, landing and chamber re-rendered from the new photos (Changdong pilotis tent lounge + festive tour bus; main gate at the side end of the paver strip; real chapel hall: concrete walls, organ, green cross, red seat blocks, stained glass). Earlier versions kept as `still_*_v1.png` / `_v2_*.png`. Known limits: from the roof-lifted angle the rear balcony reads on the side wall; seat red came out maroon.
3. Previz chain on `seedance_2_0_mini` (7 dives + 6 connectors, 16:9) → approve journey and seams.
4. Final 1080p chain, then the 9:16 chain from portrait canvases.
5. Encode (`crf 20 -g 8`, mobile `720w -g 4`) into `apps/web/public/media/clips`, run `npm run media:manifest`.

Budget (observed 2026-09-03): still ≈ 8.5 credits. Videos per skill notes ≈ 40–55 (standard) / ~¼ (mini).
Stills script rule (2026-09-16): references come only from each prompt's `refs:` line, in order — never an implicit anchor — so "the first reference image" in a prompt means the first file listed.
Every leg: eyeball the handoff frame before the next; re-roll NSFW false positives with "empty, architectural" wording; never mix chain models.
