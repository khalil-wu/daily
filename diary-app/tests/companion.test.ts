import test from 'node:test';
import assert from 'node:assert/strict';
import { composeDateTime, greetingFor } from '../src/utils/date';
import { computeTodaySummary } from '../src/utils/grouping';
import { continueListOnEnter } from '../src/utils/richtext';
import { TextHistory } from '../src/utils/history';
import type { Entry } from '../src/store/types';

function makeEntry(id: string, createdAt: number, overrides: Partial<Entry> = {}): Entry {
  return {
    id,
    title: '',
    body: '今天散步很开心',
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

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m, d, h, min, 0, 0).getTime();

test('问候语：覆盖一天里的每个时段与边界', () => {
  assert.equal(greetingFor(5), '早上好');
  assert.equal(greetingFor(8), '早上好');
  assert.equal(greetingFor(9), '上午好');
  assert.equal(greetingFor(12), '中午好');
  assert.equal(greetingFor(14), '下午好');
  assert.equal(greetingFor(18), '晚上好');
  assert.equal(greetingFor(22), '晚上好');
  assert.equal(greetingFor(23), '夜深了');
  assert.equal(greetingFor(0), '夜深了');
  assert.equal(greetingFor(4), '夜深了');
});

test('记录时间：日期与时刻合成，且不能晚于此刻', () => {
  const now = at(2026, 10, 19, 14, 30);

  // 过去的某一天：原样合成
  const past = composeDateTime(at(2026, 10, 5, 9, 0), 20, 45, now);
  assert.equal(past, at(2026, 10, 5, 20, 45));

  // 今天但晚于此刻：收回到此刻
  assert.equal(composeDateTime(at(2026, 10, 19, 0, 0), 23, 0, now), now);

  // 今天且早于此刻：保留
  assert.equal(composeDateTime(at(2026, 10, 19, 0, 0), 8, 5, now), at(2026, 10, 19, 8, 5));

  // 未来的日期：同样收回到此刻
  assert.equal(composeDateTime(at(2026, 10, 25, 0, 0), 8, 0, now), now);
});

test('今日汇总：篇数、字数与连续天数（与统计页口径一致）', () => {
  const now = at(2026, 10, 19, 14, 0);

  // 没有任何日记
  assert.deepEqual(computeTodaySummary([], now), { count: 0, words: 0, streak: 0, wroteToday: false });

  const entries: Entry[] = [
    makeEntry('today_1', at(2026, 10, 19, 8, 0)), // 7 字
    makeEntry('today_draft', at(2026, 10, 19, 9, 0), { status: 'draft', body: '草稿三个字' }), // 5 字，计字数不计篇数
    makeEntry('today_hidden', at(2026, 10, 19, 10, 0), { hidden: true }),
    makeEntry('today_deleted', at(2026, 10, 19, 11, 0), { deletedAt: now }),
    makeEntry('d18', at(2026, 10, 18, 21, 0)),
    makeEntry('d17', at(2026, 10, 17, 21, 0)),
    // 16 号断开
    makeEntry('d15', at(2026, 10, 15, 21, 0)),
  ];
  const s = computeTodaySummary(entries, now);
  assert.equal(s.count, 1);
  assert.equal(s.words, 12);
  assert.equal(s.wroteToday, true);
  assert.equal(s.streak, 3); // 19、18、17

  // 今天还没写，但昨天写了：连续天数不清零
  const noToday = computeTodaySummary(entries.filter(e => !e.id.startsWith('today')), now);
  assert.equal(noToday.wroteToday, false);
  assert.equal(noToday.count, 0);
  assert.equal(noToday.streak, 2); // 18、17

  // 昨天也没写：连续中断
  const broken = computeTodaySummary([makeEntry('d15', at(2026, 10, 15))], now);
  assert.equal(broken.streak, 0);

  // 只有草稿不算连续记录
  const draftOnly = computeTodaySummary([makeEntry('dr', at(2026, 10, 19, 9, 0), { status: 'draft' })], now);
  assert.equal(draftOnly.streak, 0);
  assert.equal(draftOnly.wroteToday, false);
  assert.equal(draftOnly.words, 7);
});

test('回车接续列表：无序 / 有序 / 待办 / 引用，以及空项结束列表', () => {
  // 无序列表
  assert.deepEqual(continueListOnEnter('- 买花', '- 买花\n'), { text: '- 买花\n- ', cursor: 7 });
  // 有序列表序号递增
  assert.deepEqual(continueListOnEnter('1. 起床\n2. 跑步', '1. 起床\n2. 跑步\n'), { text: '1. 起床\n2. 跑步\n3. ', cursor: 15 });
  // 已勾选的待办，下一项恢复为未勾选
  assert.deepEqual(continueListOnEnter('- [x] 写日记', '- [x] 写日记\n'), { text: '- [x] 写日记\n- [ ] ', cursor: 16 });
  // 引用
  assert.deepEqual(continueListOnEnter('> 慢慢来', '> 慢慢来\n'), { text: '> 慢慢来\n> ', cursor: 8 });

  // 空项上回车：去掉前缀，结束列表
  assert.deepEqual(continueListOnEnter('- 买花\n- ', '- 买花\n- \n'), { text: '- 买花\n', cursor: 5 });
  assert.deepEqual(continueListOnEnter('- [ ] ', '- [ ] \n'), { text: '', cursor: 0 });

  // 在一行中间回车：后半段带上前缀
  assert.deepEqual(continueListOnEnter('- 买花浇水', '- 买花\n浇水', 4), { text: '- 买花\n- 浇水', cursor: 7 });

  // 行后紧跟空行时，靠光标位置准确定位
  assert.deepEqual(continueListOnEnter('- 买花\n\n正文', '- 买花\n\n\n正文', 4), { text: '- 买花\n- \n\n正文', cursor: 7 });

  // 不该介入的情况
  assert.equal(continueListOnEnter('普通段落', '普通段落\n'), null); // 不是列表
  assert.equal(continueListOnEnter('- 买花', '- 买花a'), null); // 不是回车
  assert.equal(continueListOnEnter('- 买花', '- 买'), null); // 删除
  assert.equal(continueListOnEnter('- 买花', '- 买花\n\n'), null); // 一次变化超过一个字符（粘贴）
  assert.equal(continueListOnEnter('', '\n'), null); // 空正文
  assert.equal(continueListOnEnter('# 标题', '# 标题\n'), null); // 小标题不接续
});

test('撤销历史：连续输入合并、整段操作独立、撤销后再输入丢弃重做', () => {
  const h = new TextHistory('', 900);
  assert.equal(h.canUndo, false);
  assert.equal(h.canRedo, false);
  assert.equal(h.undo(), null);

  // 连续打字（间隔小于窗口）合并成一步
  h.push('今', 1000);
  h.push('今天', 1200);
  h.push('今天很', 1500);
  // 停顿之后是新的一步
  h.push('今天很好', 5000);
  // 整段操作（如加粗）强制独立
  h.push('**今天很好**', 5100, true);
  h.seal();
  // 整段操作之后紧接着打字，也不与它合并
  h.push('**今天很好**呀', 5200);

  assert.equal(h.undo(), '**今天很好**');
  assert.equal(h.undo(), '今天很好');
  assert.equal(h.undo(), '今天很');
  assert.equal(h.undo(), '');
  assert.equal(h.undo(), null);
  assert.equal(h.canUndo, false);

  // 重做
  assert.equal(h.redo(), '今天很');
  assert.equal(h.redo(), '今天很好');
  assert.equal(h.canRedo, true);

  // 撤销途中输入新内容：后面的重做被丢弃，且不与撤销前的那一步合并
  h.push('今天很好，去散步', 9000);
  assert.equal(h.canRedo, false);
  assert.equal(h.redo(), null);
  assert.equal(h.undo(), '今天很好');

  // 相同内容不产生新的一步
  h.push('今天很好', 9500);
  assert.equal(h.redo(), '今天很好，去散步');

  // 重置
  h.reset('新的一篇');
  assert.equal(h.canUndo, false);
  assert.equal(h.canRedo, false);
});

test('撤销历史：步数有上限，最早的记录被丢弃', () => {
  const h = new TextHistory('0', 0, 5);
  for (let i = 1; i <= 10; i++) h.push(String(i), i * 10, true);
  const seen: string[] = [];
  for (let v = h.undo(); v != null; v = h.undo()) seen.push(v);
  assert.deepEqual(seen, ['9', '8', '7', '6']);
});
