"""Text-free promo film from the desktop chain: dive → connector → dive …, crossfaded.

Usage: python3 media/scripts/06-promo.py [--hold 1.5] [--xfade 0.5] [--tier final] --out <file.mp4>
  --hold S   freeze each scene's last frame for S seconds before the connector (0 = none)
No audio, 1920x1080, 24 fps. Costs no credits (uses the renders in media/work/<tier>).
"""
import argparse, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NAMES = ["opening-track", "landing", "ascent", "garden", "trail", "chamber", "finale", "one-more-song"]
ap = argparse.ArgumentParser()
ap.add_argument("--hold", type=float, default=0.0); ap.add_argument("--xfade", type=float, default=0.5)
ap.add_argument("--tier", default="final"); ap.add_argument("--out", required=True)
a = ap.parse_args()
FPS = 24
src = ROOT / "work" / a.tier

clips = []   # (path, is_dive)
for i, n in enumerate(NAMES):
    if i: clips.append((src / f"conn_{i}.mp4", False))
    clips.append((src / f"dive_{n}.mp4", True))

def frames(p):
    out = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", str(p)], capture_output=True, text=True).stdout.strip()
    return int(out)

hold_f = round(a.hold * FPS); x_f = round(a.xfade * FPS)
durs, parts, inputs = [], [], []
for k, (p, dive) in enumerate(clips):
    if not p.exists(): sys.exit(f"missing {p}")
    n = frames(p) + (hold_f if dive and hold_f else 0)
    durs.append(n)
    inputs += ["-i", str(p)]
    pad = f",tpad=stop_mode=clone:stop_duration={hold_f / FPS:.4f}" if dive and hold_f else ""
    parts.append(f"[{k}:v]fps={FPS},scale=1920:1080:flags=lanczos,format=yuv420p,setsar=1,settb=1/{FPS}{pad},trim=end_frame={n},setpts=PTS-STARTPTS[v{k}]")
# chain the crossfades; offset = running length so far minus the overlap
cur, total = "v0", durs[0]
for k in range(1, len(clips)):
    off = (total - x_f) / FPS
    out = f"x{k}"
    parts.append(f"[{cur}][v{k}]xfade=transition=fade:duration={x_f / FPS:.4f}:offset={off:.4f}[{out}]")
    cur, total = out, total + durs[k] - x_f
cmd = ["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(parts), "-map", f"[{cur}]", "-an",
       "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-r", str(FPS), "-movflags", "+faststart", a.out]
subprocess.run(cmd, check=True)
print(f"{a.out}: {len(clips)} clips, {total} frames = {total / FPS:.2f} s ({int(total / FPS // 60)}:{total / FPS % 60:04.1f})")
