#!/bin/bash
# Encode dives + connectors for scrubbing (native res, crf 20, GOP 8, faststart, no audio) into the web app,
# then refresh the manifest the scene config reads.
. "$(dirname "$0")/common-video.sh"
OUT="$P/../apps/web/public/media/clips"; mkdir -p "$OUT"
enc() { ffmpeg -v error -y -i "$1" -an -vf "unsharp=5:5:0.8:5:5:0.0" -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart "$2" && log "enc $(basename "$2") $(du -h "$2" | cut -f1)"; }
for n in $NAMES; do [ -s "$W/dive_$n.mp4" ] && enc "$W/dive_$n.mp4" "$OUT/$n.mp4"; done
i=0; prev=""; for n in $NAMES; do if [ -n "$prev" ]; then i=$((i+1)); [ -s "$W/conn_$i.mp4" ] && enc "$W/conn_$i.mp4" "$OUT/conn$i.mp4"; fi; prev="$n"; done
node "$P/scripts/manifest.mjs"
