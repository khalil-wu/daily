import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, daysBetween, daysInMonth, fmtDuration, isSameDay, pad2, startOfDay } from '../src/utils/date';
import { clamp, excerpt, isEmail, isPhone, plainText, sha256, uid, wordCount } from '../src/utils/text';
import { computeMilestones, computeStats, findThrowbacks } from '../src/utils/stats';
import { entriesToHtml, entriesToMarkdown, entriesToPlainText, entryToMarkdown, parseImportedEntries } from '../src/utils/transferFormat';
import { actions, getState, hydrate, selectDrafts, selectPublished, selectTrash, setState } from '../src/store/store';
import { clearAllStorage, saveCloud } from '../src/store/storage';
import { buildSampleDrafts, buildSampleEntries } from '../src/data/samples';
import type { Entry } from '../src/store/types';

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  const now = new Date(2026, 10, 18, 20, 30, 0).getTime();
  return {
    id: uid('t'),
    title: '测试日记',
    body: '这是一段包含**粗体**和*斜体*的内容',
    createdAt: now,
    updatedAt: now,
    tags: [],
    people: [],
    photos: [],
    audios: [],
    videos: [],
    favorite: false,
    pinned: false,
    hidden: false,
    status: 'published',
    ...overrides,
  };
}

/* ============ 1. 日期与文本工具测试 ============ */

test('日期工具：格式化、跨天差值与月份天数', () => {
  const d1 = new Date(2026, 1, 28, 23, 50, 0).getTime();
  const d2 = new Date(2026, 2, 1, 0, 10, 0).getTime();
  assert.equal(dayKey(d1), '2026-02-28');
  assert.equal(dayKey(d2), '2026-03-01');
  assert.equal(isSameDay(d1, d2), false);
  assert.equal(isSameDay(d1, startOfDay(d1)), true);
  assert.equal(daysBetween(d1, d2), 1);
  assert.equal(daysInMonth(2024, 1), 29); // 闰年 2 月
  assert.equal(daysInMonth(2026, 1), 28);
  assert.equal(pad2(5), '05');
  assert.equal(fmtDuration(156), '02:36');
  assert.equal(fmtDuration(3665), '01:01:05');
});

test('文本工具：富文本剥离、字数统计、摘要与账号校验', async () => {
  const md = '# 标题\n- **重点**内容与*斜体*以及__下划线__\n1. Hello World';
  assert.equal(plainText(md), '标题\n重点内容与斜体以及下划线\nHello World');
  assert.equal(wordCount('今天很开心 Hello 123'), 7); // 5个中文 + 2个英文数字词
  assert.equal(excerpt('  第一行\n\n第二行  ', 10), '第一行 第二行');
  assert.equal(excerpt('一二三四五六七八九十', 5), '一二三四五…');
  assert.equal(isEmail('user@example.com'), true);
  assert.equal(isEmail('bad-email'), false);
  assert.equal(isPhone('13800138000'), true);
  assert.equal(isPhone('12345'), false);
  assert.equal(clamp(15, 0, 10), 10);

  const h1 = await sha256('1234');
  const h2 = await sha256('1234');
  const h3 = await sha256('4321');
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
});

/* ============ 2. 高阶统计与数据分析引擎测试 ============ */

