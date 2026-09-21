#!/bin/bash
# Encode dives + connectors for scrubbing (native res, crf 20, GOP 8, faststart, no audio) into the web app,
# then refresh the manifest the scene config reads.
. "$(dirname "$0")/common-video.sh"
OUT="$P/../apps/web/public/media/clips"; mkdir -p "$OUT"
# Mobile (§6b): 720 wide, GOP 4 (phone seek cost scales with frames-from-keyframe), crf 23.
if [ "$MOBILE" = "1" ]; then SFX="-m"; VF="scale=720:-2,unsharp=5:5:0.8:5:5:0.0"; GOP=4; CRF=23
else SFX=""; VF="unsharp=5:5:0.8:5:5:0.0"; GOP=8; CRF=20; fi
enc() { ffmpeg -v error -y -i "$1" -an -vf "$VF" -c:v libx264 -preset slow -crf $CRF -pix_fmt yuv420p \
  -g $GOP -keyint_min $GOP -sc_threshold 0 -movflags +faststart "$2" && log "enc $(basename "$2") $(du -h "$2" | cut -f1)"; }
for n in $NAMES; do [ -s "$W/dive_$n.mp4" ] && enc "$W/dive_$n.mp4" "$OUT/$n$SFX.mp4"; done
i=0; prev=""; for n in $NAMES; do if [ -n "$prev" ]; then i=$((i+1)); [ -s "$W/conn_$i.mp4" ] && enc "$W/conn_$i.mp4" "$OUT/conn$i$SFX.mp4"; fi; prev="$n"; done
# conn7 direction guard: the finale→phone connector must START on the campus aerial (it is
# rendered phone→campus and time-reversed). If frame 0 is the living room, reverse it here.
if [ -s "$W/conn_7.mp4" ]; then
  ffmpeg -v error -y -ss 0 -i "$W/conn_7.mp4" -frames:v 1 -q:v 2 "$W/_c7_first.png"
  python3 - "$W/_c7_first.png" "$W/first_one-more-song.png" <<'PY2'
import sys; from PIL import Image, ImageChops; import math
a,b=[Image.open(p).convert("L").resize((320,180)) for p in sys.argv[1:3]]
d=ImageChops.difference(a,b); mse=sum(v*v*c for v,c in enumerate(d.histogram()))/(320*180)
sys.exit(0 if (99 if mse==0 else 10*math.log10(255**2/mse)) < 18 else 3)   # exit 3 = looks like the living room
PY2
  if [ $? -eq 3 ]; then log "conn 7 starts on the living room — reversing"; ffmpeg -v error -y -i "$W/conn_7.mp4" -vf reverse -an "$W/_c7r.mp4" && mv "$W/_c7r.mp4" "$W/conn_7.mp4"; enc "$W/conn_7.mp4" "$OUT/conn7$SFX.mp4"; fi
fi
node "$P/scripts/manifest.mjs"
