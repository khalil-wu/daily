import test from 'node:test';
import assert from 'node:assert/strict';
import { scopeEntries } from '../src/store/store';
import { resolveSearchScope } from '../src/utils/editor';
import { DEFAULT_NOTEBOOK_ID } from '../src/data/constants';
import type { Entry, Notebook } from '../src/store/types';

const e = (id: string, notebookId?: string) => ({ id, notebookId }) as Entry;
const nbs: Notebook[] = [
  { id: DEFAULT_NOTEBOOK_ID, name: '我的日记', color: '#000', createdAt: 0 },
  { id: 'nb-a', name: '旅行', color: '#111', createdAt: 1 },
];

test('scopeEntries: null 返回全部，默认本包含未指定日记本的日记，其它本严格匹配', () => {
  const list = [e('1'), e('2', DEFAULT_NOTEBOOK_ID), e('3', 'nb-a'), e('4', 'nb-b')];
  assert.deepEqual(scopeEntries(list, null).map(x => x.id), ['1', '2', '3', '4']);
  assert.deepEqual(scopeEntries(list, DEFAULT_NOTEBOOK_ID).map(x => x.id), ['1', '2']);
  assert.deepEqual(scopeEntries(list, 'nb-a').map(x => x.id), ['3']);
  assert.deepEqual(scopeEntries(list, 'nb-none'), []);
});

test('resolveSearchScope: 带 scope 参数进入时默认只搜这本，缺省或未知日记本为全部', () => {
  assert.equal(resolveSearchScope('nb-a', nbs), 'nb-a');
  assert.equal(resolveSearchScope(undefined, nbs), null);
  assert.equal(resolveSearchScope('missing', nbs), null);
});