test('数据分析：连续记录天数、情绪能量指数、84天热力矩阵与标签关联', () => {
  const base = new Date(2026, 10, 18, 20, 0, 0).getTime();
  const mkDaysAgo = (daysAgo: number, hour: number, extra: Partial<Entry> = {}) => {
    const dt = new Date(base);
    dt.setDate(dt.getDate() - daysAgo);
    dt.setHours(hour, 15, 0, 0);
    return makeEntry({ createdAt: dt.getTime(), updatedAt: dt.getTime(), ...extra });
  };

  const entries: Entry[] = [
    mkDaysAgo(0, 20, { mood: 'happy', tags: ['travel'], weather: 'sunny', place: { name: '杭州市 · 西湖区' }, body: '今天去爬山拍了很多照片。'.repeat(12) }),
    mkDaysAgo(1, 21, { mood: 'grateful', tags: ['travel', 'growth'], weather: 'sunny', place: { name: '杭州市 · 西湖区' }, photos: ['asset:photo-mountain'] }),
    mkDaysAgo(2, 14, { mood: 'calm', tags: ['reading'], weather: 'cloudy', body: '午后看书。' }),
    mkDaysAgo(5, 9, { mood: 'anxious', tags: ['work'], weather: 'lightRain', body: '工作有些紧张。' }),
    mkDaysAgo(6, 10, { mood: 'tired', tags: ['work'], status: 'draft' }), // 草稿不计入已发布统计
  ];

  const stats = computeStats(entries, 30, base);
  assert.equal(stats.totalEntries, 4);
  assert.equal(stats.recordDays, 4);
  assert.equal(stats.currentStreak, 3); // 0, 1, 2 天前连续 3 天
  assert.equal(stats.longestStreak, 3);
  assert.equal(stats.moodTotal, 4);
  assert.equal(stats.positiveRate, 75); // happy + grateful + calm = 3/4
  assert.ok(stats.moodScore > 70 && stats.moodScore <= 100);

  // 84 天热力矩阵验证
  assert.equal(stats.heatmap84.length, 84);
  const todayCell = stats.heatmap84.find(c => c.key === dayKey(base));
  assert.ok(todayCell);
  assert.equal(todayCell.count, 1);
  assert.equal(todayCell.mood, 'happy');
  assert.ok(todayCell.level >= 2);

  // 标签 × 情绪关联验证：travel 满分 5.0
  const travelRel = stats.tagMoods.find(t => t.tagId === 'travel');
  assert.ok(travelRel);
  assert.equal(travelRel.avgScore, 5);
  assert.equal(travelRel.positivePercent, 100);

  // 天气 × 情绪关联验证
  const sunnyRel = stats.weatherMoods.find(w => w.weather === 'sunny');
  assert.ok(sunnyRel);
  assert.equal(sunnyRel.count, 2);

  // 5 大写作时段与画像验证
  assert.equal(stats.timeSlots.length, 5);
  const evening = stats.timeSlots.find(s => s.key === 'evening');
  assert.equal(evening?.count, 2);
  assert.equal(stats.writerPersona.title, '夜晚沉淀者');

  // 篇幅长度分桶验证
  const bucketSum = stats.lengthBuckets.reduce((acc, b) => acc + b.count, 0);
  assert.equal(bucketSum, 4);

  // 足迹地点聚合
  assert.equal(stats.placeCounts[0]?.name, '杭州市 · 西湖区');
  assert.equal(stats.placeCounts[0]?.count, 2);
});

test('数据分析：示例数据里程碑与记忆胶囊', () => {
  const now = new Date(2026, 10, 18, 12, 0, 0).getTime();
  const samples = buildSampleEntries(now);
  const drafts = buildSampleDrafts(now);
  const stats = computeStats([...samples, ...drafts], undefined, now);

  assert.equal(stats.totalEntries, samples.length);
  assert.ok(stats.currentStreak >= 12);

  const milestones = computeMilestones(samples, stats);
  assert.equal(milestones.find(m => m.id === 'first')?.achieved, true);
  assert.equal(milestones.find(m => m.id === 'streak7')?.achieved, true);
  assert.equal(milestones.find(m => m.id === 'entries10')?.achieved, true);

  const throwbacks = findThrowbacks(samples, now);
  assert.ok(throwbacks.length >= 1);
});

/* ============ 3. 核心状态管理 Store 全生命周期测试 ============ */

