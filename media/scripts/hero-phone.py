"""Phone hero master (media/anchor/anchor-v5b-phone.jpg) from the 9:19.5 wallpaper.

The wallpaper's clouds sit where the site's left-aligned hero copy and the top bar go, and light
text on a white cloud disappears. This repaints the sky above the tree line with the same gradient
and puts the clouds in the right-hand column only. No credits.
Writes the master, a content-hashed WebP for the site (so a re-render never serves a cached old
one) and the heroImageMobile line in apps/web/src/config/hero.ts — same naming as posters.py.
Usage: python3 media/scripts/hero-phone.py
"""
import hashlib, re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "media/work/wallpaper/FALLingInLove_wallpaper_phone_2464x5341.jpg"
rng = np.random.default_rng(11)
u = np.asarray(Image.open(SRC).convert("RGB")).astype(np.float32); H, W, _ = u.shape
r, g, b = u[..., 0], u[..., 1], u[..., 2]; mx, mn = u.max(axis=2), u.min(axis=2)
skyish = ((b > r + 20) & (b > g) & (b > 140)) | ((mn > 196) & (mx - mn < 44))
LIMIT = 2400                                   # the tree line is well above this row
L = np.zeros(W, int)
for x in range(W):
    col = skyish[:LIMIT, x]; y, gap = 0, 0
    for yy in range(LIMIT):
        if col[yy]: y, gap = yy, 0
        else:
            gap += 1
            if gap > 12: break
    L[x] = y
pad = np.pad(L, 24, mode="edge"); med = np.array([np.median(pad[i:i + 49]) for i in range(W)])
L = np.where(L < med - 36, med, L).astype(int)
sky_h = int(L.max()) + 4
top_c, mid_c, bot_c = np.array([88, 156, 206], np.float32), np.array([126, 183, 216], np.float32), np.array([171, 208, 227], np.float32)
t = (np.arange(sky_h) / (sky_h - 1))[:, None, None]
lower = np.clip((t - 0.55) / 0.45, 0, 1) ** 1.15
grad = np.where(t < 0.55, top_c + (mid_c - top_c) * (t / 0.55), mid_c + (bot_c - mid_c) * lower)
sky = np.broadcast_to(grad, (sky_h, W, 3)).copy() + rng.normal(0, 1.0, (sky_h, W, 1))
cloud = Image.new("L", (W * 2, sky_h * 2), 0); dc = ImageDraw.Draw(cloud)
def puff(cx, cy, s):
    for dx, dy, rad in [(-1.45, .30, .55), (-.80, -.05, .78), (0, -.30, 1.0), (.85, 0, .80), (1.5, .32, .52), (.15, .38, .72), (-.55, .40, .66), (.75, .42, .6)]:
        x, y, q = (cx + dx * s) * 2, (cy + dy * s) * 2, rad * s * 2
        dc.ellipse([x - q, y - q * .78, x + q, y + q * .78], fill=255)
tree = int(L.min())
# right-hand column only (x > 56 %): clear of the eyebrow/title on the left and the brand at top-left
for cx, cy, s in [(1935, tree - 640, 100), (1440, tree - 900, 44)]: puff(cx, cy, s)
cloud = cloud.resize((W, sky_h), Image.LANCZOS).filter(ImageFilter.GaussianBlur(3.0))
ca = np.asarray(cloud).astype(np.float32)[..., None] / 255
under = np.asarray(cloud.filter(ImageFilter.GaussianBlur(20))).astype(np.float32) / 255
shade = np.clip(under - np.roll(under, -28, axis=0), 0, 1)[..., None] * 2.2
sky = sky * (1 - ca) + (np.array([243, 244, 241], np.float32) - shade * np.array([58, 40, 24], np.float32)) * ca
ys = np.arange(sky_h)[:, None]
w = np.clip((L[None, :] - ys) / 6.0, 0, 1)[..., None]
u[:sky_h] = sky * w + u[:sky_h] * (1 - w)
out = Image.fromarray(np.clip(u, 0, 255).astype(np.uint8)).resize((1290, 2796), Image.LANCZOS)
dst = ROOT / "media/anchor/anchor-v5b-phone.jpg"
out.save(dst, "JPEG", quality=92, subsampling=0, optimize=True)
scenes = ROOT / "apps/web/public/media/scenes"
for old in scenes.glob("overture-anchor-v5b-m*.webp"): old.unlink()
tag = hashlib.sha1(dst.read_bytes()).hexdigest()[:8]
web = scenes / f"overture-anchor-v5b-m-{tag}.webp"
out.save(web, "WEBP", quality=84, method=6)
hero_ts = ROOT / "apps/web/src/config/hero.ts"
hero_ts.write_text(re.sub(r'export const heroImageMobile: string \| null = .*;', f'export const heroImageMobile: string | null = "/media/scenes/{web.name}";', hero_ts.read_text()))
print(dst.name, out.size, "→", web.name, "| tree line (2x) min", tree, "max", int(L.max()))
