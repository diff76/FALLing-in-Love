#!/bin/bash
# Architecture B, step 1: one dive clip per scene, starting from the approved still. Parallel.
. "$(dirname "$0")/common-video.sh"
gen_dive() { local n="$1" out="$W/dive_$1" try=1
  if [ -s "$out.mp4" ]; then log "dive $n present — skip"; return 0; fi
  while [ $try -le 3 ]; do
    log "dive $n attempt $try"
    higgsfield generate create "$VMODEL" --prompt "$(prompt_for "dive_$n")" --start-image "$(still_for "$n")" \
      $VOPTS --aspect_ratio "$ASPECT" --duration "$DIVE_DUR" --wait --wait-timeout 20m --json > "$out.json" 2> "$out.err" < /dev/null
    local url; url=$(jq -r '.[0].result_url // empty' "$out.json" 2>/dev/null)
    if [ -n "$url" ] && curl -fsSL "$url" -o "$out.mp4"; then log "dive $n ok"; return 0; fi
    log "dive $n attempt $try failed: $(head -c 160 "$out.err")"; try=$((try+1)); sleep 15
  done; log "dive $n FAILED"; return 1; }
log "=== dives $VMODEL ($TIER) ==="
for n in ${NAMES_OVERRIDE:-$NAMES}; do gen_dive "$n" & sleep 3; done; wait
for n in $NAMES; do [ -s "$W/dive_$n.mp4" ] || continue
  ffmpeg -v error -y -ss 0 -i "$W/dive_$n.mp4" -frames:v 1 -q:v 2 "$W/first_$n.png"
  ffmpeg -v error -y -sseof -0.15 -i "$W/dive_$n.mp4" -frames:v 1 -q:v 2 "$W/last_$n.png"
done
log "=== dives done: $(ls "$W"/dive_*.mp4 2>/dev/null | wc -l | tr -d ' ') ==="
