"""Create lossless web fonts, preserving every glyph from the native OTF files.

Requires fontTools and Node.js (its built-in Brotli avoids an extra dependency).
Run manually when the source fonts change; generated WOFF2 files are checked in.
"""
import subprocess
import sys
import types
import hashlib
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path


def brotli(data, decompress=False, mode=2):
    script = """
const fs = require('node:fs');
const z = require('node:zlib');
const input = fs.readFileSync(0);
const output = process.argv[1] === 'decode'
  ? z.brotliDecompressSync(input)
  : z.brotliCompressSync(input, {params: {
    [z.constants.BROTLI_PARAM_MODE]: Number(process.argv[2]),
    [z.constants.BROTLI_PARAM_QUALITY]: 9,
  }});
fs.writeFileSync(1, output);
"""
    return subprocess.run(
        ['node', '-e', script, 'decode' if decompress else 'encode', str(mode)],
        input=data, stdout=subprocess.PIPE, check=True,
    ).stdout


# fontTools uses this small public Brotli interface for WOFF2 containers.
adapter = types.ModuleType('brotli')
adapter.MODE_FONT = 2
adapter.MODE_TEXT = 1
adapter.compress = lambda data, mode=2: brotli(data, mode=mode)
adapter.decompress = lambda data: brotli(data, decompress=True)
sys.modules['brotli'] = adapter

from fontTools.ttLib import TTFont
from fontTools import subset

root = Path(__file__).resolve().parents[1]
font_dir = root / 'assets' / 'fonts'
output = root / 'public' / 'fonts'
css_dir = font_dir / 'web'


def make_subset(job):
    source, name, points = job
    font = TTFont(source, recalcTimestamp=False)
    options = subset.Options()
    options.recalc_timestamp = False
    options.layout_features = ['*']
    sub = subset.Subsetter(options=options)
    sub.populate(unicodes=points)
    sub.subset(font)
    font.flavor = 'woff2'
    target = output / name
    font.save(target)
    restored = TTFont(target)
    assert set(restored.getBestCmap()) == set(points), 'Characters changed'
    size = target.stat().st_size
    hashed = target.stem + '-' + hashlib.sha256(target.read_bytes()).hexdigest()[:16] + target.suffix
    target.rename(output / hashed)
    return size, hashed


def unicode_range(points):
    ranges = []
    start = end = points[0]
    for point in points[1:]:
        if point == end + 1:
            end = point
        else:
            ranges.append(f'U+{start:X}-{end:X}' if start != end else f'U+{start:X}')
            start = end = point
    ranges.append(f'U+{start:X}-{end:X}' if start != end else f'U+{start:X}')
    return ','.join(ranges)


if __name__ == '__main__':
    output.mkdir(parents=True, exist_ok=True)
    css_dir.mkdir(parents=True, exist_ok=True)
    # One eager subset covers all interface text; uncommon diary characters load
    # their own small range on demand. No glyphs are discarded.
    interface = set(range(0x20, 0x100))
    for directory in [root / 'app', root / 'src']:
        for path in directory.rglob('*'):
            if path.suffix in ['.ts', '.tsx']:
                interface.update(ord(c) for c in path.read_text() if ord(c) > 0x7F)
    jobs, rules, counts = [], [], {}
    for source in sorted(font_dir.glob('*.otf')):
        cmap = set(TTFont(source).getBestCmap())
        family = 'NotoSerifSC-SemiBold' if 'SemiBold' in source.name else 'NotoSerifSC'
        groups = [('ui', sorted(cmap & interface))]
        remainder = cmap - interface
        for page in sorted({point // 256 for point in remainder}):
            groups.append((f'{page:04x}', sorted(p for p in remainder if p // 256 == page)))
        assert set().union(*(set(points) for _, points in groups)) == cmap
        counts[family] = len(cmap)
        for label, points in groups:
            name = f'{source.stem}-{label}.woff2'
            jobs.append((source, name, points))
            rules.append((family, unicode_range(points)))
    with ProcessPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(make_subset, jobs))
    css = [f"@font-face {{ font-family: '{family}'; font-style: normal; font-weight: 400; font-display: swap; src: url('/fonts/{hashed}') format('woff2'); unicode-range: {points}; }}"
           for (family, points), (_, hashed) in zip(rules, results)]
    (css_dir / 'fonts.css').write_text('\n'.join(css) + '\n')
    sizes = [size for size, _ in results]
    print(f'{len(jobs)} subsets; {sum(sizes):,} total bytes; preserved characters: {counts}')
    print('UI subsets:', {p.name: p.stat().st_size for p in output.glob('*-ui-*.woff2')})
