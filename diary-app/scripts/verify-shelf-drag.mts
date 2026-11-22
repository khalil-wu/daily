import assert from 'node:assert/strict';
import { chromium, webkit, devices, type Browser, type BrowserContext, type Page } from 'playwright';
import { defaultState } from '../src/store/storage';
import { buildSampleEntries } from '../src/data/samples';
import { DEFAULT_NOTEBOOK_ID } from '../src/data/constants';

const base = (process.argv[2] ?? 'http://localhost:8081').replace(/\/$/, '');
const now = Date.now();
const entries = buildSampleEntries(now);
entries.forEach((e, i) => { entries[i] = { ...e, notebookId: i < 8 ? ['nb_a', 'nb_b', 'nb_c', 'nb_d'][i % 4] : undefined }; });
const state = {
  ...defaultState(), entries, onboarded: true, tutorialSeen: true, editorTourSeen: true, shelfTourSeen: true, shelfDragHintSeen: true,
  usageMode: 'local', backup: { auto: false },
  notebooks: [
    { id: DEFAULT_NOTEBOOK_ID, name: '我的日记', color: '#B79276', createdAt: 0 },
    { id: 'nb_a', name: '旅行手记', color: '#E79A93', createdAt: 1 },
    { id: 'nb_b', name: '美食笔记', color: '#E8A86B', createdAt: 2 },
    { id: 'nb_c', name: '读书摘抄', color: '#7FA6C9', createdAt: 3 },
    { id: 'nb_d', name: '工作复盘', color: '#8FB58A', createdAt: 4 },
  ],
};
const pageErrors: string[] = [];
const SRC = /^日记本 美食/;
const DST = /^日记本 我的日记/;
const EXPECT = ['美食笔记', '我的日记', '旅行手记', '读书摘抄', '工作复盘'];

async function open(browser: Browser, opts: Parameters<Browser['newContext']>[0], syntheticPointers = false) {
  const context = await browser.newContext({ reducedMotion: 'no-preference', ...opts });
  await context.addInitScript('globalThis.__name = (v) => v;');
  if (syntheticPointers) {
    // WebKit has no touch injection API: synthetic pointers have no real capture target, so swallow the NotFoundError
    await context.addInitScript(`for (const k of ['setPointerCapture', 'releasePointerCapture']) { const o = Element.prototype[k]; Element.prototype[k] = function (id) { try { return o.call(this, id); } catch (e) {} }; }`);
  }
  await context.addInitScript(s => { if (!localStorage.getItem('jide-diary:state:v1')) localStorage.setItem('jide-diary:state:v1', JSON.stringify(s)); }, state);
  const page = await context.newPage();
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto(`${base}/shelf`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: SRC }).first().waitFor();
  await page.waitForTimeout(700);
  return { context, page };
}

const centerOf = async (page: Page, re: RegExp) => {
  await page.getByRole('button', { name: SRC }).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const box = (await page.getByRole('button', { name: re }).first().boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const names = (page: Page) => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('jide-diary:state:v1')!);
  return [...s.notebooks].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)).map((n: any) => n.name);
});

async function mouseDrag(page: Page, hold: number) {
  const a = await centerOf(page, SRC);
  const t = await centerOf(page, DST);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  if (hold) await page.waitForTimeout(hold);
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(a.x + ((t.x - a.x) * i) / steps, a.y + ((t.y - a.y) * i) / steps);
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForTimeout(700);
}

