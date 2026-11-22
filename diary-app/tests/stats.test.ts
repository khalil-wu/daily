import test from 'node:test';
import assert from 'node:assert/strict';
import { extractKeywords } from '../src/utils/keywords';
import { computeAnnualReport, getAvailableYears } from '../src/utils/annual';
import { computeStats, findThrowbacks, layoutBeans } from '../src/utils/stats';
import type { Entry, MoodKey } from '../src/store/types';

function makeEntry(id: string, createdAt: number, overrides: Partial<Entry> = {}): Entry {
  return {
    id,
    title: '日常记录',
    body: '喝了一杯手冲咖啡，在公园散步看落叶。',
    createdAt,
    updatedAt: createdAt,
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

test('记忆胶囊按时间与排除标签筛选，隐藏、草稿、已删和未来内容均不回顾', () => {
  const now = new Date(2026, 10, 21, 12).getTime();
  const recent = new Date(2026, 9, 21, 12).getTime();
  const older = new Date(2024, 10, 21, 12).getTime();
  const entries = [makeEntry('recent', recent), makeEntry('older', older), makeEntry('excluded', recent, { tags: ['work'] }), makeEntry('hidden', recent, { hidden: true }), makeEntry('draft', recent, { status: 'draft' }), makeEntry('deleted', recent, { deletedAt: now }), makeEntry('future', now + 86400000)];
  assert.deepEqual(findThrowbacks(entries, now, { range: 'past-year', excludedTags: ['work'] }).map(item => item.entry.id), ['recent']);
  assert.deepEqual(findThrowbacks(entries, now, { range: 'earlier' }).map(item => item.entry.id), ['older']);
  assert.deepEqual(new Set(findThrowbacks(entries, now).map(item => item.entry.id)), new Set(['recent', 'older', 'excluded']));
  assert.ok(findThrowbacks(Array.from({ length: 5000 }, (_, i) => makeEntry(String(i), older)), now).length <= 4);
});

test('关键词提取：停用词过滤、频率排序与无 Segmenter 二元组回退', () => {
  const texts = [
    '我们今天在咖啡馆阅读设计书籍，咖啡很香，阅读令人平静。12345',
    '昨天去咖啡馆工作，又点了一杯手冲咖啡，阅读让思考更清晰。',
  ];

  const kw = extractKeywords(texts, 10);
  const words = kw.map(k => k.word);
  assert.equal(words.includes('我们'), false);
  assert.equal(words.includes('今天'), false);
  assert.equal(words.includes('12345'), false);
  assert.equal(words[0] === '咖啡' || words.includes('咖啡馆'), true);
  assert.equal(words.includes('阅读'), true);

  // 强制关闭 Intl.Segmenter 测试二元组与英文回退分支
  const fallback = extractKeywords(['散步咖啡馆 Reading 散步咖啡馆 Journal Journal'], 10, { disableSegmenter: true });
  const fbWords = fallback.map(k => k.word);
  assert.equal(fbWords.includes('散步'), true);
  assert.equal(fbWords.includes('journal'), true);
});

test('年度报告：跨年过滤、闰年366天/平年365天像素格、连续记录与年度之最', () => {
  const e2024 = [
    makeEntry('l1', new Date(2024, 1, 29, 9, 0).getTime(), { mood: 'happy' }),
  ];
  const leapRep = computeAnnualReport(e2024, 2024);
  assert.equal(leapRep.pixels.length, 366);
  assert.equal(leapRep.totalEntries, 1);

  const entries2026: Entry[] = [
    makeEntry('d1', new Date(2026, 2, 1, 8, 10).getTime(), { title: '春日晨跑', body: '公园晨跑五公里心情极好', mood: 'happy', tags: ['sport'] }),
    makeEntry('d2', new Date(2026, 2, 2, 23, 30).getTime(), { title: '夜晚读书', body: '精读一本长书做了很多笔记关于成长和思考的笔记', mood: 'calm', tags: ['read'], place: { name: '杭州市 · 西湖区' } }),
    makeEntry('d3', new Date(2026, 2, 3, 1, 15).getTime(), { title: '凌晨灵感', body: '睡前突发奇想', mood: 'grateful' }),
    makeEntry('d_hidden', new Date(2026, 2, 4, 12, 0).getTime(), { hidden: true }),
    makeEntry('d_trash', new Date(2026, 2, 5, 12, 0).getTime(), { deletedAt: Date.now() }),
    makeEntry('d_draft', new Date(2026, 2, 6, 12, 0).getTime(), { status: 'draft' }),
  ];

  const years = getAvailableYears([...e2024, ...entries2026]);
  assert.deepEqual(years, [2026, 2024]);

  const rep = computeAnnualReport([...e2024, ...entries2026], 2026);
  assert.equal(rep.pixels.length, 365);
  assert.equal(rep.totalEntries, 3);
  assert.equal(rep.recordDays, 3);
  assert.equal(rep.longestStreak, 3);
  assert.equal(rep.busiestMonth?.month, 3);
  assert.equal(rep.busiestMonth?.count, 3);
  assert.equal(rep.firstEntry?.id, 'd1');
  assert.equal(rep.longestEntry?.id, 'd2');
  assert.equal(rep.latestNightEntry?.id, 'd3'); // 01:15 晚于 23:30

  const emptyRep = computeAnnualReport(entries2026, 2023);
  assert.equal(emptyRep.totalEntries, 0);
  assert.equal(emptyRep.longestStreak, 0);
  assert.equal(emptyRep.busiestMonth, null);
});

test('大数据性能测试：5000 篇日记的常规统计与年度报告分析均在 1500ms 内完成', () => {
  const moods: MoodKey[] = ['happy', 'calm', 'tired', 'down', 'anxious', 'grateful'];
  const baseTs = new Date(2026, 0, 1, 20, 0, 0).getTime();
  const list: Entry[] = [];
  for (let i = 0; i < 5000; i++) {
    const dayOffset = i % 360;
    const ts = baseTs + dayOffset * 86400000 + (i % 5) * 60000;
    list.push(
      makeEntry(`p_${i}`, ts, {
        title: `第${i}篇生活观察与读书笔记`,
        body: '清晨在公园散步喝咖啡阅读设计心理学与时间管理思考日常成长。',
        mood: moods[i % moods.length],
        tags: ['life', 'read'],
        weather: i % 2 === 0 ? 'sunny' : 'cloudy',
        place: { name: '杭州市 · 西湖区' },
        photos: i % 4 === 0 ? ['asset:photo-mountain'] : [],
      }),
    );
  }

  const t1 = performance.now();
  const st = computeStats(list, 30, baseTs + 360 * 86400000);
  const d1 = performance.now() - t1;

  const t2 = performance.now();
  const ar = computeAnnualReport(list, 2026);
  const d2 = performance.now() - t2;

  assert.equal(st.totalEntries, 5000);
  assert.ok(ar.totalEntries > 4000);
  assert.ok(d1 < 1500, `computeStats 耗时 ${d1.toFixed(1)}ms 超过 1500ms`);
  assert.ok(d2 < 1500, `computeAnnualReport 耗时 ${d2.toFixed(1)}ms 超过 1500ms`);
});

test('layoutBeans: 确定性、罐内、数量保持、超容量收缩', () => {
  const ids = Array.from({ length: 24 }, (_, i) => `entry-${i}`);
  const a = layoutBeans(ids, 160, 120);
  const b = layoutBeans(ids, 160, 120);
  assert.deepEqual(a, b);
  assert.equal(a.length, 24);
  for (const bean of a) {
    assert.ok(bean.x >= 0 && bean.x + bean.w <= 160, `x out of jar: ${JSON.stringify(bean)}`);
    assert.ok(bean.y >= 0 && bean.y + bean.h <= 120, `y out of jar: ${JSON.stringify(bean)}`);
  }
  // 超过容量时豆子收缩且仍全部进罐
  const many = layoutBeans(Array.from({ length: 200 }, (_, i) => `e${i}`), 160, 120);
  assert.equal(many.length, 200);
  assert.ok(many[0].w < 26);
  for (const bean of many) {
    assert.ok(bean.x >= 0 && bean.x + bean.w <= 160);
    assert.ok(bean.y >= 0 && bean.y + bean.h <= 120);
  }
  // 空罐
  assert.deepEqual(layoutBeans([], 160, 120), []);
});
