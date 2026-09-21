#!/bin/bash
# shared config for the scroll-world video chain (bash 3.2 safe)
P="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STILLS="$P/work/stills"; PR="$P/prompts/video"
NAMES="opening-track landing ascent garden trail chamber finale one-more-song"
VMODEL="${VMODEL:-seedance_2_0_mini}"       # previz; final = seedance_2_0
case "$VMODEL" in
  kling3_0)          VOPTS="--mode std --sound off";        DIVE_DUR=10; CONN_DUR=5 ;;
  seedance_2_0_mini) VOPTS="--resolution 720p";             DIVE_DUR=8;  CONN_DUR=5 ;;
  *)                 VOPTS="--mode std --resolution 1080p"; DIVE_DUR=8;  CONN_DUR=5 ;;
esac
TIER="${TIER:-previz}"
# MOBILE=1 → the native 9:16 portrait chain (pipeline.md §6b): portrait canvases in
# work/stills-m (canvas_<scene>.png), renders in work/<tier>-m, 9:16 aspect, and a
# portrait clause prepended to every prompt. Encodes land as <scene>-m.mp4 / conn<i>-m.mp4.
MOBILE="${MOBILE:-0}"
if [ "$MOBILE" = "1" ]; then ASPECT="9:16"; W="$P/work/$TIER-m"; STILLS="$P/work/stills-m"; STILL_PREFIX="canvas_"
else ASPECT="16:9"; W="$P/work/$TIER"; STILL_PREFIX="still_"; fi
mkdir -p "$W"
still_for() { echo "$STILLS/$STILL_PREFIX$1.png"; }
prompt_for() { # $1 = prompt basename (dive_x | conn_i)
  if [ "$MOBILE" = "1" ]; then printf '%s %s' "$(cat "$PR/portrait-clause.txt")" "$(cat "$PR/$1.txt")"; else cat "$PR/$1.txt"; fi; }
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$W/run.log"; }
