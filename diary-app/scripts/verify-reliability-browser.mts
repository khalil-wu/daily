import { fileURLToPath } from 'node:url';
/** Local-only final privacy and long-writing browser audit; run without other browser workloads. */
import assert from 'node:assert/strict';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { defaultState, normalizeEntry } from '../src/store/storage';
import { sha256 } from '../src/utils/text';
import type { AppState } from '../src/store/types';

const baseURL = process.env.DIARY_TEST_URL || 'http://127.0.0.1:8765';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname));
const out = new URL('../docs/qa/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors: string[] = [];
const mode = process.env.JIDE_AUDIT_MODE;
const results: unknown[] = mode === 'performance' ? JSON.parse(await readFile(new URL('extended-report.json', out), 'utf8')).filter((r: any) => r.case === 'lock-40-visible-frames' && r.result === 'pass') : [];
const seed = (): AppState => ({ ...defaultState(), onboarded: true, usageMode: 'local', tutorialSeen: true, editorTourSeen: true, backup: { auto: false } });
async function context(state: AppState) {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', locale: 'zh-CN' });
  await c.addInitScript('globalThis.__name = (value) => value;');
  await c.addInitScript(value => {
    if (!sessionStorage.getItem('reliability-seeded')) {
      localStorage.setItem('jide-diary:state:v1', JSON.stringify(value));
      sessionStorage.setItem('reliability-seeded', 'yes');
    }
  }, state);
  const p = await c.newPage();
  p.on('pageerror', e => errors.push(e.message));
  return { c, p };
}
async function pin(p: Page) { for (const digit of ['1', '2', '3', '4']) await p.getByText(digit, { exact: true }).click(); }
try {
  if (mode !== 'performance') {
  const locked = seed();
  locked.privacy = { ...locked.privacy, appLock: true, passcodeHash: await sha256('1234'), biometric: false, lockHidden: true };
  locked.appearance = { ...locked.appearance, theme: 'dark', fontScale: 'xlarge', lineHeight: 'relaxed' };
  locked.entries = [normalizeEntry({ id: 'lock-audit', title: '锁屏保护正文标记', body: '锁屏前后不应闪露的私密内容', status: 'published' })];
  const secured = await context(locked);
  // Raw script avoids transpiler helpers in callbacks injected before the app bundle loads.
  await secured.c.addInitScript(`
    window.__lockAudit = { totalFrames: 0, lockedFrames: 0, exposedFrames: 0, observedContentFrames: 0, stopped: false };
    function isVisible(node) {
      for (let el = node; el; el = el.parentElement) {
        const css = getComputedStyle(el);
        if (el.hasAttribute('inert') || css.opacity === '0' || css.display === 'none' || css.visibility === 'hidden') return false;
      }
      const box = node.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    }
    function audit() {
      const a = window.__lockAudit;
      if (a.stopped) return;
      a.totalFrames++;
      const dialog = document.querySelector('[role="dialog"][aria-label="应用锁"]');
      if (dialog && isVisible(dialog)) a.lockedFrames++;
      const leaves = Array.from(document.querySelectorAll('div, p, span, textarea, input')).filter(el => el.children.length === 0 && /锁屏保护正文标记|锁屏前后不应闪露的私密内容/.test(el.textContent || el.value || ''));
      if (leaves.length) a.observedContentFrames++;
      if (leaves.some(isVisible)) a.exposedFrames++;
      requestAnimationFrame(audit);
    }
    requestAnimationFrame(audit);
  `);
  await secured.p.goto(`${baseURL}/memory/lock-audit`);
  await secured.p.getByRole('dialog', { name: '应用锁', exact: true }).waitFor();
  await secured.p.waitForFunction(() => (window as any).__lockAudit.lockedFrames >= 40);
  const audit = await secured.p.evaluate(() => { const a = (window as any).__lockAudit; a.stopped = true; return a; });
  assert.equal(audit.exposedFrames, 0, 'private diary content must be visually hidden on every sampled frame');
  assert.ok(audit.observedContentFrames > 0, 'the audit actually observed the protected mounted page');
  assert.equal(await secured.p.getByRole('button', { name: '返回', exact: true }).count(), 0, 'background navigation absent from accessibility tree');
  const inert = secured.p.locator('[inert]').first();
  assert.equal(await inert.evaluate(el => getComputedStyle(el).opacity), '0');
  const focused: string[] = [];
  for (let n = 0; n < 24; n++) {
    await secured.p.keyboard.press('Tab');
    const f = await secured.p.evaluate(() => ({ inBackground: !!document.activeElement?.closest('[inert]'), label: document.activeElement === document.body ? 'BODY (outside app content)' : document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim() || document.activeElement?.tagName }));
    assert.equal(f.inBackground, false, 'Tab cannot enter the protected page');
    focused.push(f.label?.slice(0, 35) || 'none');
  }
  assert.equal(await secured.p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await secured.p.screenshot({ path: fileURLToPath(new URL('app-lock-dark-xlarge-390.png', out)) });
  await pin(secured.p);
  await secured.p.getByRole('dialog', { name: '应用锁', exact: true }).waitFor({ state: 'hidden' });
  await secured.p.getByText('锁屏前后不应闪露的私密内容', { exact: true }).waitFor();
  assert.equal(await secured.p.locator('[inert]').count(), 0);
  results.push({ case: 'lock-40-visible-frames', result: 'pass', ...audit, keyboardTabs: 24, focused, unlockedAfterCorrectPin: true, darkExtraLargeNoOverflow: true });
  await secured.c.close();
  }

  if (mode !== 'lock') {
  const long = seed();
  const body = '今天认真记录生活中的细节和感受。\n'.repeat(1875).slice(0, 30000);
  long.entries = [normalizeEntry({ id: 'long-writing', title: '三万字写作验收', body, status: 'draft' })];
  const writing = await context(long);
  await writing.p.goto(`${baseURL}/write?id=long-writing`);
  const input = writing.p.getByLabel('日记正文', { exact: true });
  await input.waitFor();
  await writing.p.evaluate(() => document.fonts.ready);
  assert.equal((await input.inputValue()).length, 30000);
  await input.focus();
  await input.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(el.value.length, el.value.length));
  await writing.p.evaluate(() => {
    const stats = { inputToFrame: [] as number[], longTasks: [] as number[], frameIntervals: [] as number[], capture: true };
    (window as any).__writingStats = stats;
    const observer = new PerformanceObserver(list => { if (stats.capture) for (const e of list.getEntries()) stats.longTasks.push(e.duration); });
    observer.observe({ type: 'longtask' });
    document.addEventListener('input', event => {
      if (!(event.target instanceof HTMLTextAreaElement)) return;
      const at = performance.now();
      requestAnimationFrame(() => stats.inputToFrame.push(performance.now() - at));
    }, true);
  });
  for (let n = 0; n < 12; n++) {
    await writing.p.keyboard.insertText('新');
    await writing.p.waitForFunction(target => (window as any).__writingStats.inputToFrame.length >= target, n + 1);
  }
  await writing.p.waitForFunction(() => JSON.parse(localStorage.getItem('jide-diary:state:v1') || '{}').entries?.find((e: any) => e.id === 'long-writing')?.body?.length === 30012);
  const scrolling = await writing.p.evaluate(async () => {
    const textarea = document.querySelector('textarea[aria-label="日记正文"]') as HTMLTextAreaElement;
    const nodes: HTMLElement[] = [];
    for (let el: HTMLElement | null = textarea; el; el = el.parentElement) if (el.scrollHeight > el.clientHeight + 10) nodes.push(el);
    const target = nodes.find(el => /auto|scroll/.test(getComputedStyle(el).overflowY)) ?? nodes[0];
    if (!target) return { scrollable: false, samples: 0, distance: 0, frameIntervals: [] };
    target.scrollTop = 0;
    const times: number[] = [];
    let last = performance.now();
    for (let i = 0; i < 40; i++) await new Promise<void>(resolve => requestAnimationFrame(now => { times.push(now - last); last = now; target.scrollTop += 80; resolve(); }));
    return { scrollable: true, samples: times.length, distance: target.scrollTop, frameIntervals: times };
  });
  const perf = await writing.p.evaluate(() => { const stats = (window as any).__writingStats; stats.capture = false; return stats; });
  const percentile = (numbers: number[], p: number) => [...numbers].sort((a, b) => a - b)[Math.min(numbers.length - 1, Math.floor(numbers.length * p))];
  assert.ok(scrolling.scrollable && scrolling.distance > 0, 'long diary is actually scrollable');
  assert.equal(perf.inputToFrame.length, 12);
  await writing.p.screenshot({ path: fileURLToPath(new URL('long-writing-30000.png', out)) });
  results.push({ case: 'long-writing-30000', result: 'pass', environment: 'single headless Chromium, local preview, no CPU throttling; diagnostic measurement only', bodyCharacters: 30000, inputEvents: 12, persistedCharacters: 30012, inputToNextFrameMs: { p50: percentile(perf.inputToFrame, .5), p95: percentile(perf.inputToFrame, .95), max: Math.max(...perf.inputToFrame), samples: perf.inputToFrame }, longTasksOver50ms: perf.longTasks, scroll: { ...scrolling, p95FrameIntervalMs: percentile(scrolling.frameIntervals, .95) } });
  await writing.c.close();
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, results, browserErrors: errors }, null, 2));
} catch (error) {
  results.push({ result: 'fail', message: error instanceof Error ? error.message : String(error), browserErrors: errors });
  throw error;
} finally {
  await browser.close();
  await writeFile(new URL('extended-report.json', out), JSON.stringify(results, null, 2));
}
