#!/usr/bin/env python3
"""Build extra derived assets (R2) from generated full-res art.

Sources : assets-generated/2026-11-22/{11-moods,16-editor-icons,15-backgrounds}/ (gitignored)
Outputs : assets/ink-companion/moods/, assets/ink-companion/editor/, assets/papers/

- moods excited/angry: same normalization as the existing 6 — trim alpha to
  visible bounds + 4% pad, resize to 128px, FASTOCTREE palette quantize -> PNG
- editor icons strike/highlight: same normalization as existing editor icons —
  trim + 4% pad, resize to 96px, FASTOCTREE quantize -> PNG
- letter papers (10 opaque 1024x1536): resize 720x1080 JPEG q78 ->
  assets/papers/<key>.jpg and 120x180 JPEG q80 -> assets/papers/thumb/<key>.jpg

Idempotent: outputs are deterministic; safe to re-run.
"""
from pathlib import Path
from PIL import Image
import importlib.util

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets-generated' / '2026-11-22'

# reuse the pack builder's normalization helpers
spec = importlib.util.spec_from_file_location('packs', ROOT / 'scripts' / 'build-illustration-packs.py')
packs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packs)

def normalized_png(src: Path, dst: Path, size: int) -> None:
    im = Image.open(src).convert('RGBA')
    im = packs.trim_pad(im)
    scale = size / max(im.size)
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    # paste onto a transparent canvas so the glyph is centered in a square
    q = im.quantize(colors=255, method=Image.Quantize.FASTOCTREE)
    dst.parent.mkdir(parents=True, exist_ok=True)
    q.save(dst, optimize=True)

PAPERS = ['paper-white', 'mist-blue', 'mint-leaves', 'lilac-air', 'night-sky', 'ocean', 'forest', 'ink', 'scrapbook', 'geometric']

def main() -> None:
    total = 0
    for name in ['excited', 'angry']:
        out = ROOT / 'assets' / 'ink-companion' / 'moods' / f'{name}.png'
        normalized_png(SRC / '11-moods' / f'{name}.png', out, 128)
        total += out.stat().st_size
        print(f'mood {name}: {out.stat().st_size} bytes')
    for name in ['strike', 'highlight']:
        out = ROOT / 'assets' / 'ink-companion' / 'editor' / f'{name}.png'
        normalized_png(SRC / '16-editor-icons' / f'{name}.png', out, 96)
        total += out.stat().st_size
        print(f'editor {name}: {out.stat().st_size} bytes')
    for key in PAPERS:
        src = Image.open(SRC / '15-backgrounds' / f'{key}.png').convert('RGB')
        big = src.resize((720, 1080), Image.LANCZOS)
        out = ROOT / 'assets' / 'papers' / f'{key}.jpg'
        out.parent.mkdir(parents=True, exist_ok=True)
        big.save(out, quality=78, optimize=True)
        thumb = src.resize((120, 180), Image.LANCZOS)
        tout = ROOT / 'assets' / 'papers' / 'thumb' / f'{key}.jpg'
        tout.parent.mkdir(parents=True, exist_ok=True)
        thumb.save(tout, quality=80, optimize=True)
        total += out.stat().st_size + tout.stat().st_size
        print(f'paper {key}: {out.stat().st_size}+{tout.stat().st_size}')
    print(f'total bytes written: {total}')

if __name__ == '__main__':
    main()
