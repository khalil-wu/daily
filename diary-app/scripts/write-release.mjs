// Writes dist/release.json for scripts/deploy-web.sh after `npm run export:web`.
// version: UTC build time; entry/entryHash: the web entry bundle; contentHash: every exported file.
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const sha = buf => createHash('sha256').update(buf).digest('hex');

async function walk(dir) {
  const out = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, item.name);
    if (item.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

const html = await readFile(join(dist, 'index.html'), 'utf8');
const entry = html.match(/_expo\/static\/js\/web\/entry-[a-f0-9]+\.js/)?.[0];
if (!entry) throw new Error('dist/index.html has no web entry bundle; run npm run export:web first');
const files = (await walk(dist)).map(f => relative(dist, f).split(sep).join('/')).filter(f => f !== 'release.json').sort();
const lines = await Promise.all(files.map(async f => `${sha(await readFile(join(dist, f)))}  ${f}\n`));
const release = {
  version: new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'),
  entry,
  entryHash: sha(await readFile(join(dist, entry))),
  contentHash: sha(lines.join('')),
};
await writeFile(join(dist, 'release.json'), `${JSON.stringify(release, null, 2)}\n`);
console.log(JSON.stringify({ ...release, files: files.length }, null, 2));
