import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { defaultState } from '../src/store/storage';
import { actions } from '../src/store/store';

const base = 'http://127.0.0.1:8765';
const browser = await chromium.launch({ headless: true });
const checks: string[] = [];
const errors: string[] = [];
await mkdir('docs/qa/editor-workflows', { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', locale: 'zh-CN' });
  const state = { ...defaultState(), onboarded: true, tutorialSeen: true, editorTourSeen: true, shelfTourSeen: true, usageMode: 'local', backup: { auto: false } };
  state.entries = [actions.newEntry({ id: 'workflow', title: '保留原有标题', body: '保留原有正文', status: 'published', photos: ['asset:photo-sky', 'asset:photo-lake'], place: { name: '原有地点', latitude: 31.2, longitude: 121.5 } })];
  await context.addInitScript(initial => {
    if (!sessionStorage.getItem('workflow-seeded')) {
      localStorage.setItem('jide-diary:state:v1', JSON.stringify(initial));
      sessionStorage.setItem('workflow-seeded', 'yes');
    }
  }, state);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/write?id=workflow`);
  await page.getByLabel('日记正文', { exact: true }).waitFor();
  await page.getByText('模板', { exact: true }).click();
  const preview = page.getByRole('button', { name: /^预览/ }).first();
  await preview.click();
  await page.getByText('模板会追加到现有正文末尾，并保留你已填写的标题。', { exact: true }).waitFor();
  await page.screenshot({ path: 'docs/qa/editor-workflows/template-preview.png' });
  await page.getByRole('button', { name: '追加到正文', exact: true }).click();
  await page.getByLabel('日记正文', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('日记标题', { exact: true }).inputValue(), '保留原有标题');
  assert.ok((await page.getByLabel('日记正文', { exact: true }).inputValue()).startsWith('保留原有正文\n\n'));
  checks.push('模板先预览，追加正文且保留已有标题');

  await page.getByRole('button', { name: '图片', exact: true }).click();
  const firstPhoto = page.getByRole('checkbox', { name: '照片 1', exact: true });
  await firstPhoto.focus();
  await page.keyboard.press('Space');
  assert.equal(await firstPhoto.getAttribute('aria-checked'), 'false');
  await page.getByRole('button', { name: '完成 (1)', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('jide-diary:state:v1') || '{}').entries.find((e: { id: string }) => e.id === 'workflow')?.photos.length === 1);
  const remaining = await page.evaluate(() => JSON.parse(localStorage.getItem('jide-diary:state:v1') || '{}').entries.find((e: { id: string }) => e.id === 'workflow').photos);
  assert.deepEqual(remaining, ['asset:photo-lake']);
  checks.push('取消勾选后完整替换照片选择，保留照片顺序');

  await page.getByRole('button', { name: '图片', exact: true }).click();
  assert.equal(await page.getByText('最近项目', { exact: true }).count(), 0);
  await page.getByText('示例素材', { exact: true }).click();
  await page.getByText('应用内置的风景素材，可自行选用。', { exact: true }).waitFor();
  await page.getByRole('checkbox', { name: '示例素材 1', exact: true }).waitFor();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '从设备选择', exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(Array.from({ length: 20 }, (_, index) => ({ name: `qa-photo-${index}.png`, mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jKCcAAAAASUVORK5CYII=', 'base64') })));
  await page.getByRole('button', { name: '完成 (21)', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('jide-diary:state:v1') || '{}').entries.find((e: { id: string }) => e.id === 'workflow')?.photos.filter((uri: string) => uri.startsWith('idb:photo/')).length === 20);
  await page.reload();
  await page.getByLabel('日记正文', { exact: true }).waitFor();
  const reloadedPhotos = await page.evaluate(() => JSON.parse(localStorage.getItem('jide-diary:state:v1') || '{}').entries.find((e: { id: string }) => e.id === 'workflow').photos);
  assert.equal(reloadedPhotos.length, 21);
  checks.push('示例素材来源明确，20 张设备照片真实写入持久化存储并重载');

  await page.evaluate(`Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (_success, failure) => failure({ code: 1, message: 'QA permission denied' }) } })`);
  await page.getByText('原有地点', { exact: true }).click();
  await page.getByRole('button', { name: /使用当前位置/ }).click();
  await page.getByText(/权限|允许|定位失败/).first().waitFor();
  assert.ok(await page.getByText('原有地点', { exact: true }).count());
  assert.equal(await page.getByText(/西湖|距你|附近推荐/).count(), 0);
  checks.push('定位拒绝保留原地点，没有伪造推荐地点或距离');

  await page.addInitScript(() => { Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined }); });
  await page.goto(`${base}/settings/help`);
  const feedback = page.getByLabel('反馈内容', { exact: true });
  await feedback.fill('QA：这条反馈应保留到服务确认。');
  await page.route('**/api/feedback', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '测试服务暂时不可用' }) }));
  await page.getByRole('button', { name: '提交反馈', exact: true }).click();
  await page.getByText('测试服务暂时不可用', { exact: true }).waitFor();
  await page.reload();
  await page.waitForFunction(() => document.querySelector('textarea[aria-label="反馈内容"]')?.value === 'QA：这条反馈应保留到服务确认。');
  assert.equal(await feedback.inputValue(), 'QA：这条反馈应保留到服务确认。');
  const ids: string[] = [];
  await page.unroute('**/api/feedback');
  await page.route('**/api/feedback', route => {
    const data = route.request().postDataJSON(); ids.push(data.id);
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ received: true, id: data.id }) });
  });
  await page.getByRole('button', { name: '提交反馈', exact: true }).click();
  await page.getByText(/反馈已提交，编号/).waitFor();
  assert.equal(await feedback.inputValue(), '');
  assert.equal(ids.length, 1);
  checks.push('反馈失败保留输入并可刷新恢复，服务确认后才清空');
  await page.getByText('写作页导览', { exact: true }).click();
  await page.getByText('跳过', { exact: true }).filter({ visible: true }).last().waitFor();
  checks.push('已看过教程的用户仍可从帮助页重开写作导览');
  await context.close();
  assert.deepEqual(errors, []);
} catch (error) {
  await writeFile('docs/qa/editor-workflows/report.json', JSON.stringify({ passed: false, checks, errors, failure: String(error) }, null, 2));
  throw error;
} finally { await browser.close(); }
await writeFile('docs/qa/editor-workflows/report.json', JSON.stringify({ passed: true, checks, errors }, null, 2));
console.log(JSON.stringify({ passed: true, checks, errors }, null, 2));
