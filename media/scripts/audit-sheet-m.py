"""Portrait audit sheet: first / 1/3 / 2/3 / last frame of each 9:16 clip in a tier dir.
Usage: python3 media/scripts/audit-sheet-m.py <tier-dir> <out.jpg> <clip-basename>...
"""
import subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw
tier, out, names = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3:]
tmp = Path("/tmp/claude-audit-m"); tmp.mkdir(exist_ok=True)
cw, ch = 180, 320
rows = []
for n in names:
    v = tier / f"{n}.mp4"
    if not v.exists(): continue
    dur = float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",v],capture_output=True,text=True).stdout.strip())
    frames = []
    for k, t in enumerate([0, dur/3, 2*dur/3, None]):
        f = tmp / f"{n}_{k}.png"
        if t is None: subprocess.run(["ffmpeg","-v","error","-y","-sseof","-0.1","-i",v,"-update","1","-frames:v","1",f])
        else: subprocess.run(["ffmpeg","-v","error","-y","-ss",f"{t:.2f}","-i",v,"-frames:v","1",f])
        frames.append(Image.open(f).convert("RGB").resize((cw, ch)))
    rows.append((n, frames))
sheet = Image.new("RGB", (cw*4, ch*len(rows)), "white")
for r, (n, frames) in enumerate(rows):
    for k, im in enumerate(frames): sheet.paste(im, (k*cw, r*ch))
    ImageDraw.Draw(sheet).text((6, r*ch+6), n, fill="yellow")
sheet.save(out, quality=86); print(out, sheet.size, [r[0] for r in rows])
