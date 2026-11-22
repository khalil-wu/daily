#!/usr/bin/env python3
"""Build per-style illustration packs from generated full-res art.

Sources : assets-generated/2026-11-22/<pack>/ (gitignored raw generations)
Outputs : assets/packs/<styleKey>/ (committed web/app assets)

Per pack:
  - transparent slots (empty-book, empty-search, saved-success, privacy-lock,
    cloud-sync, memory-sticker): trim alpha to visible bounds + 4% pad,
    resize to 512px long side, FASTOCTREE palette quantize (validated visually
    identical on 04-ink-companion) -> <name>.png
  - onboard-write / onboard-memory (opaque 1024x1536, top area reserved for
    copy): square 1024 crop anchored on the content bbox toward the lower part,
    resize 768, JPEG q82 -> .jpg
  - profile-cover (opaque 1536x1024) -> 1200x800 JPEG q80

companion keeps its hand-tuned files in assets/ink-companion/illustrations.
Idempotent: safe to re-run; outputs are deterministic.
"""
from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets-generated' / '2026-11-22'
DST = ROOT / 'assets' / 'packs'

PACKS = {
    'editorial': '09-editorial-photo',
    'warm': '08-scrapbook',
    'cool': '02-azure',
    'ink': '01-monochrome',
    'forest': '03-mint',
    'sakura': '05-lilac',
    'kraft': '06-ink-mountains',
    'vivid': '07-geometric',
    'midnight': '10-midnight',
}
TRANSPARENT = ['empty-book', 'empty-search', 'saved-success', 'privacy-lock', 'cloud-sync', 'memory-sticker']
PORTRAITS = ['onboard-write', 'onboard-memory']


def trim_pad(im: Image.Image, frac=0.04) -> Image.Image:
    bbox = im.getchannel('A').getbbox()
    if not bbox:
        return im
    w, h = im.size
    px, py = int(w * frac / 2), int(h * frac / 2)
    box = (max(0, bbox[0] - px), max(0, bbox[1] - py), min(w, bbox[2] + px), min(h, bbox[3] + py))
    return im.crop(box)


def content_bbox(im: Image.Image, thresh=18):
    """BBox of pixels differing from the (near-flat) background estimated from the border."""
    a = np.asarray(im.convert('RGB')).astype(np.int16)
    border = np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3), a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    diff = np.abs(a - bg).max(axis=2)
    ys, xs = np.where(diff > thresh)
    if not len(xs):
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def square_portrait(im: Image.Image) -> Image.Image:
    """1024x1536 portrait -> square crop that keeps the content (anchored low)."""
    w, h = im.size
    side = min(w, h)
    bbox = content_bbox(im)
    if bbox:
        _, top, _, bottom = bbox
        # keep the full content if possible; otherwise bias the window low
        y0 = min(max(bottom - side, 0), h - side)
        y0 = min(y0, max(top - (side - (bottom - top)) // 2, 0)) if bottom - top <= side else y0
        y0 = max(0, min(y0, h - side))
    else:
        y0 = h - side
    return im.crop((0, int(y0), side, int(y0) + side))


def main() -> None:
    total = 0
    for key, pack in PACKS.items():
        src = SRC / pack
        out = DST / key
        out.mkdir(parents=True, exist_ok=True)
        for name in TRANSPARENT:
            im = Image.open(src / f'{name}.png').convert('RGBA')
            im = trim_pad(im)
            scale = 512 / max(im.size)
            im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
            q = im.quantize(colors=255, method=Image.Quantize.FASTOCTREE)
            q.save(out / f'{name}.png', optimize=True)
            total += (out / f'{name}.png').stat().st_size
        for name in PORTRAITS:
            im = Image.open(src / f'{name}.png').convert('RGB')
            im = square_portrait(im).resize((768, 768), Image.LANCZOS)
            im.save(out / f'{name}.jpg', quality=82, optimize=True)
            total += (out / f'{name}.jpg').stat().st_size
        cover = Image.open(src / 'profile-cover.png').convert('RGB').resize((1200, 800), Image.LANCZOS)
        cover.save(out / 'profile-cover.jpg', quality=80, optimize=True)
        total += (out / 'profile-cover.jpg').stat().st_size
        print(f'{key}: done')
    print(f'total bytes written: {total}')


if __name__ == '__main__':
    main()
