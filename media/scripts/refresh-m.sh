#!/bin/bash
# Re-encode + re-extract frames for SPECIFIC mobile clips after a partial re-render, then refresh
# the manifest. Usage: media/scripts/refresh-m.sh landing conn2 chamber ...   (scene ids or connN)
# Same settings as 04-encode.sh (MOBILE) and 05-frames-m.sh; run those for a full chain.
export MOBILE=1 TIER="${TIER:-final}"
. "$(dirname "$0")/common-video.sh"
OUT="$P/../apps/web/public/media/clips"; FR="$P/../apps/web/public/media/frames"
FPS="${FPS:-15}"; WIDTH="${WIDTH:-720}"; Q="${Q:-60}"
VF="scale=720:-2,unsharp=5:5:0.8:5:5:0.0"; GOP=4; CRF=26; RATE="-maxrate 2600k -bufsize 5200k"
for id in "$@"; do
  case "$id" in conn[0-9]*) src="$W/conn_${id#conn}.mp4" ;; *) src="$W/dive_$id.mp4" ;; esac
  [ -s "$src" ] || { log "refresh $id: missing $src"; continue; }
  ffmpeg -v error -y -i "$src" -an -vf "$VF" -c:v libx264 -preset slow -crf $CRF $RATE -pix_fmt yuv420p \
    -g $GOP -keyint_min $GOP -sc_threshold 0 -movflags +faststart "$OUT/$id-m.mp4" && log "enc $id-m.mp4 $(du -h "$OUT/$id-m.mp4" | cut -f1)"
  rm -rf "$FR/$id"; mkdir -p "$FR/$id"; tmp=$(mktemp -d)
  ffmpeg -v error -y -i "$src" -vf "fps=$FPS,scale=$WIDTH:-2,unsharp=5:5:0.6:5:5:0.0" -start_number 0 "$tmp/f%03d.png"
  python3 - "$tmp" "$FR/$id" "$Q" <<'PY'
import sys, glob, os
from PIL import Image
src, dst, q = sys.argv[1], sys.argv[2], int(sys.argv[3])
for f in sorted(glob.glob(os.path.join(src, "f*.png"))):
    Image.open(f).convert("RGB").save(os.path.join(dst, os.path.basename(f)[:-4] + ".webp"), "WEBP", quality=q, method=4)
PY
  rm -rf "$tmp"; log "frames $id: $(ls "$FR/$id" | wc -l | tr -d ' ') files, $(du -sh "$FR/$id" | cut -f1)"
done
node "$P/scripts/manifest.mjs" >/dev/null && log "manifest refreshed"
