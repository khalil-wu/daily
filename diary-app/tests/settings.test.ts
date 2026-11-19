import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_NOTEBOOK_ID, DEFAULT_NOTEBOOKS } from '../src/data/constants';
import { clearAllStorage, normalizeState } from '../src/store/storage';
import { actions, getState, hydrate, inNotebook } from '../src/store/store';

test('日记本与写作目标管理：增删改、去重、默认受保护与移动归属', async () => {
  await clearAllStorage();
  await hydrate();
  await actions.wipeAll();

  const nb1 = actions.addNotebook('旅行手记', '#93AFCF');
  assert.ok(nb1);
  // 同名去重应返回原日记本
  const nbDup = actions.addNotebook('旅行手记', '#E79A93');
  assert.equal(nbDup?.id, nb1.id);
  assert.equal(getState().notebooks.length, 2);

  actions.updateNotebook(nb1.id, { name: '环游日记', color: '#E79A93' });
  const updatedNb = getState().notebooks.find(n => n.id === nb1.id);
  assert.equal(updatedNb?.name, '环游日记');
  assert.equal(updatedNb?.color, '#E79A93');

  // 默认日记本不可删除
  assert.equal(actions.removeNotebook(DEFAULT_NOTEBOOK_ID), false);
  assert.ok(getState().notebooks.some(n => n.id === DEFAULT_NOTEBOOK_ID));

  // 创建日记并移动到新建日记本
  const e1 = actions.newEntry({ title: '西湖日落', body: '湖面金光闪闪', status: 'published' });
  const e2 = actions.newEntry({ title: '随记', body: '普通一天', status: 'published' });
  actions.upsertEntry(e1, true);
  actions.upsertEntry(e2, true);

  assert.equal(inNotebook(e1, null), true);
  assert.equal(inNotebook(e1, DEFAULT_NOTEBOOK_ID), true);
  assert.equal(inNotebook(e1, nb1.id), false);

  actions.moveToNotebook([e1.id], nb1.id);
  const movedE1 = getState().entries.find(e => e.id === e1.id)!;
  assert.equal(movedE1.notebookId, nb1.id);
  assert.equal(inNotebook(movedE1, nb1.id), true);
  assert.equal(inNotebook(movedE1, DEFAULT_NOTEBOOK_ID), false);

  actions.setActiveNotebook(nb1.id);
  assert.equal(getState().activeNotebook, nb1.id);

  // 删除日记本后，活动视图复位且其中的日记归入默认日记本
  assert.equal(actions.removeNotebook(nb1.id), true);
  assert.equal(getState().activeNotebook, null);
  const fallbackE1 = getState().entries.find(e => e.id === e1.id)!;
  assert.equal(fallbackE1.notebookId, undefined);
  assert.equal(inNotebook(fallbackE1, DEFAULT_NOTEBOOK_ID), true);

  // 写作目标更新
  actions.setGoals({ enabled: false, dailyWords: 500 });
  assert.deepEqual(getState().goals, { enabled: false, dailyWords: 500 });
});

test('数据迁移 normalizeState：缺少 notebooks / goals / activeNotebook 的旧版本数据兼容补全', () => {
  const legacyRaw = {
    version: 1 as const,
    onboarded: true,
    entries: [
      {
        id: 'old_1',
        title: '旧日记',
        body: '正文',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      } as any,
    ],
  };

  const migrated = normalizeState(legacyRaw);
  assert.equal(migrated.notebooks.length, DEFAULT_NOTEBOOKS.length);
  assert.equal(migrated.notebooks[0].id, DEFAULT_NOTEBOOK_ID);
  assert.equal(migrated.activeNotebook, null);
  assert.deepEqual(migrated.goals, { enabled: true, dailyWords: 200 });
  assert.deepEqual(migrated.entries[0].tags, []);
  assert.deepEqual(migrated.entries[0].photos, []);
  assert.equal(migrated.entries[0].status, 'published');
});
