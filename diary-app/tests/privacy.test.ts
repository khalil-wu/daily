import test from 'node:test';
import assert from 'node:assert/strict';
import { createHiddenAccessSession, isHiddenFlow } from '../src/utils/hiddenAccess';
import { computeTodaySummary } from '../src/utils/grouping';
import { actions } from '../src/store/store';

test('隐藏日记授权：只保留在当前内存会话，离开私密流程或后台可立即撤销', () => {
  const session = createHiddenAccessSession();
  let changes = 0;
  const unsubscribe = session.subscribe(() => changes++);
  assert.equal(session.snapshot(), null);
  session.unlock('verified-passcode-hash');
  assert.equal(session.snapshot(), 'verified-passcode-hash');
  assert.equal(createHiddenAccessSession().snapshot(), null);
  for (const route of ['/hidden', '/memory/private-id', '/write', '/picker/photos']) assert.equal(isHiddenFlow(route), true);
  for (const route of ['/', '/settings', '/search', '/favorites']) assert.equal(isHiddenFlow(route), false);
  session.lock();
  assert.equal(session.snapshot(), null);
  assert.equal(changes, 2);
  unsubscribe();
});

test('隐藏日记：今日篇数、字数和连续记录不会泄漏隐藏内容', () => {
  const now = new Date(2026, 10, 21, 10).getTime();
  const entry = actions.newEntry({ createdAt: now, status: 'published', hidden: true, body: '秘密' });
  assert.deepEqual(computeTodaySummary([entry], now), { count: 0, words: 0, streak: 0, wroteToday: false });
});
