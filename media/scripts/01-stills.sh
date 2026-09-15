#!/bin/bash
# Track 2 step 2 — seven scene stills (gpt_image_2, 3:2, 2k). bash 3.2 safe.
# Each prompt = verbatim style preamble + still_<scene>.txt subject; refs = anchor + the photos
# listed on the prompt file's "refs:" line. Runs all seven concurrently; re-run to retry failures.
P="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; R="$P/.."; A="$R/Assets"; W="$P/work/stills"; PR="$P/prompts"
ANCHOR="${ANCHOR:-$P/anchor/anchor-v5b.png}"
NAMES="${NAMES:-opening-track landing ascent garden trail chamber finale}"
mkdir -p "$W"
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$W/run.log"; }

gen_still() { # name
  local n="$1" out="$W/still_$1"
  if [ -s "$out.png" ]; then log "still $n already present — skip"; return 0; fi
  local subject; subject="$(grep -v '^refs:' "$PR/still_$n.txt") $(cat "$PR/common-rules.txt")"
  local refs=(--image "$ANCHOR")
  local line; line=$(grep '^refs:' "$PR/still_$n.txt" | sed 's/^refs: *//')
  local IFS=','; for f in $line; do
    f=$(echo "$f" | sed 's/^ *//;s/ *$//'); case "$f" in *.jpg) [ -f "$A/$f" ] && refs+=(--image "$A/$f");; *.png) [ -f "$W/$f" ] && refs+=(--image "$W/$f");; esac
  done; unset IFS
  log "still $n start (${#refs[@]} ref args)"
  higgsfield generate create gpt_image_2 --prompt "$(cat "$PR/style-preamble.txt") $subject Composed for the centre with headroom above the focal subject; 3:2 landscape." \
    "${refs[@]}" --aspect_ratio 3:2 --resolution 2k --quality high \
    --wait --wait-timeout 15m --json > "$out.json" 2> "$out.err"
  local url; url=$(jq -r '.[0].result_url // empty' "$out.json" 2>/dev/null)
  if [ -n "$url" ] && curl -fsSL "$url" -o "$out.png"; then log "still $n ok"; else log "still $n FAIL: $(head -c 160 "$out.err")"; fi
}

log "=== stills: $NAMES ==="
for n in $NAMES; do gen_still "$n" & sleep 2; done; wait
log "=== stills done: $(ls "$W"/still_*.png 2>/dev/null | wc -l | tr -d ' ') files ==="
