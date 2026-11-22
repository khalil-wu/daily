/** Run against a local web export: node --import tsx scripts/verify-interactions.mts */
import assert from 'node:assert/strict';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { defaultState } from '../src/store/storage';
import { actions } from '../src/store/store';
import { sha256 } from '../src/utils/text';
import type { AppState } from '../src/store/types';

const baseURL = process.env.DIARY_TEST_URL || 'http://127.0.0.1:8765';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname), 'Use a local preview for seeded test data.');
const browser = await chromium.launch({ headless: true });
const errors: string[] = [];
const results: string[] = [];

function seedState(): AppState {
  return { ...defaultState(), onboarded: true, tutorialSeen: true, editorTourSeen: true, shelfTourSeen: true, usageMode: 'local', backup: { auto: false } };
}

async function seededContext(state: AppState): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', locale: 'zh-CN' });
  await context.addInitScript(initial => {
    if (!sessionStorage.getItem('interaction-tests-seeded')) {
      localStorage.setItem('jide-diary:state:v1', JSON.stringify(initial));
      sessionStorage.setItem('interaction-tests-seeded', 'yes');
    }
  }, state);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return { context, page };
}

async function readEntries(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('jide-diary:state:v1') || '{}').entries || []);
}

async function waitEntry(page: Page, title: string) {
  await page.waitForFunction(title => (JSON.parse(localStorage.getItem('jide-diary:state:v1') || '{}').entries || []).some((entry: { title: string }) => entry.title === title), title);
}

async function enterPin(page: Page) {
  for (const number of ['1', '2', '3', '4']) await page.getByText(number, { exact: true }).last().click();
}

