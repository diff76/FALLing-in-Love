#!/bin/bash
# shared config for the scroll-world video chain (bash 3.2 safe)
P="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STILLS="$P/work/stills"; PR="$P/prompts/video"
NAMES="opening-track landing ascent garden trail chamber finale"
VMODEL="${VMODEL:-seedance_2_0_mini}"       # previz; final = seedance_2_0
case "$VMODEL" in
  kling3_0)          VOPTS="--mode std --sound off";        DIVE_DUR=10; CONN_DUR=5 ;;
  seedance_2_0_mini) VOPTS="--resolution 720p";             DIVE_DUR=8;  CONN_DUR=5 ;;
  *)                 VOPTS="--mode std --resolution 1080p"; DIVE_DUR=8;  CONN_DUR=5 ;;
esac
TIER="${TIER:-previz}"; W="$P/work/$TIER"; mkdir -p "$W"
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$W/run.log"; }