test('Store 生命周期：发布、草稿、收藏、置顶、隐藏、回收站、标签、搜索与备份恢复', async () => {
  await hydrate();
  await actions.wipeAll();

  // 引导完成与教程标记
  actions.completeOnboarding('local');
  actions.setTutorialSeen(true);
  assert.equal(getState().onboarded, true);
  assert.equal(getState().tutorialSeen, true);

  // 新建并发布日记
  const e1 = actions.newEntry({ title: '第一篇', body: '记录今天的好心情', mood: 'happy' });
  actions.publishEntry(e1);
  const e2 = actions.newEntry({ title: '草稿想法', body: '先存草稿' });
  actions.upsertEntry(e2, true);

  assert.equal(selectPublished(getState()).length, 1);
  assert.equal(selectDrafts(getState()).length, 1);

  // 收藏、置顶、隐藏状态切换
  actions.toggleFavorite(e1.id);
  actions.togglePinned(e1.id);
  actions.toggleHidden(e1.id);
  const updated = getState().entries.find(x => x.id === e1.id)!;
  assert.equal(updated.favorite, true);
  assert.equal(updated.pinned, true);
  assert.equal(updated.hidden, true);

  // 移入回收站 -> 恢复 -> 彻底删除
  actions.trashEntry(e1.id);
  assert.equal(selectPublished(getState()).length, 0);
  assert.equal(selectTrash(getState()).length, 1);

  actions.restoreEntry(e1.id);
  assert.equal(selectPublished(getState()).length, 1);
  assert.equal(selectTrash(getState()).length, 0);

  actions.trashEntry(e1.id);
  actions.emptyTrash();
  assert.equal(selectTrash(getState()).length, 0);

  // 自定义标签增删与级联清理
  const customTag = actions.addTag('摄影', 'Camera');
  const e3 = actions.newEntry({ title: '街拍', body: '阳光很好', tags: [customTag.id] });
  actions.publishEntry(e3);
  assert.ok(getState().entries.find(x => x.id === e3.id)?.tags.includes(customTag.id));
  actions.removeTag(customTag.id);
  assert.equal(getState().entries.find(x => x.id === e3.id)?.tags.includes(customTag.id), false);

  // 搜索历史
  actions.pushSearch('旅行');
  actions.pushSearch('成长');
  assert.deepEqual(getState().recentSearches, ['成长', '旅行']);
  actions.removeSearch('旅行');
  assert.deepEqual(getState().recentSearches, ['成长']);
  actions.clearSearches();
  assert.deepEqual(getState().recentSearches, []);

  // 应用锁密码设置与验证
  await actions.setPasscode('2580');
  assert.equal(getState().privacy.appLock, true);
  assert.equal(await actions.verifyPasscode('2580'), true);
  assert.equal(await actions.verifyPasscode('0000'), false);

  // 快照导出与恢复（合并 + 覆盖）
  const snap = JSON.parse(JSON.stringify(actions.snapshot()));
  await actions.wipeAll();
  assert.equal(getState().entries.length, 0);
  const restoredCount = actions.restoreSnapshot(snap, 'merge');
  assert.ok(restoredCount >= 1);
  assert.equal(getState().entries.length, snap.entries.length);

  await clearAllStorage();
});

test('账号体系：注册、重名校验、登录、重置密码与模拟云同步冲突处理', async () => {
  await actions.wipeAll();

  const reg1 = await actions.register('test@jide.app', 'secret123');
  assert.equal(reg1.ok, true);
  assert.equal(getState().account?.identifier, 'test@jide.app');

  const regDup = await actions.register('test@jide.app', 'secret123');
  assert.equal(regDup.ok, false);

  actions.logout();
  assert.equal(getState().account, undefined);

  const badLogin = await actions.login('test@jide.app', 'wrongpass');
  assert.equal(badLogin.ok, false);

  const reset = await actions.resetPassword('test@jide.app', 'newpass999');
  assert.equal(reset.ok, true);

  const goodLogin = await actions.login('test@jide.app', 'newpass999');
  assert.equal(goodLogin.ok, true);

  // 同步
  const e = actions.newEntry({ title: '云同步测试', body: '同步内容' });
  actions.publishEntry(e);
  const syncRes = await actions.syncNow();
  assert.equal(syncRes.ok, true);
  assert.equal(syncRes.conflicts, 0);
  assert.ok(getState().sync.lastSyncAt);

  await actions.deleteAccount();
  assert.equal(getState().account, undefined);
});

test('多账号：免密快速切换保留各账号独立空间', async () => {
  await actions.wipeAll();

  const regA = await actions.register('a@jide.app', 'pass111');
  assert.equal(regA.ok, true);
  const idA = getState().account!.id;
  const eA = actions.newEntry({ title: '账号A的日记', body: 'a' });
  actions.publishEntry(eA);
  const countA = getState().entries.length;

  const regB = await actions.register('b@jide.app', 'pass222');
  assert.equal(regB.ok, true);
  const idB = getState().account!.id;
  assert.equal(getState().entries.some(e => e.id === eA.id), false);

  // 本机账号直接免密切回 A，A 的日记原样恢复
  const swA = await actions.quickSwitchTo(idA);
  assert.equal(swA.ok, true);
  assert.equal(getState().account?.identifier, 'a@jide.app');
  assert.equal(getState().entries.length, countA);
  assert.ok(getState().entries.some(e => e.id === eA.id));

  const swB = await actions.quickSwitchTo(idB);
  assert.equal(swB.ok, true);
  assert.equal(getState().account?.identifier, 'b@jide.app');

  // 当前账号与未知账号
  const swSame = await actions.quickSwitchTo(idB);
  assert.equal(swSame.ok, true);
  const swMissing = await actions.quickSwitchTo('nope');
  assert.equal(swMissing.ok, false);

  // 账号表中保留两个账号（本机账号列表）
  assert.equal(getState().accounts.length, 2);
});

