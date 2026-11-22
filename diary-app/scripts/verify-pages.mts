import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { defaultState } from '../src/store/storage';
import { buildSampleEntries, buildSampleDrafts } from '../src/data/samples';

const base = 'http://127.0.0.1:8765';
await mkdir('docs/qa/pages/screenshots', { recursive: true });
const routes = JSON.parse(await readFile('docs/research/route-inventory.json', 'utf8'));
const now = new Date(2026, 10, 21, 18).getTime();
const entries = buildSampleEntries(now);
entries[0] = { ...entries[0], id: 'audit-entry', people: ['audit-person'] };
entries.push(...buildSampleDrafts(now));
entries.push({ ...entries[0], id: 'audit-hidden', title: '隐藏日记示例', hidden: true });
entries.push({ ...entries[0], id: 'audit-deleted', title: '回收站示例', deletedAt: now });
const state = { ...defaultState(), entries, onboarded: true, tutorialSeen: true, editorTourSeen: true,
  backup: { auto: false }, people: [{ id: 'audit-person', name: '小林', aliases: ['林同学'], relation: 'friend', color: '#56875F', createdAt: now - 86400000, note: '一起旅行的朋友', birthday: '12-15' }],
  conflicts: [{ entryId: 'audit-entry', localUpdatedAt: now, cloudUpdatedAt: now + 1000, cloudEntry: { ...entries[0], body: '另一个版本的示例内容', updatedAt: now + 1000 } }],
};
const browser = await chromium.launch({ headless: true });
const report = [];
for (const item of routes) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', locale: 'zh-CN' });
  await context.addInitScript(initial => localStorage.setItem('jide-diary:state:v1', JSON.stringify(initial)), state);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    const url = `${base}${item.route}${item.route === '/saved' ? '?id=audit-entry' : item.route === '/write' ? '?id=audit-entry' : ''}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    await page.screenshot({ path: `docs/qa/pages/screenshots/${item.slug}.png` });
    const observation = await page.evaluate(() => {
      const text = document.body.innerText;
      const all = Array.from(document.querySelectorAll('div,span,input,textarea,button'));
      const leaves = all.filter(el => el.childElementCount === 0 && el.textContent?.trim());
      const fontSizes = [...new Set(leaves.map(el => getComputedStyle(el).fontSize))];
      const families = [...new Set(leaves.map(el => getComputedStyle(el).fontFamily))];
      const overflows = all.filter(el => { const r = el.getBoundingClientRect(); const style=getComputedStyle(el); return r.width && r.left >= 0 && r.right > innerWidth + 2 && style.position !== 'absolute'; }).slice(0, 6).map(el => el.textContent?.slice(0, 80));
      return { text: text.slice(0, 6500), fontSizes, families, overflows, bodyWidth: document.body.scrollWidth };
    });
    report.push({ ...item, actualURL: page.url(), screenshot: `screenshots/${item.slug}.png`, errors, ...observation });
    console.log(`${item.source}: captured`);
  } catch (error) { report.push({ ...item, errors: [String(error)] }); console.log(`${item.source}: FAILED ${String(error)}`); }
  await context.close();
}
for (const [name, appearance] of [
  ['cool', { style: 'cool', accent: 'steel', theme: 'light' }],
  ['ink', { style: 'ink', accent: 'ink', theme: 'light' }],
  ['dark-large', { style: 'warm', accent: 'latte', theme: 'dark', fontScale: 'xlarge' }],
]) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await context.addInitScript(initial => localStorage.setItem('jide-diary:state:v1', JSON.stringify(initial)), { ...state, appearance: { ...state.appearance, ...appearance } });
  const page = await context.newPage();
  for (const route of ['/', '/write?id=audit-entry', '/settings/appearance', '/stats', '/picker/mood']) {
    await page.goto(base + route, { waitUntil: 'networkidle' });
    const slug = `theme-${name}-${route.split('?')[0].replaceAll('/', '-') || 'home'}`;
    await page.screenshot({ path: `docs/qa/pages/screenshots/${slug}.png` });
  }
  await context.close();
}
await writeFile('docs/qa/pages/page-observations.json', JSON.stringify(report, null, 2));
await browser.close();

const failures = report.filter(item => item.errors.length);
console.log(JSON.stringify({ routes: report.length, runtimeErrors: failures.length, screenshotCount: report.length + 15 }));
if (failures.length) process.exitCode = 1;
