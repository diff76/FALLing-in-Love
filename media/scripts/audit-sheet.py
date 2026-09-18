"""audit-sheet.py <tier> <name...> — first/mid/last frames of each dive on one sheet (media/work/<tier>/sheet_audit_<n>.png)."""
import subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw
tier, names = sys.argv[1], sys.argv[2:]
W = Path(__file__).resolve().parents[1] / "work" / tier
tiles = []
for n in names:
    for k, ss in (("first", "0"), ("mid", "4"), ("last", None)):
        out = W / f"audit_{k}_{n}.png"
        cmd = ["ffmpeg", "-v", "error", "-y"] + (["-sseof", "-0.15"] if ss is None else ["-ss", ss]) + ["-i", str(W / f"dive_{n}.mp4"), "-frames:v", "1", "-q:v", "2", str(out)]
        subprocess.run(cmd, check=True); tiles.append((out, f"{n} — {k}"))
TW, TH, cols = 480, 270, 3
sheet = Image.new("RGB", (cols * (TW + 10) + 10, len(names) * (TH + 24) + 10), "white"); d = ImageDraw.Draw(sheet)
for i, (f, lab) in enumerate(tiles):
    x = 10 + (i % cols) * (TW + 10); y = 10 + (i // cols) * (TH + 24)
    sheet.paste(Image.open(f).resize((TW, TH)), (x, y)); d.text((x, y + TH + 4), lab, fill="black")
sheet.save(W / "sheet_audit_latest.png"); print("sheet:", W / "sheet_audit_latest.png")
