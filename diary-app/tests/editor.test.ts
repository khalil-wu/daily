import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBlocks, toggleTodoAtLine } from '../src/utils/richtext';
import { plainText } from '../src/utils/text';
import { isDictationSupported } from '../src/utils/dictation';

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
