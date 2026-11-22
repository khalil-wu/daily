// Run against a local web export: node --import tsx scripts/verify-ui.mts [baseURL] [outputDirectory]
// Every scenario uses a disposable browser context; it never touches an existing profile.
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const baseURL = (process.argv[2] ?? 'http://127.0.0.1:8765').replace(/\/$/, '');
const out = resolve(process.argv[3] ?? resolve(dirname(fileURLToPath(import.meta.url)), '../docs/qa'));
const scenario = process.env.JIDE_UI_SCENARIO;
const viewports = scenario === 'extended' ? [{ width: 390, height: 844 }] : [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1280, height: 900 }];
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = [];
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    await context.addInitScript('globalThis.__name = (value) => value;');
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL);
    await page.getByRole('button', { name: '下一步', exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${out}/onboarding-${viewport.width}.png` });
    await page.getByRole('button', { name: '下一步', exact: true }).click();
    await page.getByRole('button', { name: '第 2 页：记录心情与思考' }).waitFor();
    assert.equal(await page.getByRole('button', { name: '第 2 页：记录心情与思考' }).getAttribute('aria-pressed'), 'true');
    const title2 = await page.getByText('记录心情与思考', { exact: true }).boundingBox();
    assert.ok(title2 && title2.x >= 0 && title2.x < viewport.width, 'carousel page two must align inside viewport');
    await page.screenshot({ path: `${out}/onboarding-page2-${viewport.width}.png` });
    await page.getByRole('button', { name: '下一步', exact: true }).click();
    await page.getByRole('button', { name: '开始使用', exact: true }).click();
    await page.getByText('先本地使用', { exact: true }).click();
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      const key = 'jide-diary:state:v1';
      const state = JSON.parse(localStorage.getItem(key));
      state.tutorialSeen = true;
      state.editorTourSeen = true;
      localStorage.setItem(key, JSON.stringify(state));
    });
    await page.reload();
    await page.getByRole('tab', { name: '日记', exact: true }).last().waitFor();
    await page.screenshot({ path: `${out}/home-${viewport.width}.png` });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, 'no horizontal page overflow');
    for (const name of ['日历', '回顾', '统计', '我的', '日记']) {
      await page.getByRole('tab', { name, exact: true }).last().click();
      await page.waitForTimeout(100);
      assert.equal(await page.getByRole('tab', { name, exact: true }).last().getAttribute('aria-selected'), 'true');
    }
    await page.goto(`${baseURL}/settings/typography`);
    await page.getByRole('radio', { name: '字体：黑体' }).click();
    assert.equal(await page.getByRole('radio', { name: '字体：黑体' }).getAttribute('aria-checked'), 'true');
    await page.getByRole('radio', { name: '字体：宋体' }).click();
    // Reading fonts load when reading content is visible; the onboarding UI uses system fonts.
    await page.getByText('把平凡的一天，慢慢记住', { exact: true }).scrollIntoViewIfNeeded();
    await page.evaluate(async () => {
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await document.fonts.ready;
    });
    const fontStats = await page.evaluate(() => ({ regular: document.fonts.check('16px NotoSerifSC', '记得日记'), bold: document.fonts.check('16px NotoSerifSC-SemiBold', '记得日记'), resources: performance.getEntriesByType('resource').filter(r => r.name.includes('.woff2')).map(r => ({ name: r.name.split('/').pop(), bytes: r.encodedBodySize, status: r.responseStatus })) }));
    assert.equal(fontStats.regular, true);
    assert.equal(fontStats.bold, true);
    assert.ok(fontStats.resources.length > 0 && fontStats.resources.every(r => r.status === 200 && r.bytes > 0), `actual reading font shards loaded successfully: ${JSON.stringify(fontStats)}`);
    await page.getByRole('radio', { name: '字体：宋体' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/typography-${viewport.width}.png` });
    await page.goto(`${baseURL}/auth/login`);
    await page.locator('input').first().focus();
    const focusBorder = await page.locator('input').first().evaluate(el => getComputedStyle(el.parentElement).borderColor);
    assert.ok(focusBorder && focusBorder !== 'rgba(0, 0, 0, 0)', 'input has a visible focus border');
    await page.getByRole('button', { name: '显示密码', exact: true }).click();
    await page.getByRole('button', { name: '隐藏密码', exact: true }).waitFor();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    if (viewport.width === 390) {
      await page.goto(baseURL);
      await page.getByText('加载示例日记体验', { exact: true }).click();
      await page.getByRole('alert').waitFor({ state: 'hidden' });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${out}/home-samples-390.png` });
      await page.evaluate(() => {
        const key = 'jide-diary:state:v1';
        const state = JSON.parse(localStorage.getItem(key));
        state.appearance = { ...state.appearance, theme: 'dark', fontScale: 'xlarge', lineHeight: 'relaxed' };
        localStorage.setItem(key, JSON.stringify(state));
      });
      await page.reload();
      await page.getByRole('tab', { name: '日记', exact: true }).last().waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'dark / extra large font does not overflow');
      await page.screenshot({ path: `${out}/home-dark-xlarge-390.png` });
      report.push({ case: 'dark-extra-large', viewport, result: 'pass' });

      const passcodeHash = createHash('sha256').update('jide-diary::1234').digest('hex');
      await page.evaluate(hash => {
        const key = 'jide-diary:state:v1';
        const state = JSON.parse(localStorage.getItem(key));
        state.privacy = { ...state.privacy, appLock: true, passcodeHash: hash, biometric: false };
        localStorage.setItem(key, JSON.stringify(state));
      }, passcodeHash);
      await page.addInitScript(`
        window.__jideLockAudit = { frames: 0, lockedFrames: 0, exposed: 0 };
        function audit() {
          const back = document.querySelector('[aria-label="返回"]');
          if (back && !back.closest('[inert]')) window.__jideLockAudit.exposed++;
          window.__jideLockAudit.frames++;
          if (document.querySelector('[role="dialog"][aria-label="应用锁"]')) window.__jideLockAudit.lockedFrames++;
          if (window.__jideLockAudit.lockedFrames < 40) requestAnimationFrame(audit);
        }
        requestAnimationFrame(audit);
      `);
      await page.goto(`${baseURL}/settings/account`);
      await page.getByRole('dialog', { name: '应用锁' }).waitFor();
      await page.waitForFunction(() => window.__jideLockAudit.lockedFrames >= 40);
      assert.equal(await page.evaluate(() => window.__jideLockAudit.exposed), 0, 'deep-link refresh never exposes the underlying screen before unlock');
      assert.equal(await page.getByRole('button', { name: '返回', exact: true }).count(), 0, 'locked content is excluded from accessible navigation');
      assert.equal(await page.locator('[inert]').evaluate(el => getComputedStyle(el).opacity), '0');
      for (let i = 0; i < 14; i++) {
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => !!document.activeElement?.closest('[inert]')), false, 'keyboard focus cannot enter locked content');
      }
      await page.screenshot({ path: `${out}/app-lock-dark-xlarge-390.png` });
      for (const digit of ['1', '2', '3', '4']) await page.getByText(digit, { exact: true }).click();
      await page.getByRole('dialog', { name: '应用锁' }).waitFor({ state: 'hidden' });
      assert.equal(await page.locator('[inert]').count(), 0, 'unlock restores interaction');
      report.push({ case: 'deep-link-app-lock', observedFrames: 40, keyboardTabs: 14, result: 'pass' });
    }
    assert.deepEqual(errors, [], 'no JavaScript errors');
    report.push({ viewport, fontStats, errors, result: 'pass' });
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.route('**/*.woff2', route => route.abort());
  const started = Date.now();
  await page.goto(baseURL);
  await page.getByRole('button', { name: '下一步', exact: true }).waitFor({ timeout: 6000 });
  report.push({ case: 'fonts-unavailable', result: 'pass', interactiveMs: Date.now() - started });
  await page.screenshot({ path: `${out}/font-fallback.png` });
  await context.close();
} catch (error) {
  report.push({ result: 'fail', message: error instanceof Error ? error.message : String(error) });
  throw error;
} finally {
  await browser.close();
  await writeFile(`${out}/${scenario === 'extended' ? 'extended-report' : 'report'}.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
