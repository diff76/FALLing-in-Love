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


Inpainting (2026-09-16): for placement fixes, `gpt_image_2` accepts `--is_inpaint true --mask '{"id":"<upload id>"}'` with the base image as `--image <upload id>`; upload both with `higgsfield upload create <file>`. The mask is a white polygon on black (see `media/work/stills/mask_fountain.png`). Far more reliable than describing positions in words.


## Previz chain — done 2026-09-16
- 7 dives (8 s) + 6 connectors (5 s) on `seedance_2_0_mini` 720p, scripts `02-dives.sh` → `03-connectors.sh` → `04-encode.sh`; clips in `apps/web/public/media/clips`, manifest regenerated; posters set from the dives' first frames (`POSTER_SOURCE=previz python3 media/scripts/posters.py`).
- Verified in the browser: clips load as blobs, `seekable` = full duration, `currentTime` follows scroll, connectors crossfade.
- Cost observed: mini dive ≈ 20 credits, mini connector ≈ 15; **standard 1080p dive ≈ 72 credits** (measured), connector est. ≈ 45.

### Frame-lock findings (important)
- `--start-image` on Higgsfield Seedance is NOT pixel-locked for our rendered stills: mini gave 12–14 dB vs the still (re-interpreted scenes, e.g. a pitched-roof church); a 16:9 canvas did not help (13.9 dB). Standard 1080p gave 19.6 dB with the SAME composition (faithful re-render, slight zoom).
- Connector seams (video frame → video frame) read 20–26 dB start / 17–23 dB end — consistent with the skill's "judge by composition" guidance.
- Consequence: the scene poster must be each dive's actual first frame (never the still), and the final chain must run on the standard tier so the approved content survives. Budget for the final: ≈ 7×72 + 6×45 ≈ 775 credits desktop, ≈ 1,550 with the 9:16 mobile chain, before re-rolls.
