import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { actions } from '../src/store/store';
import { buildSearchIndex, searchEntries } from '../src/utils/search';
import type { Person, Tag } from '../src/store/types';

test('搜索：索引排除隐藏/草稿/回收站，联合匹配正文、标签、人物别名与心情', () => {
  const tags: Tag[] = [{ id: 'travel', name: '旅行', icon: 'Map' }];
  const people: Person[] = [{ id: 'mum', name: '妈妈', aliases: ['老妈'], relation: 'family', color: '#000', createdAt: 1 }];
  const first = actions.newEntry({ id: 'first', status: 'published', title: 'Weekend', body: '**一起看海**', createdAt: 1, tags: ['travel'], people: ['mum'], mood: 'happy' });
  const second = actions.newEntry({ id: 'second', status: 'published', title: 'Weekend', createdAt: 2, mood: 'calm' });
  const index = buildSearchIndex([
    first, second, { ...first, id: 'hidden', hidden: true }, { ...first, id: 'draft', status: 'draft' }, { ...first, id: 'trash', deletedAt: 3 },
  ], tags, people);
  const ids = (q: string) => searchEntries(index, q).map(e => e.id);
  assert.deepEqual(ids(' WEEKEND '), ['second', 'first']);
  for (const query of ['一起看海', '旅行', '老妈']) assert.deepEqual(ids(query), ['first']);
  assert.deepEqual(searchEntries(index, '', { tag: 'travel', person: 'mum', mood: 'happy' }).map(e => e.id), ['first']);
  assert.deepEqual(searchEntries(index, '看海', { mood: 'calm' }), []);
  assert.deepEqual(searchEntries(index, ' '), []);
  assert.deepEqual(buildSearchIndex([first], tags, [{ ...people[0], name: '母亲', aliases: [] }]).flatMap(item => searchEntries([item], '老妈')), []);
});

test('搜索性能：5000 篇长日记索引复用后，连续 30 次输入筛选在 500ms 内完成', () => {
  const entries = Array.from({ length: 5000 }, (_, i) => actions.newEntry({
    id: `entry-${i}`, status: 'published', createdAt: i, body: '今天和朋友散步，记录一点平凡的快乐。'.repeat(80) + (i % 10 === 0 ? '海边旅行' : ''),
  }));
  const index = buildSearchIndex(entries, [], []);
  const start = performance.now();
  for (let i = 0; i < 30; i++) assert.equal(searchEntries(index, '海边旅行').length, 500);
  assert.ok(performance.now() - start < 500);
});
