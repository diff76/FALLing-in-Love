#!/bin/bash
# Architecture B, step 2: connectors between consecutive dives, frame-locked to the RENDERED frames.
. "$(dirname "$0")/common-video.sh"
gen_conn() { local i="$1" s="$2" e="$3" out="$W/conn_$1" try=1
  if [ -s "$out.mp4" ]; then log "conn $i present — skip"; return 0; fi
  while [ $try -le 3 ]; do
    log "conn $i attempt $try ($(basename "$s") -> $(basename "$e"))"
    higgsfield generate create "$VMODEL" --prompt "$(prompt_for "conn_$i")" --start-image "$s" --end-image "$e" \
      $VOPTS --aspect_ratio "$ASPECT" --duration "$CONN_DUR" --wait --wait-timeout 20m --json > "$out.json" 2> "$out.err" < /dev/null
    local url; url=$(jq -r '.[0].result_url // empty' "$out.json" 2>/dev/null)
    if [ -n "$url" ] && curl -fsSL "$url" -o "$out.mp4"; then log "conn $i ok"; return 0; fi
    log "conn $i attempt $try failed: $(head -c 160 "$out.err")"; try=$((try+1)); sleep 15
  done; log "conn $i FAILED"; return 1; }
log "=== connectors $VMODEL ($TIER) ==="
i=0; prev=""
for n in $NAMES; do
  if [ -n "$prev" ]; then i=$((i+1))
    if [ "$n" = "one-more-song" ]; then
      # Rendered BACKWARDS (phone screen -> campus) so the push-in reads naturally, then time-reversed
      # into the forward chain: finale aerial -> shrinks into the phone screen -> living room.
      ( gen_conn "$i" "$W/first_$n.png" "$W/last_$prev.png" && ffmpeg -v error -y -i "$W/conn_$i.mp4" -vf reverse -an "$W/conn_${i}_fwd.mp4" && mv "$W/conn_${i}_fwd.mp4" "$W/conn_$i.mp4" && log "conn $i time-reversed" ) &
    else
      [ -f "$W/last_$prev.png" ] && [ -f "$W/first_$n.png" ] && gen_conn "$i" "$W/last_$prev.png" "$W/first_$n.png" &
    fi
    sleep 3
  fi
  prev="$n"
done; wait
log "=== connectors done: $(ls "$W"/conn_*.mp4 2>/dev/null | wc -l | tr -d ' ') ==="