async function touchDrag(page: Page, hold: number, cdp?: { send: (m: string, p: unknown) => Promise<unknown> }) {
  const a = await centerOf(page, SRC);
  const t = await centerOf(page, DST);
  const send = async (type: string, x: number, y: number) => {
    if (cdp) await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  };
  if (cdp) {
    await send('touchStart', a.x, a.y);
    await page.waitForTimeout(hold);
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      await send('touchMove', a.x + ((t.x - a.x) * i) / steps, a.y + ((t.y - a.y) * i) / steps);
      await page.waitForTimeout(25);
    }
    await page.waitForTimeout(300);
    await send('touchEnd', t.x, t.y);
  } else {
    // WebKit has no CDP: drive the same pointer events a finger produces (pointerType "touch")
    await page.evaluate(async ({ a, t, hold }) => {
      const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
      const el = document.elementFromPoint(a.x, a.y)!;
      const fire = (type: string, x: number, y: number, buttons: number) =>
        el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, buttons, button: type === 'pointermove' ? -1 : 0, width: 1, height: 1, pressure: 0.5 }));
      fire('pointerdown', a.x, a.y, 1);
      await wait(hold);
      for (let i = 1; i <= 10; i++) { fire('pointermove', a.x + ((t.x - a.x) * i) / 10, a.y + ((t.y - a.y) * i) / 10, 1); await wait(25); }
      await wait(300);
      fire('pointerup', t.x, t.y, 0);
    }, { a, t, hold });
  }
  await page.waitForTimeout(700);
}

type Result = { env: string; ok: boolean; detail: string };
const results: Result[] = [];
async function check(env: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ env, ok: true, detail: 'order persisted' });
  } catch (e) {
    results.push({ env, ok: false, detail: String((e as Error).message).split('\n')[0] });
  }
}
async function expectOrder(page: Page) {
  assert.deepEqual(await names(page), EXPECT, 'order after drop');
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: SRC }).first().waitFor();
  assert.deepEqual(await names(page), EXPECT, 'order after reload');
}

const chrome = await chromium.launch();
let wk: Browser | null = null;
try {
  wk = await webkit.launch();
} catch {
  wk = null;
}

await check('chromium desktop · mouse immediate drag', async () => {
  const { context, page } = await open(chrome, { viewport: { width: 390, height: 844 } });
  await mouseDrag(page, 0);
  await expectOrder(page);
  await context.close();
});
await check('chromium desktop · mouse click opens book', async () => {
  const { context, page } = await open(chrome, { viewport: { width: 390, height: 844 } });
  await page.getByRole('button', { name: SRC }).first().click();
  await page.getByRole('tab', { name: '日记', exact: true }).last().waitFor({ timeout: 8000 });
  await context.close();
});
for (const hold of [0, 400]) {
  await check(`webkit desktop · mouse ${hold ? 'hold' : 'immediate'}`, async () => {
    assert.ok(wk, 'webkit not installed');
    const { context, page } = await open(wk!, { viewport: { width: 390, height: 844 } });
    await mouseDrag(page, hold);
    await expectOrder(page);
    await context.close();
  });
}
await check('chromium Pixel 7 · touch long-press drag', async () => {
  const { context, page } = await open(chrome, { ...devices['Pixel 7'] });
  const cdp = await (context as BrowserContext).newCDPSession(page);
  await touchDrag(page, 400, cdp);
  await expectOrder(page);
  await context.close();
});
await check('chromium Pixel 7 · quick swipe scrolls, no reorder', async () => {
  const { context, page } = await open(chrome, { ...devices['Pixel 7'] });
  const cdp = await (context as BrowserContext).newCDPSession(page);
  const before = await names(page);
  const send = (type: string, y: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 200, y, id: 1 }] });
  await send('touchStart', 600);
  for (let i = 1; i <= 10; i++) { await send('touchMove', 600 - i * 35); await page.waitForTimeout(16); }
  await send('touchEnd', 250);
  await page.waitForTimeout(500);
  assert.deepEqual(await names(page), before, 'swipe must not reorder');
  const scrolled = await page.evaluate(() => Array.from(document.querySelectorAll('*')).some(el => (el as HTMLElement).scrollTop > 40));
  assert.ok(scrolled, 'shelf scrolled');
  await context.close();
});
await check('webkit iPhone 14 · touch long-press drag', async () => {
  assert.ok(wk, 'webkit not installed');
  const { context, page } = await open(wk!, { ...devices['iPhone 14'] }, true);
  await touchDrag(page, 400);
  await expectOrder(page);
  await context.close();
});

await chrome.close();
await wk?.close();
console.log(JSON.stringify({ results, pageErrors }, null, 2));
if (results.some(r => !r.ok) || pageErrors.length) process.exit(1);
