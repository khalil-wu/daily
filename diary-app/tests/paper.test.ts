import test from 'node:test';
import assert from 'node:assert/strict';
import { paperMeta, paperColors } from '../src/data/constants';
import { normalizeEntry } from '../src/store/storage';
import { parseImportedEntries } from '../src/utils/transferFormat';
import { entryFingerprint } from '../src/store/sync';
import { plainText } from '../src/utils/text';
import { parseInline } from '../src/utils/richtext';
import type { Entry } from '../src/store/types';

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  const now = Date.now();
  return {
    id: 'p1', title: '信纸测试', body: '正文', createdAt: now, updatedAt: now,
    tags: [], people: [], photos: [], audios: [], videos: [],
    favorite: false, pinned: false, hidden: false, status: 'published', ...overrides,
  };
}

test('信纸：paper 字段随备份/导入 JSON 往返保留', () => {
  const entry = makeEntry({ paper: 'mint-leaves' });
  // 备份/持久化路径：entry 作为整体对象序列化
  const restored = normalizeEntry(JSON.parse(JSON.stringify(entry)));
  assert.equal(restored.paper, 'mint-leaves');
  // 导出/导入路径（JSON 格式）
  const parsed = parseImportedEntries(JSON.stringify({ entries: [entry] }), 'json');
  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.entries[0].paper, 'mint-leaves');
});

test('信纸：未知 paper key 解析为无信纸，且参与同步指纹', () => {
  const weird = normalizeEntry({ ...makeEntry(), paper: 'no-such-paper' as any });
  assert.equal(weird.paper, 'no-such-paper'); // 数据原样保留
  assert.equal(paperMeta(weird.paper), undefined); // 渲染解析回退为无
  assert.equal(paperColors(weird.paper), undefined);
  const a = makeEntry({ paper: 'night-sky' });
  const b = makeEntry({ paper: 'forest' });
  assert.notEqual(entryFingerprint(a), entryFingerprint(b)); // 换信纸触发同步
});

test('行内格式：plainText 去掉 ~~删除线~~ 与 ==高亮== 标记', () => {
  assert.equal(plainText('这是~~错的~~和==重点==内容'), '这是错的和重点内容');
});

test('行内格式：解析器产出 strike/highlight 片段，嵌套不崩溃', () => {
  const tokens = parseInline('a ~~划掉~~ b ==高亮== c');
  const marks = tokens.filter(t => t.mark).map(t => [t.mark, t.text]);
  assert.deepEqual(marks, [['strike', '划掉'], ['highlight', '高亮']]);
  // 与粗体嵌套：不抛错，仍有输出
  const nested = parseInline('**~~都要~~** 普通');
  assert.ok(nested.length > 0);
});
