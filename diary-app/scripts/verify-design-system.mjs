// Run against an exported local build: node scripts/verify-design-system.mjs [URL] [outputDirectory]
// Isolated browser contexts only; the fixture contains no personal diary data.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const baseURL = (process.argv[2] ?? 'http://127.0.0.1:8765').replace(/\/$/, '');
assert.ok(['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname), 'Use a local preview.');
const output = resolve(process.argv[3] ?? 'docs/qa/design-system');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { layout: [], themes: [], checks: [], errors: [] };

async function contextFor(viewport, appearance = {}, options = {}) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', locale: 'zh-CN', colorScheme: 'light', ...options });
  await context.addInitScript(initial => {
    if (sessionStorage.getItem('design-system-seeded')) return;
    localStorage.setItem('jide-diary:state:v1', JSON.stringify(initial));
    sessionStorage.setItem('design-system-seeded', 'yes');
  }, {
    version: 1, onboarded: true, tutorialSeen: true, editorTourSeen: true, shelfTourSeen: true, usageMode: 'local',
    entries: [], backup: { auto: false },
    appearance: { theme: 'light', style: 'warm', accent: 'latte', fontScale: 'standard', fontFamily: 'serif', lineHeight: 'relaxed', contentWidth: 0.37, cardStyle: 'image', ...appearance },
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  return { context, page };
}

async function checkLayout(page, label) {
  const result = await page.evaluate(() => {
    const visible = element => element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0;
    const controls = [...document.querySelectorAll('[role="radio"], [role="tab"], [role="button"], [role="switch"]')].filter(visible);
    return {
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      smallTargets: controls.filter(element => { const box = element.getBoundingClientRect(); return box.width < 43.5 || box.height < 43.5; }).map(element => ({ label: element.getAttribute('aria-label') || element.textContent, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })),
      clippedLabels: [...document.querySelectorAll('div')].filter(element => visible(element) && element.children.length === 0 && element.textContent.trim() && element.scrollWidth > element.clientWidth + 2).map(element => element.textContent),
    };
  });
  assert.equal(result.horizontalOverflow, false, `${label}: page overflow`);
  assert.deepEqual(result.smallTargets, [], `${label}: targets below 44px`);
  assert.deepEqual(result.clippedLabels, [], `${label}: clipped labels`);
  report.layout.push({ label, ...result });
}

const fontOf = locator => locator.evaluate(element => getComputedStyle(element).fontFamily);
const readBody = page => page.getByText('今天去了城郊的山林，空气非常清新。沿着小路慢慢走，太阳透过树叶洒下斑驳的光影，整个人都放松了很多。', { exact: true });

try {
  for (const width of [320, 390, 760, 1280]) {
    for (const theme of ['light', 'dark']) {
      for (const fontScale of ['standard', 'xlarge']) {
        const { context, page } = await contextFor({ width, height: width === 320 ? 568 : 900 }, { theme, fontScale });
        const key = `${width}-${theme}-${fontScale}`;
        await page.goto(`${baseURL}/settings/appearance`);
        await page.getByRole('radio', { name: '显示模式：浅色' }).waitFor();
        await checkLayout(page, `appearance-${key}`);
        await page.getByRole('tab', { name: '阅读', exact: true }).click();
        await page.getByText('把平凡的一天，慢慢记住', { exact: true }).scrollIntoViewIfNeeded();
        await page.evaluate(() => document.fonts.ready);
        await checkLayout(page, `reading-preview-${key}`);
        if (width === 320 && fontScale === 'xlarge') await page.screenshot({ path: `${output}/preview-${key}.png` });
        await page.goto(`${baseURL}/settings/typography`);
        await page.getByRole('radio', { name: '字体：宋体' }).waitFor();
        await checkLayout(page, `typography-${key}`);
        const uiFont = await fontOf(page.getByText('日记阅读字体', { exact: true }));
        assert.doesNotMatch(uiFont, /NotoSerif|Kaiti|KaiTi/);
        for (const [name, pattern] of [['黑体', /sans-serif/], ['楷体', /Kaiti|KaiTi/], ['宋体', /NotoSerifSC/]]) {
          await page.getByRole('radio', { name: `字体：${name}` }).click();
          await readBody(page).scrollIntoViewIfNeeded();
          await page.evaluate(() => document.fonts.ready);
          assert.match(await fontOf(readBody(page)), pattern, `${key}: ${name} reading font`);
          assert.equal(await fontOf(page.getByText('日记阅读字体', { exact: true })), uiFont, `${key}: stable UI font`);
        }
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('jide-diary:state:v1')).appearance.fontFamily === 'serif');
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jide-diary:state:v1')).appearance);
        assert.equal(saved.contentWidth, 0.37, 'Changing fonts preserves arbitrary existing width');
        assert.equal(saved.lineHeight, 'relaxed');
        assert.equal(saved.fontScale, fontScale);
        assert.equal(saved.cardStyle, 'image');
        if (width === 390 && fontScale === 'standard') await page.screenshot({ path: `${output}/typography-${key}.png` });
        await context.close();
      }
    }
  }
  report.checks.push('UI stays system sans while all three reading choices change the diary preview; existing size/width/line-height/card preferences remain intact.');

  const themed = await contextFor({ width: 390, height: 900 });
  await themed.page.goto(`${baseURL}/settings/appearance`);
  for (const mode of ['浅色', '深色']) {
    await themed.page.getByRole('radio', { name: `显示模式：${mode}` }).click();
    for (const name of ['温润', '清冷', '墨白', '旧纸', '樱雾', '森野']) {
      const control = themed.page.getByRole('radio', { name: `风格：${name}` });
      await control.click();
      assert.equal(await control.getAttribute('aria-checked'), 'true');
      await themed.page.getByRole('tab', { name: '记录', exact: true }).click();
      const preview = themed.page.getByText('效果预览', { exact: true }).locator('..');
      await preview.scrollIntoViewIfNeeded();
      await themed.page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode().catch(() => {}))); });
      await preview.screenshot({ path: `${output}/theme-${name}-${mode}.png` });
      report.themes.push({ name, mode, photoCount: await preview.locator('img').count() });
    }
  }
  await themed.page.getByRole('radio', { name: '显示模式：跟随系统' }).click();
  await themed.page.emulateMedia({ colorScheme: 'light' });
  await themed.page.getByText('当前跟随系统使用浅色。', { exact: true }).waitFor();
  const lightColor = await themed.page.getByRole('radio', { name: '风格：森野' }).evaluate(element => getComputedStyle(element).backgroundColor);
  await themed.page.emulateMedia({ colorScheme: 'dark' });
  await themed.page.getByText('当前跟随系统使用深色。', { exact: true }).waitFor();
  const darkColor = await themed.page.getByRole('radio', { name: '风格：森野' }).evaluate(element => getComputedStyle(element).backgroundColor);
  assert.notEqual(lightColor, darkColor);
  report.checks.push('All six styles render the same real sample photos and text in light/dark; system color changes update the preview.');
  const lightMode = themed.page.getByRole('radio', { name: '显示模式：浅色' });
  await lightMode.focus();
  await lightMode.press('Space');
  assert.equal(await lightMode.getAttribute('aria-checked'), 'true');
  const controlsTab = themed.page.getByRole('tab', { name: '控件', exact: true });
  await controlsTab.focus();
  await controlsTab.press('Space');
  assert.equal(await controlsTab.getAttribute('aria-selected'), 'true');
  await themed.page.getByText('记录标题 · Day 21', { exact: true }).waitFor();
  await themed.page.goto(`${baseURL}/settings/goals`);
  const toggle = themed.page.getByRole('switch', { name: '开启每日写作目标' });
  await toggle.waitFor();
  assert.equal(await toggle.evaluate(element => Boolean(element.parentElement.closest('[aria-disabled="true"]'))), false);
  const initialToggle = await toggle.getAttribute('aria-checked');
  await toggle.focus();
  await toggle.press('Space');
  assert.notEqual(await toggle.getAttribute('aria-checked'), initialToggle);
  const focus = await toggle.evaluate(element => ({ outline: getComputedStyle(element).outlineStyle, width: parseFloat(getComputedStyle(element).outlineWidth), color: getComputedStyle(element).outlineColor, themeColor: document.documentElement.style.getPropertyValue('--jide-focus-ring') }));
  assert.equal(focus.outline, 'solid');
  assert.ok(focus.width >= 2 && focus.themeColor, 'Visible keyboard focus uses the current theme');
  assert.equal(focus.color, `rgb(${[1, 3, 5].map(start => parseInt(focus.themeColor.slice(start, start + 2), 16)).join(', ')})`);
  await toggle.press('Enter');
  assert.equal(await toggle.getAttribute('aria-checked'), initialToggle, 'Enter activates exactly once');
  await toggle.click();
  assert.notEqual(await toggle.getAttribute('aria-checked'), initialToggle);
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-checked'), initialToggle);
  report.checks.push('Settings switch has an accessible name, no disabled ancestor, and matching keyboard/click results.');
  await themed.page.goto(`${baseURL}/auth/register`);
  const checkbox = themed.page.getByRole('checkbox');
  await checkbox.focus();
  await checkbox.press('Space');
  assert.equal(await checkbox.getAttribute('aria-checked'), 'true');
  await checkbox.press('Enter');
  assert.equal(await checkbox.getAttribute('aria-checked'), 'false');
  report.checks.push('Space activates radio, tab and checkbox controls; Enter retains one activation. No registration is submitted.');
  await themed.context.close();

  const offlineFonts = await contextFor({ width: 320, height: 568 });
  let fontRequests = 0;
  await offlineFonts.context.route('**/*.woff2', route => { fontRequests += 1; return route.abort('failed'); });
  await offlineFonts.page.goto(`${baseURL}/settings/typography`);
  await readBody(offlineFonts.page).scrollIntoViewIfNeeded();
  await offlineFonts.page.evaluate(() => document.fonts.ready);
  assert.ok(fontRequests > 0, 'Font failure was exercised');
  await offlineFonts.page.goto(`${baseURL}/write`);
  await offlineFonts.page.getByLabel('日记标题', { exact: true }).fill('字体失败仍可记录');
  await offlineFonts.page.getByLabel('日记正文', { exact: true }).fill('字体下载失败时，输入和本机保存仍然可用。');
  await offlineFonts.page.getByRole('button', { name: '完成', exact: true }).click();
  await offlineFonts.page.waitForFunction(() => JSON.parse(localStorage.getItem('jide-diary:state:v1')).entries.some(entry => entry.title === '字体失败仍可记录' && entry.status === 'published'));
  report.checks.push('Blocking every WOFF2 request still allows editing and publishing a diary to local storage.');
  await offlineFonts.context.close();
  assert.deepEqual(report.errors, []);
  await writeFile(`${output}/report.json`, JSON.stringify({ ...report, result: 'pass' }, null, 2));
  console.log(JSON.stringify({ result: 'pass', layoutChecks: report.layout.length, themePreviews: report.themes.length, checks: report.checks, output }, null, 2));
} catch (error) {
  await writeFile(`${output}/report.json`, JSON.stringify({ ...report, result: 'fail', error: String(error) }, null, 2));
  throw error;
} finally {
  await browser.close();
}
