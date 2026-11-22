import test from 'node:test';
import assert from 'node:assert/strict';
import { computeInsights, computeStreaks, earliestOffset, insightPeriod } from '../src/utils/insights';
import type { Entry } from '../src/store/types';

function makeEntry(id: string, createdAt: number, overrides: Partial<Entry> = {}): Entry {
  return {
    id, title: '日常', body: '散步看落叶', createdAt, updatedAt: createdAt,
    tags: [], people: [], photos: [], audios: [], videos: [],
    favorite: false, pinned: false, hidden: false, status: 'published',
    ...overrides,
  };
}

// 2026-11-22 是周日
const NOW = new Date(2026, 10, 22, 20).getTime();
const at = (m: number, d: number, h = 12) => new Date(2026, m - 1, d, h).getTime();

test('时间段：周从周一开始，月与年取自然边界，标签随偏移变化', () => {
  const week = insightPeriod('week', 0, NOW);
  assert.equal(new Date(week.from).getDate(), 16);
  assert.equal(new Date(week.to).getDate(), 23);
  assert.equal(week.label, '本周');
  assert.equal(week.rangeText, '11月16日 – 11月22日');
  assert.equal(insightPeriod('week', -1, NOW).label, '上周');
  assert.equal(insightPeriod('month', 0, NOW).rangeText, '2026年11月');
  assert.equal(insightPeriod('month', -2, NOW).label, '2026年9月');
  assert.equal(insightPeriod('year', -1, NOW).label, '去年');
  assert.equal(insightPeriod('year', -3, NOW).rangeText, '2023年');
});

test('周聚合：只算已发布的可见日记，按天汇总心情并给出上期对比', () => {
  const entries = [
    makeEntry('a', at(11, 16, 9), { mood: 'happy', tags: ['t1'], photos: ['p1'] }),
    makeEntry('b', at(11, 16, 22), { mood: 'calm', tags: ['t1', 't2'], body: '很长很长的一段文字，写了很多很多内容' }),
    makeEntry('c', at(11, 18, 1), { mood: 'calm', place: { name: '西湖' } as Entry['place'] }),
    makeEntry('hidden', at(11, 19), { hidden: true }),
    makeEntry('draft', at(11, 19), { status: 'draft' }),
    makeEntry('deleted', at(11, 19), { deletedAt: NOW }),
    makeEntry('prev1', at(11, 10)),
    makeEntry('prev2', at(11, 12)),
    makeEntry('old', at(10, 1)),
  ];
  const r = computeInsights(entries, 'week', 0, NOW);
  assert.equal(r.count, 3);
  assert.equal(r.days, 2);
  assert.equal(r.prevCount, 2);
  assert.equal(r.photos, 1);
  assert.equal(r.cells.length, 7);
  assert.deepEqual(r.cells[0].entryIds, ['a', 'b']);
  assert.equal(r.cells[0].mood, 'calm', '次数相同时取较晚那篇的心情');
  assert.equal(r.cells[2].mood, 'calm');
  assert.equal(r.cells[1].count, 0);
  assert.equal(r.dominantMood, 'calm');
  assert.deepEqual(r.moods.map(m => [m.key, m.count, m.percent]), [['calm', 2, 67], ['happy', 1, 33]]);
  assert.deepEqual(r.tags, [{ id: 't1', count: 2 }, { id: 't2', count: 1 }]);
  assert.deepEqual(r.places, [{ name: '西湖', count: 1 }]);
  assert.equal(r.longest?.id, 'b');
  assert.equal(r.first?.id, 'a');
  assert.equal(r.latestNight?.id, 'c', '凌晨一点比晚上十点更晚');
  assert.equal(r.trend.length, 7);
  assert.equal(r.trend[0].score, 4.5);
  assert.equal(r.trend[1].score, null);
});

test('年聚合：每天一格、逐月趋势与心情构成', () => {
  const entries = [
    makeEntry('jan', at(1, 5), { mood: 'down' }),
    makeEntry('jan2', at(1, 6), { mood: 'happy' }),
    makeEntry('nov', at(11, 20), { mood: 'happy' }),
  ];
  const r = computeInsights(entries, 'year', 0, NOW);
  assert.equal(r.cells.length, 365);
  assert.equal(r.cells.filter(c => c.future).length, 39);
  assert.equal(r.trend.length, 12);
  assert.equal(r.trend[0].score, 3);
  assert.equal(r.trend[1].score, null);
  assert.equal(r.months[0].count, 2);
  assert.deepEqual(r.months[10].moods, [{ key: 'happy', count: 1 }]);
});

test('连续记录：今天没写但昨天写了仍算连续，最长连续跨越历史', () => {
  const entries = [at(11, 21), at(11, 20), at(11, 19), at(11, 10), at(11, 9), at(11, 8), at(11, 7)].map((ts, i) => makeEntry(String(i), ts));
  assert.deepEqual(computeStreaks(entries, NOW), { current: 3, longest: 4 });
  assert.deepEqual(computeStreaks([], NOW), { current: 0, longest: 0 });
});

test('最早可翻到的期数', () => {
  const entries = [makeEntry('a', new Date(2025, 9, 15).getTime()), makeEntry('h', new Date(2020, 0, 1).getTime(), { hidden: true })];
  assert.equal(earliestOffset(entries, 'year', NOW), -1);
  assert.equal(earliestOffset(entries, 'month', NOW), -13);
  assert.equal(earliestOffset(entries, 'week', NOW), -57);
  assert.equal(earliestOffset([], 'week', NOW), 0);
});
