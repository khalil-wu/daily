import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

const base = process.argv[2] ?? 'http://39.105.19.77';
const label = process.argv[3] ?? 'production';
if (!/^[a-z0-9-]+$/i.test(label)) throw new Error('Use a simple report label');
const output = resolve('docs/qa');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });
  const page = await context.newPage();
  const errors: string[] = [];
  const failed: { url: string; status: number }[] = [];
  const assetHeaders: Record<string, string>[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', response => {
    if (response.status() >= 400) failed.push({ url: response.url(), status: response.status() });
    if (/\.(js|css|woff2|otf)(\?|$)/.test(response.url())) {
      const h = response.headers();
      assetHeaders.push({ url: response.url(), encoding: h['content-encoding'] ?? '', cache: h['cache-control'] ?? '', type: h['content-type'] ?? '' });
    }
  });
  const started = Date.now();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByText('下一步', { exact: true }).waitFor({ timeout: 30000 });
  const firstInteractiveMs = Date.now() - started;
  await page.getByText('跳过', { exact: true }).filter({ visible: true }).first().click();
  await page.getByText('先本地使用', { exact: true }).click();
  await page.getByText('这是你的书架，点一本翻开', { exact: true }).waitFor({ timeout: 10000 });
  await page.getByText('跳过', { exact: true }).filter({ visible: true }).last().click();
  await page.getByRole('button', { name: /^日记本 全部日记/ }).click();
  await page.getByText('一分钟，认识记得日记', { exact: true }).waitFor({ timeout: 15000 });
  await page.getByText('跳过', { exact: true }).filter({ visible: true }).last().click();
  await page.getByText('写一篇日记', { exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  const metrics = await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    return {
      fontRequests: resources.filter(r => /\.(woff2|otf)(\?|$)/.test(r.name)).map(r => ({ url: r.name, bytes: r.transferSize, durationMs: Math.round(r.duration) })),
      transferBytes: resources.reduce((sum, r) => sum + r.transferSize, 0),
      paints: performance.getEntriesByType('paint').map(p => ({ name: p.name, ms: Math.round(p.startTime) })),
      overflow: document.documentElement.scrollWidth > innerWidth,
      language: document.documentElement.lang,
    };
  });
  await page.screenshot({ path: resolve(output, `${label}-home.png`) });
  const localHTML = await readFile('dist/index.html', 'utf8');
  const expectedEntry = localHTML.match(/_expo\/static\/js\/web\/entry-[a-f0-9]+\.js/)?.[0];
  const entryMatches = !!expectedEntry && assetHeaders.some(asset => asset.url.endsWith(expectedEntry));
  const manifest = await context.request.get(`${base}/release.json`);
  assert.equal(manifest.status(), 200);
  assert.deepEqual(await manifest.json(), JSON.parse(await readFile('dist/release.json', 'utf8')));
  // This context is disposable: verify an actual HTTP-origin local write without
  // an account, cloud upload or production feedback submission.
  await page.evaluate(() => {
    const key = 'jide-diary:state:v1';
    const state = JSON.parse(localStorage.getItem(key) || '{}');
    state.editorTourSeen = true;
    state.backup = { ...state.backup, auto: false };
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.goto(`${base}/write`);
  await page.getByLabel('日记标题', { exact: true }).fill('发布验收合成日记');
  await page.getByLabel('日记正文', { exact: true }).fill('这条合成记录仅存在于独立验收浏览器中，用于验证本机保存。');
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await page.getByText('已保存到本地', { exact: true }).waitFor();
  const localSaveVerified = await page.evaluate(() => JSON.parse(localStorage.getItem('jide-diary:state:v1') || '{}').entries.some((entry: { title: string; status: string }) => entry.title === '发布验收合成日记' && entry.status === 'published'));
  assert.equal(localSaveVerified, true);
  await page.goto(`${base}/settings/help`);
  await page.getByLabel('反馈内容', { exact: true }).waitFor();
  await page.waitForFunction(() => {
    const input = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="反馈内容"]');
    return !!input && !input.disabled && !input.readOnly;
  });
  const feedbackDraftAvailable = await page.getByLabel('反馈内容', { exact: true }).isEditable();
  assert.equal(feedbackDraftAvailable, true);
  const secureContext = await page.evaluate(() => isSecureContext);
  const probes = [];
  for (const path of ['/healthz', '/api/feedback/health', '/cb/', '/_expo/static/missing-jide.js', '/fonts/missing-jide.woff2', '/server/feedback.py', '/write']) {
    const response = await context.request.get(`${base}${path}`);
    probes.push({ path, status: response.status(), type: response.headers()['content-type'], cache: response.headers()['cache-control'] });
  }
  const report = { base, at: new Date().toISOString(), firstInteractiveMs, ...metrics, expectedEntry, entryMatches, localSaveVerified, feedbackDraftAvailable, secureContext, assetHeaders, errors, failed, probes };
  await writeFile(resolve(output, `${label}-performance.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  assert.equal(metrics.overflow, false);
  assert.equal(entryMatches, true, 'The served application must match the locally verified export');
  for (const probe of probes) {
    const expected = probe.path === '/cb/' ? [401, 403] : probe.path === '/server/feedback.py' ? [403] : /missing-jide/.test(probe.path) ? [404] : [200];
    assert.ok(expected.includes(probe.status), `${probe.path}: unexpected HTTP ${probe.status}`);
    if (['/healthz', '/api/feedback/health', '/cb/'].includes(probe.path)) assert.match(probe.cache || '', /no-store/);
  }
  for (const asset of assetHeaders) {
    assert.match(asset.cache, /immutable/, `${asset.url}: missing immutable cache`);
    if (/\.(js|css)$/.test(asset.url)) assert.equal(asset.encoding, 'gzip', `${asset.url}: gzip must be enabled`);
  }
} finally { await browser.close(); }