test('同步冲突检测与解决、以及超过30天回收站自动清理', async () => {
  await actions.wipeAll();
  await actions.register('sync@jide.app', 'pass1234');
  const accId = getState().account!.id;

  const baseEntry = makeEntry({ id: 'sync_1', title: '本地版本', body: '初始', updatedAt: 1000 });
  actions.publishEntry(baseEntry);
  await actions.syncNow();

  // 模拟云端与本机在上次同步后各自修改同一篇日记
  const cloudTime = Date.now() + 2000;
  await saveCloud({
    [accId]: {
      entries: [{ ...baseEntry, title: '云端最新标题', updatedAt: cloudTime }],
      updatedAt: cloudTime,
    },
  });
  setState(s => ({
    ...s,
    entries: s.entries.map(x => (x.id === 'sync_1' ? { ...x, title: '本机稍早修改', updatedAt: cloudTime - 500 } : x)),
  }), true);

  const conflictSync = await actions.syncNow();
  assert.equal(conflictSync.conflicts, 1);
  assert.equal(getState().conflicts.length, 1);

  await actions.resolveConflicts('cloud');
  assert.equal(getState().conflicts.length, 0);
  assert.equal(getState().entries.find(x => x.id === 'sync_1')?.title, '云端最新标题');

  // 超过 30 天的回收站条目的自动清理
  const oldDeleted = makeEntry({ id: 'old_del', deletedAt: Date.now() - 35 * 86400000 });
  const recentDeleted = makeEntry({ id: 'recent_del', deletedAt: Date.now() - 5 * 86400000 });
  setState(s => ({ ...s, entries: [oldDeleted, recentDeleted] }), true);
  actions.purgeExpiredTrash();
  assert.equal(getState().entries.some(x => x.id === 'old_del'), false);
  assert.equal(getState().entries.some(x => x.id === 'recent_del'), true);

  await clearAllStorage();
});

/* ============ 4. 多格式导出与导入解析测试 ============ */

test('导入与导出：Markdown、纯文本、HTML 与 JSON 往返解析', () => {
  const tags = [{ id: 'travel', name: '旅行', icon: 'Plane' }];
  const list = [
    makeEntry({ id: 'e1', title: '洱海清晨', body: '雾气还没散去', mood: 'happy', tags: ['travel'], weather: 'sunny', temperature: 16, place: { name: '大理市' } }),
    makeEntry({ id: 'e2', title: '夜晚随想', body: '安静写一段话', mood: 'calm' }),
  ];

  const singleMd = entryToMarkdown(list[0], tags);
  assert.ok(singleMd.includes('# 洱海清晨'));
  assert.ok(singleMd.includes('心情：开心'));
  assert.ok(singleMd.includes('标签：旅行'));

  const fullMd = entriesToMarkdown(list, tags);
  const parsedMd = parseImportedEntries(fullMd, 'md');
  assert.equal(parsedMd.entries.length, 2);
  assert.equal(parsedMd.entries[0].title, '洱海清晨');
  assert.ok(parsedMd.entries[0].body.includes('雾气还没散去'));

  const fullTxt = entriesToPlainText(list, tags);
  const parsedTxt = parseImportedEntries(fullTxt, 'txt');
  assert.equal(parsedTxt.entries.length, 2);
  assert.equal(parsedTxt.entries[0].title, '洱海清晨');

  const html = entriesToHtml(list, tags);
  assert.ok(html.includes('<!doctype html>'));
  assert.ok(html.includes('洱海清晨'));

  const jsonParsed = parseImportedEntries(JSON.stringify({ entries: list }), 'json');
  assert.equal(jsonParsed.entries.length, 2);
  assert.throws(() => parseImportedEntries('{"bad":true}', 'json'));
});
