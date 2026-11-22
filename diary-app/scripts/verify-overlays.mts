/** Modal, keyboard, narrow-screen and media virtualization regression checks. Local preview only. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, type Page, type Locator } from 'playwright';
import { defaultState } from '../src/store/storage';
import { actions } from '../src/store/store';
import type { AppState } from '../src/store/types';

const baseURL = process.env.DIARY_TEST_URL || 'http://127.0.0.1:8765';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname), 'Use a local preview for seeded data.');
const output = 'docs/qa/overlays';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results: { check: string; detail?: unknown }[] = [];
const errors: string[] = [];
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=';
function state(): AppState {
  const initial = { ...defaultState(), onboarded: true, tutorialSeen: true, editorTourSeen: true, usageMode: 'local' as const, backup: { auto: false } };
  initial.people = [{ id: 'overlay-person', name: '小林', aliases: [], relation: 'friend', birthday: '03-08', color: '#9B785C', createdAt: Date.now() }];
  initial.entries = [actions.newEntry({ id: 'overlay-entry', title: '浮层验收日记', body: '用于回归验证的合成内容', status: 'published', people: ['overlay-person'], photos: [image], createdAt: new Date(2026, 10, 20, 15, 24).getTime() }), actions.newEntry({ id: 'overlay-photo-entry', title: '另一篇照片日记', body: '同一照片可关联不同日记', status: 'published', photos: [image], createdAt: new Date(2026, 10, 19, 15, 24).getTime() })];
  return initial;
}
async function context(initial: AppState, narrow = false) {
  const c = await browser.newContext({ viewport: narrow ? { width: 320, height: 568 } : { width: 390, height: 844 }, reducedMotion: 'reduce', locale: 'zh-CN' });
  await c.addInitScript(seed => {
    if (!sessionStorage.getItem('overlay-seeded')) {
      localStorage.setItem('jide-diary:state:v1', JSON.stringify(seed));
      sessionStorage.setItem('overlay-seeded', 'yes');
    }
  }, initial);
  const page = await c.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(10000);
  return { c, page };
}
async function dialog(page: Page, name: string) {
  const d = page.getByRole('dialog', { name, exact: true });
  await d.waitFor();
  assert.equal(await page.locator('[role="dialog"]').count(), 1, 'One modal must expose exactly one named dialog');
  await page.waitForFunction(() => document.querySelector('#root')?.hasAttribute('inert') || document.querySelector('#root')?.closest('[inert]'));
  return d;
}
async function reachable(action: Locator, page: Page) {
  const bounds = await action.boundingBox();
  assert.ok(bounds && bounds.y >= 0 && bounds.x >= 0 && bounds.y + bounds.height <= page.viewportSize()!.height && bounds.x + bounds.width <= page.viewportSize()!.width, 'Action must be fully within the viewport');
  assert.ok(bounds.height >= 44, 'Action must have a minimum 44px touch height');
}
try {
  const regular = await context(state());
  const p = regular.page;
  await p.goto(baseURL + '/picker/tags');
  const study = p.getByRole('checkbox', { name: '学习', exact: true });
  await study.focus();
  await p.keyboard.press('Space');
  assert.equal(await study.getAttribute('aria-checked'), 'true');
  const trigger = p.getByRole('button', { name: '新建标签', exact: true });
  await trigger.focus();
  await trigger.click();
  const tags = await dialog(p, '新建标签');
  await tags.getByRole('button', { name: '创建标签', exact: true }).click();
  await tags.getByRole('alert').filter({ hasText: '请输入标签名称' }).waitFor();
  await tags.getByLabel('标签名称', { exact: true }).fill('清晨散步');
  assert.equal(await tags.getByRole('alert').count(), 0);
  for (let index = 0; index < 25; index++) {
    await p.keyboard.press('Tab');
    assert.ok(await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), 'Tab must remain inside the dialog');
  }
  await p.screenshot({ path: output + '/tag-dialog.png' });
  await p.keyboard.press('Escape');
  await tags.waitFor({ state: 'detached' });
  await p.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '新建标签');
  assert.equal(await p.locator('#root[inert]').count(), 0);
  results.push({ check: '标签错误就地展示；唯一命名浮层；Tab 不离开；Escape 关闭并返回原焦点' });

  await p.goto(baseURL + '/notebooks');
  await p.getByRole('button', { name: '新建日记本', exact: true }).click();
  const notebook = await dialog(p, '新建日记本');
  await notebook.getByRole('button', { name: '创建日记本', exact: true }).click();
  await notebook.getByRole('alert').filter({ hasText: '请输入日记本名称' }).waitFor();
  await notebook.getByLabel('日记本名称', { exact: true }).fill('验收笔记');
  await notebook.getByRole('button', { name: '创建日记本', exact: true }).click();
  await notebook.waitFor({ state: 'detached' });
  await p.getByText('验收笔记', { exact: true }).waitFor();
  results.push({ check: '日记本空名称就地校验，填写后可正常创建' });

  await p.goto(baseURL + '/picker/people');
  await p.getByRole('button', { name: '记下一个人', exact: true }).click();
  const people = await dialog(p, '记下一个人');
  await people.getByRole('button', { name: '记下了', exact: true }).click();
  await people.getByRole('alert').filter({ hasText: '请输入名字' }).waitFor();
  await people.getByLabel('名字', { exact: true }).fill('测试人物');
  await people.getByRole('button', { name: '记下了', exact: true }).click();
  await people.waitFor({ state: 'detached' });
  await p.getByRole('checkbox', { name: '测试人物', exact: true }).waitFor();
  assert.equal(await p.getByRole('checkbox', { name: '测试人物', exact: true }).getAttribute('aria-checked'), 'true');
  results.push({ check: '人物创建空名就地提示，成功后保留选中状态' });

  await p.goto(baseURL + '/people/overlay-person');
  await p.getByRole('button', { name: '编辑', exact: true }).click();
  const edit = await dialog(p, '编辑身边人');
  await edit.getByLabel('名字', { exact: true }).fill('');
  await edit.getByRole('button', { name: '保存', exact: true }).click();
  await edit.getByText('名字不能为空', { exact: true }).waitFor();
  await edit.getByLabel('名字', { exact: true }).fill('小林');
  await edit.getByLabel('生日', { exact: true }).fill('13-40');
  await edit.getByRole('button', { name: '保存', exact: true }).click();
  await edit.getByText('生日写法不对，试试 3-8 或 12月25日', { exact: true }).waitFor();
  assert.equal(await edit.getByLabel('名字', { exact: true }).inputValue(), '小林');
  await p.keyboard.press('Escape');
  results.push({ check: '人物编辑名称与生日校验位于面板内，失败保留输入' });

  await p.goto(baseURL + '/settings/about');
  await p.getByText('权限说明与授权', { exact: true }).click();
  const permissions = await dialog(p, '记录权限');
  await permissions.getByRole('button', { name: /通知/ }).click();
  await permissions.getByText('网页端暂不支持每日后台通知。你可以在手机应用中开启日记提醒。', { exact: true }).waitFor();
  await p.evaluate("navigator.mediaDevices.getUserMedia = async () => { window.__micRequested = true; return { getTracks: () => [{ stop: () => { window.__micStopped = true; } }] }; };");
  await permissions.getByRole('button', { name: /麦克风/ }).click();
  await permissions.getByText('已获得麦克风权限，写日记时可以录制语音。', { exact: true }).waitFor();
  assert.deepEqual(await p.evaluate('[window.__micRequested, window.__micStopped]'), [true, true]);
  await p.evaluate("navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Fixture permission rejected', 'NotAllowedError'); };");
  await permissions.getByRole('button', { name: /麦克风/ }).click();
  await permissions.getByText('未能获得麦克风权限。请检查浏览器的网站权限后重试。', { exact: true }).waitFor();
  await p.screenshot({ path: output + '/permission-result.png' });
  await p.keyboard.press('Escape');
  results.push({ check: '权限结果直接在面板可见，网页通知能力说明真实' });

  await p.goto(baseURL + '/write?id=overlay-entry');
  await p.getByText('11月20日 15:24 周五', { exact: true }).click();
  const time = await dialog(p, '记录时间');
  await time.getByRole('tab', { name: '时间', exact: true }).click();
  const hour = time.getByRole('slider', { name: '小时', exact: true });
  await hour.focus();
  const hourBefore = Number(await hour.getAttribute('aria-valuenow'));
  await p.keyboard.press('ArrowUp');
  await p.waitForFunction(before => document.querySelector('[aria-label="小时"]')?.getAttribute('aria-valuenow') === String(before + 1), hourBefore);
  await time.getByRole('button', { name: '确定', exact: true }).click();
  await time.waitFor({ state: 'detached' });
  await p.getByText('11月20日 16:24 周五', { exact: true }).waitFor();
  results.push({ check: '时间轮支持键盘增加小时，确认后写作时间真实更新' });

  await p.goto(baseURL + '/photos');
  await p.getByRole('button', { name: /的照片$/ }).nth(1).click();
  const viewer = await dialog(p, '照片查看器');
  await viewer.getByText('2 / 2', { exact: true }).waitFor();
  assert.equal(await viewer.evaluate(el => Array.from(el.querySelectorAll('*')).some(node => getComputedStyle(node).backgroundColor === 'rgb(18, 16, 14)')), true);
  await p.keyboard.press('ArrowLeft');
  await viewer.getByText('1 / 2', { exact: true }).waitFor();
  await viewer.getByRole('button', { name: '下一张照片', exact: true }).click();
  await viewer.getByText('2 / 2', { exact: true }).waitFor();
  await p.screenshot({ path: output + '/photo-viewer.png' });
  await viewer.getByRole('button', { name: '查看这张照片的日记', exact: true }).click();
  await p.waitForURL('**/memory/overlay-photo-entry');
  results.push({ check: '重复 URI 照片保留正确索引；背景不透底；键盘切换及回原日记' });
  await p.emulateMedia({ reducedMotion: 'no-preference' });
  await p.goto(baseURL + '/picker/tags');
  await p.getByRole('button', { name: '新建标签', exact: true }).focus();
  await p.getByRole('button', { name: '新建标签', exact: true }).click();
  await dialog(p, '新建标签');
  await p.keyboard.press('Escape');
  await p.getByRole('dialog').waitFor({ state: 'detached' });
  await p.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '新建标签');
  assert.equal(await p.locator('#root[inert]').count(), 0);
  results.push({ check: '常规动效打开过程中关闭也能完成退场，清理背景隔离并恢复焦点' });
  await p.goto(baseURL + '/picker/mood');
  const mood = p.getByRole('radio').first();
  await mood.focus();
  await p.keyboard.press('Space');
  assert.equal(await mood.getAttribute('aria-checked'), 'true');
  results.push({ check: '标签复选与心情单选支持空格键，不仅支持点击' });
  await regular.c.close();

  const narrowState = state();
  narrowState.appearance = { ...narrowState.appearance, theme: 'dark', fontScale: 'xlarge' };
  const narrow = await context(narrowState, true);
  await narrow.page.goto(baseURL + '/settings/ai');
  await narrow.page.getByRole('switch').first().click();
  const consent = await dialog(narrow.page, '开启「记得」之前');
  for (const name of ['明白了，开启', '再想想']) await reachable(consent.getByRole('button', { name, exact: true }), narrow.page);
  assert.ok(await consent.evaluate(el => Array.from(el.querySelectorAll('*')).some(node => { const style = getComputedStyle(node); return style.overflowY === 'auto' || style.overflowY === 'scroll'; })));
  await narrow.page.screenshot({ path: output + '/ai-dark-large-320.png' });
  await consent.getByRole('button', { name: '再想想', exact: true }).click();
  assert.equal(await narrow.page.getByRole('switch').first().getAttribute('aria-checked'), 'false');
  results.push({ check: '320×568 深色最大字号 AI 说明可滚动，两个操作完整可达，取消不开启' });
  await narrow.c.close();

  const placesState = state();
  placesState.entries = [
    actions.newEntry({ id: 'place-a1', title: '书店第一篇', body: '第一条地点回忆', status: 'published', place: { name: '书店', latitude: 30, longitude: 120 } }),
    actions.newEntry({ id: 'place-a2', title: '书店第二篇', body: '第二条地点回忆', status: 'published', place: { name: '书店', latitude: 30, longitude: 120 } }),
    actions.newEntry({ id: 'place-b', title: '咖啡馆回忆', body: '同坐标另一地点', status: 'published', place: { name: '咖啡馆', latitude: 30, longitude: 120 } }),
    actions.newEntry({ id: 'place-manual', title: '仅有名字的回忆', body: '没有虚构坐标', status: 'published', place: { name: '路边小店' } }),
    actions.newEntry({ id: 'place-hidden', title: '隐藏地点回忆', status: 'published', hidden: true, place: { name: '保密地点', latitude: 35, longitude: 120 } }),
  ];
  const places = await context(placesState);
  await places.page.goto(baseURL + '/memory-map');
  await places.page.getByText('地点分布示意', { exact: true }).waitFor();
  await places.page.getByText('仅记录名称的地点', { exact: true }).waitFor();
  assert.equal(await places.page.getByText('保密地点', { exact: true }).count(), 0);
  await places.page.getByRole('button', { name: '2 处相邻地点，共 3 篇日记，选择地点', exact: true }).click();
  const cluster = await dialog(places.page, '选择相邻地点');
  await cluster.getByRole('button', { name: /咖啡馆/ }).click();
  await places.page.getByRole('dialog', { name: '咖啡馆', exact: true }).getByRole('button', { name: /咖啡馆回忆/ }).waitFor();
  await places.page.getByRole('button', { name: '返回地点列表', exact: true }).click();
  await cluster.getByRole('button', { name: /书店/ }).click();
  const bookstore = places.page.getByRole('dialog', { name: '书店', exact: true });
  await bookstore.getByRole('button', { name: /书店第一篇/ }).waitFor();
  await bookstore.getByRole('button', { name: /书店第二篇/ }).waitFor();
  await places.page.screenshot({ path: output + '/place-all-journals.png' });
  results.push({ check: '地点分布标明示意；无坐标保留名称；重叠点每个地点及全部日记可选；隐藏地点不泄漏' });
  await places.c.close();

  const largeState = state();
  largeState.entries = Array.from({ length: 5000 }, (_, index) => actions.newEntry({ id: `media-${index}`, title: `人物长列表 ${index}`, body: '合成性能回归数据', people: ['overlay-person'], photos: [image], status: 'published', createdAt: Date.now() - index * 86400000 }));
  largeState.entries.push(actions.newEntry({ id: 'hidden-photo', title: '隐藏不能泄漏', body: '不应出现', hidden: true, people: ['overlay-person'], photos: [image], status: 'published', createdAt: Date.now() + 1 }));
  const large = await context(largeState);
  await large.page.goto(baseURL + '/photos');
  await large.page.getByText('共 5000 张照片', { exact: true }).waitFor();
  await large.page.getByRole('button', { name: /的照片$/ }).first().waitFor();
  const wallCount = await large.page.getByRole('button', { name: /的照片$/ }).count();
  assert.ok(wallCount < 150, `Photo wall mounted ${wallCount} of 5000 items`);
  await large.page.getByRole('button', { name: /的照片$/ }).first().click();
  const gallery = await dialog(large.page, '照片查看器');
  await gallery.getByText('1 / 5000', { exact: true }).waitFor();
  const thumbCount = await gallery.getByRole('button', { name: /查看第 \d+ 张照片/ }).count();
  assert.ok(thumbCount < 80, `Gallery mounted ${thumbCount} thumbnails`);
  await large.page.keyboard.press('Escape');
  await large.page.goto(baseURL + '/people/overlay-person');
  await large.page.getByText('5000 篇', { exact: true }).waitFor();
  await large.page.getByRole('button', { name: /^人物长列表 0，/ }).waitFor();
  const personCount = await large.page.getByRole('button', { name: /人物长列表/ }).count();
  assert.ok(personCount < 100, `Person list mounted ${personCount} of 5000 entries`);
  assert.equal(await large.page.getByText('隐藏不能泄漏', { exact: true }).count(), 0);
  results.push({ check: '5000 条照片墙、缩略图、人物日记均限制挂载量，隐藏日记不泄漏', detail: { wallCount, thumbCount, personCount } });
  await large.c.close();
  assert.deepEqual(errors, [], 'No runtime errors');
  console.log(JSON.stringify({ passed: results.length, results, errors }, null, 2));
} catch (error) {
  for (const context of browser.contexts()) {
    const page = context.pages().at(-1);
    if (page) {
      await page.screenshot({ path: output + '/failure.png' }).catch(() => undefined);
      await writeFile(output + '/failure.txt', String(error) + '\n' + await page.locator('body').innerText());
    }
  }
  throw error;
} finally {
  await writeFile(output + '/results.json', JSON.stringify({ results, errors }, null, 2));
  await browser.close();
}
