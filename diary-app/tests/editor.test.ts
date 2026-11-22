import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBlocks, toggleTodoAtLine } from '../src/utils/richtext';
import { plainText } from '../src/utils/text';
import { isDictationSupported } from '../src/utils/dictation';
import { actions } from '../src/store/store';
import { entryForSave, hasEntryContent, insertDictation } from '../src/utils/editor';
import { calendarEntryDate } from '../src/utils/calendar';

test('富文本解析：覆盖 8 种块类型、待办勾选往返与纯文本清理', () => {
  assert.deepEqual(parseBlocks(''), []);

  const body = [
    '# 今日小标题',
    '',
    '> 慢慢来也很好',
    '- [ ] 买一杯拿铁',
    '- [X] 写完今天日记',
    '- 散步二十分钟',
    '1. 整理桌面',
    '---',
    '包含 **粗体** *斜体* __下划线__ 的正文',
  ].join('\n');

  const blocks = parseBlocks(body);
  assert.deepEqual(
    blocks.map(b => b.type),
    ['heading', 'blank', 'quote', 'todo', 'todo', 'ul', 'ol', 'divider', 'paragraph'],
  );
  assert.equal(blocks[0].type === 'heading' && blocks[0].text, '今日小标题');
  assert.equal(blocks[2].type === 'quote' && blocks[2].text, '慢慢来也很好');
  assert.equal(blocks[3].type === 'todo' && blocks[3].checked, false);
  assert.equal(blocks[4].type === 'todo' && blocks[4].checked, true);
  assert.equal(blocks[6].type === 'ol' && blocks[6].index, '1');

  // 精确切换第 3 行待办 [ ] <-> [x]，其他行保持原样
  const checked = toggleTodoAtLine(body, 3);
  assert.equal(checked.split('\n')[3], '- [x] 买一杯拿铁');
  assert.equal(checked.split('\n')[4], '- [X] 写完今天日记');
  const unchecked = toggleTodoAtLine(checked, 3);
  assert.equal(unchecked, body);

  // 非待办行或越界索引不变
  assert.equal(toggleTodoAtLine(body, 2), body);
  assert.equal(toggleTodoAtLine(body, 99), body);

  // plainText 正确清理新增语法
  const clean = plainText(body);
  assert.equal(clean.includes('> '), false);
  assert.equal(clean.includes('[ ]'), false);
  assert.equal(clean.includes('---'), false);
  assert.equal(clean.includes('**'), false);
  assert.equal(clean.includes('买一杯拿铁'), true);
});

test('语音听写：在无 window 的 Node 环境下返回不支持', () => {
  assert.equal(isDictationSupported(), false);
});

test('编辑保存：已发布日记保留状态、完整日期人物元数据和多媒体空正文', () => {
  const entry = actions.newEntry({ status: 'published', createdAt: 100, people: ['mum'], tags: ['travel'], temperature: 20, photos: ['asset:photo-lake'] });
  assert.equal(hasEntryContent(entry), true);
  const saved = entryForSave(entry, 200);
  assert.equal(saved.status, 'published');
  assert.equal(saved.createdAt, 100);
  assert.equal(saved.updatedAt, 200);
  assert.deepEqual(saved.people, ['mum']);
  assert.deepEqual(saved.tags, ['travel']);
  assert.equal(saved.temperature, 20);
  assert.equal(entryForSave(actions.newEntry({ body: '还没写完' })).status, 'draft');
  assert.equal(hasEntryContent(actions.newEntry({ title: ' ', body: '\n' })), false);
  assert.equal(hasEntryContent(actions.newEntry({ audios: [{ id: 'audio', uri: 'test', duration: 1, createdAt: 1 }] })), true);
});

test('连续听写：替换选区后按顺序插入多段结果，光标越界也不会丢掉原文', () => {
  const first = insertDictation('今天旧内容结束', '去了海边，', { start: 2, end: 5 });
  const second = insertDictation(first.body, '很开心。', { start: first.cursor, end: first.cursor });
  assert.equal(second.body, '今天去了海边，很开心。结束');
  assert.equal(second.cursor, 11);
  assert.deepEqual(insertDictation('原文', '新增', { start: 99, end: 99 }), { body: '原文新增', cursor: 4 });
});

test('日历补记：上午写今天不产生未来时间，过去用正午，未来日期不可写', () => {
  const now = new Date(2026, 10, 21, 8, 30).getTime();
  assert.equal(calendarEntryDate(2026, 10, 21, now), now);
  assert.equal(calendarEntryDate(2026, 10, 20, now), new Date(2026, 10, 20, 12).getTime());
  assert.equal(calendarEntryDate(2026, 10, 22, now), null);
  assert.equal(calendarEntryDate(2027, 0, 1, now), null);
});
