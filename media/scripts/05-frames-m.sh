#!/bin/bash
# Mobile frame sequences: phones scrub IMAGES, not video (iOS WebKit suspends/limits
# video decoders and never paints seeks on unplayed elements — see docs/MEDIA_PIPELINE.md).
# Extracts every portrait dive/connector from work/<tier>-m into
# apps/web/public/media/frames/<id>/fNNN.webp at FPS, WIDTH px wide. Run after 03-connectors.
. "$(dirname "$0")/common-video.sh"
SRC="$P/work/${TIER:-final}-m"; OUT="$P/../apps/web/public/media/frames"; FPS="${FPS:-10}"; WIDTH="${WIDTH:-540}"; Q="${Q:-62}"
ext() { local id="$1" in="$2"; [ -s "$in" ] || return 0
  rm -rf "$OUT/$id"; mkdir -p "$OUT/$id"; local tmp; tmp=$(mktemp -d)
  # ffmpeg here has no libwebp: dump PNGs, then Pillow writes the WebPs.
  ffmpeg -v error -y -i "$in" -vf "fps=$FPS,scale=$WIDTH:-2,unsharp=5:5:0.6:5:5:0.0" -start_number 0 "$tmp/f%03d.png"
  python3 - "$tmp" "$OUT/$id" "$Q" <<'PY'
import sys, glob, os
from PIL import Image
src, dst, q = sys.argv[1], sys.argv[2], int(sys.argv[3])
for f in sorted(glob.glob(os.path.join(src, "f*.png"))):
    Image.open(f).convert("RGB").save(os.path.join(dst, os.path.basename(f)[:-4] + ".webp"), "WEBP", quality=q, method=4)
PY
  rm -rf "$tmp"
  log "frames $id: $(ls "$OUT/$id" | wc -l | tr -d ' ') files, $(du -sh "$OUT/$id" | cut -f1)"; }
for n in $NAMES; do ext "$n" "$SRC/dive_$n.mp4"; done
i=0; prev=""; for n in $NAMES; do if [ -n "$prev" ]; then i=$((i+1)); ext "conn$i" "$SRC/conn_$i.mp4"; fi; prev="$n"; done
echo "{\"fps\": $FPS, \"width\": $WIDTH}" > "$OUT/frames.json"
node "$P/scripts/manifest.mjs" >/dev/null && log "manifest refreshed"
