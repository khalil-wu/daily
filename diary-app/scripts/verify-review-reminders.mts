/** Review, annual calendar and truthful web reminder regression; disposable local data only. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { defaultState, normalizeEntry } from '../src/store/storage';
import { dayKey } from '../src/utils/date';

const base = 'http://127.0.0.1:8765';
const out = 'docs/qa/review-reminders';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const checks: string[] = [];
const errors: string[] = [];
const now = new Date();
const recent = new Date(now.getFullYear(), now.getMonth() - 1, Math.min(now.getDate(), 28), 12).getTime();
const older = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate(), 12).getTime();
const date = dayKey(recent);
const initial = { ...defaultState(), onboarded: true, tutorialSeen: true, editorTourSeen: true, shelfTourSeen: true, usageMode: 'local', backup: { auto: false }, entries: [
  normalizeEntry({ id: 'recent-memory', title: '近年的公开回忆', body: '用于日期与回忆范围验收的合成内容。', createdAt: recent, status: 'published' }),
  normalizeEntry({ id: 'same-day', title: '同一天另一篇', createdAt: recent + 3600000, status: 'published' }),
  normalizeEntry({ id: 'old-memory', title: '更早的公开回忆', createdAt: older, status: 'published' }),
  normalizeEntry({ id: 'excluded-memory', title: '不想回顾的工作', tags: ['work'], createdAt: older + 86400000, status: 'published' }),
  normalizeEntry({ id: 'hidden-memory', title: '隐藏内容不应展示', createdAt: recent, status: 'published', hidden: true }),
  normalizeEntry({ id: 'draft-memory', title: '草稿内容不应展示', createdAt: recent, status: 'draft' }),
] };
try {
  for (const width of [390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 844 }, reducedMotion: 'reduce', locale: 'zh-CN' });
    await context.addInitScript(seed => {
      if (sessionStorage.getItem('review-seeded')) return;
      localStorage.setItem('jide-diary:state:v1', JSON.stringify(seed));
      sessionStorage.setItem('review-seeded', 'yes');
    }, { ...initial, appearance: { ...initial.appearance, ...(width === 320 ? { theme: 'dark', fontScale: 'xlarge' } : {}) } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(12000);
    // 旧的年度报告链接会跳到「回顾 · 年」；点那一行钻进月视图，再点日期看当天原文
    await page.goto(`${base}/annual-report?year=${new Date(recent).getFullYear()}`);
    await page.waitForURL('**/review**');
    assert.equal(await page.getByRole('tab', { name: '年', exact: true }).getAttribute('aria-selected'), 'true');
    const monthNo = new Date(recent).getMonth() + 1;
    await page.getByRole('button', { name: new RegExp(`^${monthNo}月，记录了 \\d+ 天，查看这个月$`) }).click();
    assert.equal(await page.getByRole('tab', { name: '月', exact: true }).getAttribute('aria-selected'), 'true');
    const dayLabel = `${monthNo}月${new Date(recent).getDate()}日`;
    const day = page.getByRole('button', { name: new RegExp(`^${dayLabel}，2 篇`) });
    const box = await day.boundingBox();
    assert.ok(box && box.height >= 34, `month cell must stay comfortably tappable: ${JSON.stringify(box)}`);
    await day.click();
    const dialog = page.getByRole('dialog', { name: dayLabel, exact: true });
    await dialog.waitFor();
    assert.equal(await dialog.getByRole('button', { name: /近年的公开回忆|同一天另一篇/ }).count(), 2);
    assert.equal(await dialog.getByText(/隐藏内容|草稿内容/).count(), 0);
    await page.screenshot({ path: `${out}/annual-day-${width}.png` });
    await dialog.getByRole('button', { name: /近年的公开回忆$/ }).click();
    await page.waitForURL('**/memory/recent-memory');
    await page.getByText('用于日期与回忆范围验收的合成内容。', { exact: true }).waitFor();
    checks.push(`${width}px 年 → 月 → 日逐级查看，同日原文列出并过滤私密与草稿`);

    await page.goto(base + '/review');
    await page.getByRole('button', { name: '设置回忆范围', exact: true }).click();
    const range = page.getByRole('dialog', { name: '回忆范围', exact: true });
    await range.getByRole('radio', { name: '一年以前', exact: true }).click();
    const tag = range.getByRole('checkbox', { name: '排除标签：工作', exact: true });
    await tag.focus(); await page.keyboard.press('Space');
    assert.equal(await tag.getAttribute('aria-checked'), 'true');
    await range.getByRole('button', { name: '完成', exact: true }).click();
    await page.getByText('更早的公开回忆', { exact: true }).waitFor();
    assert.equal(await page.getByText('近年的公开回忆', { exact: true }).count(), 0);
    assert.equal(await page.getByText('不想回顾的工作', { exact: true }).count(), 0);
    assert.equal(await page.getByText('隐藏内容不应展示', { exact: true }).count(), 0);
    await page.screenshot({ path: `${out}/memory-range-${width}.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    checks.push(`${width}px 往事按时间和排除标签实际筛选，键盘操作生效`);

    await page.goto(base + '/settings/reminders');
    await page.getByText('当前网页不支持后台定时通知。这里保存 App 的提醒偏好，预览仅在页面内显示。', { exact: true }).waitFor();
    await page.getByRole('switch', { name: /App 每日提醒/ }).click();
    await page.getByText('偏好已保存；网页不支持后台定时提醒', { exact: true }).waitFor();
    await page.goto(base + '/settings/reminder-time');
    const custom = page.getByRole('radio', { name: '自定义', exact: true });
    await custom.focus(); await page.keyboard.press('Space');
    assert.equal(await custom.getAttribute('aria-checked'), 'true');
    const sunday = page.getByRole('checkbox', { name: '星期日', exact: true });
    await sunday.focus(); await page.keyboard.press('Space');
    assert.equal(await sunday.getAttribute('aria-checked'), 'false');
    await page.getByRole('button', { name: '确定', exact: true }).click();
    await page.waitForFunction(() => {
      const reminders = JSON.parse(localStorage.getItem('jide-diary:state:v1') || '{}').reminders;
      return reminders?.repeat === 'custom' && !reminders.days.includes(0);
    });
    checks.push(`${width}px 网页提醒说明与成功提示真实，自定义星期可用键盘修改并持久化`);
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(`${out}/report.json`, JSON.stringify({ passed: true, checks, errors }, null, 2));
  console.log(JSON.stringify({ passed: true, checks, errors }, null, 2));
} catch (error) {
  await writeFile(`${out}/report.json`, JSON.stringify({ passed: false, checks, errors, failure: String(error) }, null, 2));
  throw error;
} finally { await browser.close(); }
