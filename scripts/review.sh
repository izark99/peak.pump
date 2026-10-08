#!/usr/bin/env bash
# Render a pose from 4 fixed cameras (+ face close-up) into $1 for mode $2 (clay|final).
# usage: scripts/review.sh <outDir> [clay|final] [exercise] [cycleFraction] [prefix]
set -euo pipefail
OUT=$1; MODE=${2:-clay}; EX=${3:-neutral_stance}; FRAC=${4:-0}; P=${5:-$MODE}
mkdir -p "$OUT"
node scripts/shot.mjs http://localhost:5173 "$OUT" \
  "$EX:$FRAC:cam,0,0.95,0,3.6,0,0.05:light:medium:$MODE:$P-front" \
  "$EX:$FRAC:cam,0,0.95,0,3.6,1.5708,0.05:light:medium:$MODE:$P-side" \
  "$EX:$FRAC:cam,0,0.95,0,3.6,3.1416,0.05:light:medium:$MODE:$P-back" \
  "$EX:$FRAC:cam,0,0.95,0,3.6,0.6,0.05:light:medium:$MODE:$P-three-quarter" \
  "$EX:$FRAC:cam,0,1.66,0,0.75,0.35,0.05:light:medium:$MODE:$P-face" | grep -v 404 || true