try {
  const state = seedState();
  state.entries = [
    actions.newEntry({ id: 'existing', title: '验收日记', body: '原来的正文', status: 'published', favorite: true }),
    actions.newEntry({ id: 'hidden', title: '隐藏验收内容', body: '不应出现在收藏或草稿', hidden: true, favorite: true, status: 'draft' }),
  ];
  state.recentSearches = ['需要删除的记录'];
  const { context, page } = await seededContext(state);
  await page.goto(baseURL);
  await page.getByRole('button', { name: /^日记本 全部日记/ }).click();
  await page.getByRole('button', { name: '新建日记', exact: true }).click();
  await page.getByText('写日记', { exact: true }).click();
  await page.getByLabel('日记标题', { exact: true }).fill('快速返回草稿');
  await page.getByLabel('日记正文', { exact: true }).fill('这一段在防抖保存前立刻返回');
  await page.goBack();
  await waitEntry(page, '快速返回草稿');
  assert.equal((await readEntries(page)).find((entry: { title: string }) => entry.title === '快速返回草稿').status, 'draft');
  results.push('系统返回保存最后输入');

  await page.goto(`${baseURL}/write`);
  await page.getByLabel('日记标题', { exact: true }).fill('立即刷新草稿');
  await page.getByLabel('日记正文', { exact: true }).fill('这一段刷新后应当保留');
  await page.reload();
  await waitEntry(page, '立即刷新草稿');
  results.push('立即刷新保留输入');

  await page.goto(`${baseURL}/write?id=existing`);
  await page.getByLabel('日记正文', { exact: true }).fill('保存后的正文');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await page.waitForURL(url => url.pathname !== '/write');
  let saved = (await readEntries(page)).find((entry: { id: string }) => entry.id === 'existing');
  assert.equal(saved.status, 'published');
  assert.equal(saved.body, '保存后的正文');
  results.push('保存编辑保留已发布状态');

  await page.goto(`${baseURL}/write?id=existing`);
  await page.getByLabel('日记正文', { exact: true }).fill('需要丢弃的改动');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('jide-diary:state:v1') || '{}').entries.some((entry: { id: string; body: string }) => entry.id === 'existing' && entry.body === '需要丢弃的改动'));
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '不保存', exact: true }).click();
  await page.waitForURL(url => url.pathname !== '/write');
  saved = (await readEntries(page)).find((entry: { id: string }) => entry.id === 'existing');
  assert.equal(saved.body, '保存后的正文');
  results.push('放弃编辑还原自动保存前的内容');

  await page.goto(`${baseURL}/favorites`);
  await page.getByText('验收日记', { exact: true }).waitFor();
  assert.equal(await page.getByText('隐藏验收内容', { exact: true }).count(), 0);
  await page.goto(`${baseURL}/drafts`);
  await page.getByText('快速返回草稿', { exact: true }).waitFor();
  assert.equal(await page.getByText('隐藏验收内容', { exact: true }).count(), 0);
  results.push('收藏和草稿不泄漏隐藏内容');

  await page.goto(`${baseURL}/search`);
  await page.getByRole('button', { name: '删除搜索记录：需要删除的记录', exact: true }).click();
  assert.equal(await page.getByRole('textbox').inputValue(), '');
  assert.equal(await page.getByText('需要删除的记录', { exact: true }).count(), 0);
  await page.getByRole('textbox').fill('验收');
  await page.getByRole('button', { name: /验收日记/ }).waitFor();
  results.push('搜索记录删除不触发父级搜索，关键词结果可打开');

  await page.goto(baseURL);
  const expand = page.getByRole('button', { name: '展开今日卡片', exact: true });
  if (await expand.count()) await expand.click();
  await page.getByRole('button', { name: '换一个写作灵感', exact: true }).click();
  assert.equal(new URL(page.url()).pathname, '/shelf');
  results.push('更换灵感只更新题目，不误触新建日记');
  await context.close();

  const failure = await seededContext(seedState());
  await failure.page.goto(`${baseURL}/write`);
  await failure.page.getByLabel('日记标题', { exact: true }).fill('存储空间不足测试');
  await failure.page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'jide-diary:state:v1') throw new DOMException('Test quota exceeded', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await failure.page.getByRole('button', { name: '完成', exact: true }).click();
  await failure.page.getByText('日记尚未保存到设备，请释放存储空间后重试', { exact: true }).first().waitFor();
  assert.equal(new URL(failure.page.url()).pathname, '/write');
  assert.equal(await failure.page.getByLabel('日记标题', { exact: true }).inputValue(), '存储空间不足测试');
  results.push('存储失败保留编辑内容，显示失败且不跳转成功页');
  await failure.context.close();

  const privateState = seedState();
  privateState.privacy = { ...privateState.privacy, appLock: true, lockHidden: true, passcodeHash: await sha256('1234') };
  privateState.entries = [actions.newEntry({ id: 'private', hidden: true, status: 'published', title: '深链保护验收', body: '验证通过后才挂载这段内容' })];
  const secured = await seededContext(privateState);
  await secured.page.goto(`${baseURL}/memory/private`);
  await secured.page.getByText('请输入应用锁密码', { exact: true }).waitFor();
  assert.equal(await secured.page.getByText('验证通过后才挂载这段内容', { exact: true }).count(), 0);
  await enterPin(secured.page);
  await secured.page.getByText('验证身份查看隐藏日记', { exact: true }).waitFor();
  await enterPin(secured.page);
  await secured.page.getByText('验证通过后才挂载这段内容', { exact: true }).waitFor();
  await secured.page.goto(`${baseURL}/write?id=private`);
  await secured.page.getByText('请输入应用锁密码', { exact: true }).waitFor();
  assert.equal(await secured.page.getByLabel('日记正文', { exact: true }).count(), 0);
  await enterPin(secured.page);
  await enterPin(secured.page);
  await secured.page.getByLabel('日记正文', { exact: true }).waitFor();
  results.push('隐藏详情与编辑深链先验证后挂载，刷新不保留授权');
  await secured.context.close();

  const trashState = seedState();
  trashState.privacy = privateState.privacy;
  trashState.entries = [{ ...privateState.entries[0], deletedAt: Date.now() }];
  const trash = await seededContext(trashState);
  await trash.page.goto(`${baseURL}/trash`);
  await trash.page.getByText('请输入应用锁密码', { exact: true }).waitFor();
  await enterPin(trash.page);
  await trash.page.getByText('验证身份查看隐藏日记', { exact: true }).waitFor();
  assert.equal(await trash.page.getByText('深链保护验收', { exact: true }).count(), 0);
  await enterPin(trash.page);
  await trash.page.getByText('深链保护验收', { exact: true }).waitFor();
  results.push('含隐藏日记的回收站同样需验证');
  await trash.context.close();

  const largeState = seedState();
  largeState.entries = Array.from({ length: 5000 }, (_, index) => actions.newEntry({ id: `large-${index}`, title: `长列表日记 ${index}`, body: '长列表回归数据', createdAt: Date.now() - index * 86400000, status: 'published' }));
  const large = await seededContext(largeState);
  await large.page.goto(`${baseURL}/review`);
  await large.page.getByRole('tab', { name: '时间线', exact: true }).click();
  await large.page.getByRole('button', { name: /长列表日记 0$/ }).waitFor();
  const mounted = await large.page.getByRole('button', { name: /长列表日记/ }).count();
  assert.ok(mounted < 100, `Expected virtualized timeline, mounted ${mounted} entries`);
  results.push(`5000 篇时间线仅挂载 ${mounted} 个可视附近条目`);
  await large.context.close();

  assert.deepEqual(errors, [], `Browser runtime errors: ${errors.join('; ')}`);
  console.log(JSON.stringify({ passed: results.length, results, runtimeErrors: errors }, null, 2));
} finally {
  await browser.close();
}
