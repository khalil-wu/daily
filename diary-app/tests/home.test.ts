import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDailyGoalProgress, groupEntriesByDate } from '../src/utils/grouping';
import type { Entry } from '../src/store/types';

function makeEntry(id: string, createdAt: number, overrides: Partial<Entry> = {}): Entry {
  return {
    id,
    title: `标题_${id}`,
    body: '记录一段日常生活感想',
    createdAt,
    updatedAt: createdAt,
    tags: [],
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

test('首页日期分组：空列表与置顶/今天/昨天/本周/本月/跨月跨年分组', () => {
  assert.deepEqual(groupEntriesByDate([]), []);

  // 2026-11-19 为周四（本周一开始为 2026-11-16）
  const now = new Date(2026, 10, 19, 14, 0, 0).getTime();
  const entries: Entry[] = [
    makeEntry('e_pin', new Date(2025, 0, 10, 9, 0).getTime(), { pinned: true }),
    makeEntry('e_today', new Date(2026, 10, 19, 8, 30).getTime()),
    makeEntry('e_yest', new Date(2026, 10, 18, 21, 0).getTime()),
    makeEntry('e_week', new Date(2026, 10, 16, 10, 0).getTime()), // 周一
    makeEntry('e_month', new Date(2026, 10, 5, 19, 0).getTime()), // 11月早些时候
    makeEntry('e_oct', new Date(2026, 9, 20, 12, 0).getTime()),
    makeEntry('e_2025', new Date(2025, 11, 31, 23, 0).getTime()),
  ];

  const groups = groupEntriesByDate(entries, now, true);
  assert.deepEqual(
    groups.map(g => g.title),
    ['置顶', '今天', '昨天', '本周', '本月', '2026年10月', '2025年12月'],
  );
  assert.equal(groups[0].entries[0].id, 'e_pin');

  // 草稿等场景关闭 respectPinned 时，置顶项归入对应日期组
  const flatGroups = groupEntriesByDate(entries, now, false);
  assert.equal(flatGroups.some(g => g.title === '置顶'), false);
  assert.equal(flatGroups[flatGroups.length - 1].title, '2025年1月');
});

test('今日写作目标进度：统计今日已发布与草稿字数、排除隐藏与已删除', () => {
  const now = new Date(2026, 10, 19, 18, 0, 0).getTime();
  const entries: Entry[] = [
    makeEntry('a', new Date(2026, 10, 19, 9, 0).getTime(), { title: '早安', body: '一二三四五六七八' }), // 2 + 8 = 10
    makeEntry('b', new Date(2026, 10, 19, 12, 0).getTime(), { status: 'draft', title: '', body: '十个中文字在这里写下' }), // 10
    makeEntry('c', new Date(2026, 10, 19, 15, 0).getTime(), { hidden: true, title: '隐藏', body: '忽略统计' }),
    makeEntry('d', new Date(2026, 10, 19, 16, 0).getTime(), { deletedAt: now, title: '已删', body: '忽略统计' }),
    makeEntry('e', new Date(2026, 10, 18, 22, 0).getTime(), { title: '昨天', body: '不计入今天' }),
  ];

  const half = computeDailyGoalProgress(entries, 40, now);
  assert.equal(half.written, 20);
  assert.equal(half.target, 40);
  assert.equal(half.percent, 50);
  assert.equal(half.achieved, false);

  const done = computeDailyGoalProgress(entries, 20, now);
  assert.equal(done.written, 20);
  assert.equal(done.percent, 100);
  assert.equal(done.achieved, true);
});
