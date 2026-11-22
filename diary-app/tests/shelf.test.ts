import test from 'node:test';
import assert from 'node:assert/strict';
import { moveId, nearestSlot, slotPosition, sortNotebooks, type ShelfGeo } from '../src/utils/shelf';
import { decryptBackup, encryptBackup } from '../src/utils/backupCrypto';
import { normalizeState } from '../src/store/storage';
import type { Notebook } from '../src/store/types';

const nb = (id: string, createdAt: number, order?: number): Notebook => ({ id, name: id, color: '#000', createdAt, ...(order === undefined ? {} : { order }) });

test('sortNotebooks：旧数据（无 order）保持原数组顺序，排序稳定', () => {
  const legacy = [nb('b', 5), nb('a', 9), nb('c', 1)];
  assert.deepEqual(sortNotebooks(legacy).map(n => n.id), ['b', 'a', 'c']);
  assert.deepEqual(sortNotebooks(legacy).map(n => n.id), sortNotebooks(sortNotebooks(legacy)).map(n => n.id));
  assert.deepEqual(sortNotebooks([nb('x', 1, 2), nb('y', 2, 0), nb('z', 3, 1)]).map(n => n.id), ['y', 'z', 'x']);
  assert.deepEqual(sortNotebooks([nb('p', 2, 1), nb('q', 1, 1)]).map(n => n.id), ['q', 'p']);
});

test('moveId 与 slot 几何：位置居中、最近格子命中', () => {
  assert.deepEqual(moveId(['a', 'b', 'c', 'd'], 3, 1), ['a', 'd', 'b', 'c']);
  assert.deepEqual(moveId(['a', 'b'], 0, 5), ['a', 'b']);
  const g: ShelfGeo = { tileW: 100, tileH: 133, cols: 2, width: 350, total: 5, gap: 20, rowStride: 170 };
  assert.deepEqual(slotPosition(0, g), { x: 65, y: 0 });
  assert.deepEqual(slotPosition(1, g), { x: 185, y: 0 });
  assert.deepEqual(slotPosition(4, g), { x: 65, y: 340 });
  assert.equal(nearestSlot(240, 60, 1, 3, g), 1);
  assert.equal(nearestSlot(100, 250, 1, 3, g), 2);
});

test('书架顺序：reorderNotebooks 写入连续 order，经归一化与加密备份往返后保持', async () => {
  const { clearAllStorage } = await import('../src/store/storage');
  const { actions, getState, hydrate } = await import('../src/store/store');
  await clearAllStorage();
  await hydrate();
  await actions.wipeAll();
  const a = actions.addNotebook('甲', '#93AFCF')!;
  const b = actions.addNotebook('乙', '#93AFCF')!;
  const c = actions.addNotebook('丙', '#93AFCF')!;
  const ids = getState().notebooks.map(n => n.id);
  const want = [c.id, ...ids.filter(id => id !== c.id)];
  actions.reorderNotebooks(want);
  assert.deepEqual(sortNotebooks(getState().notebooks).map(n => n.id), want);
  assert.deepEqual(getState().notebooks.map(n => n.order), want.map((_, i) => i));
  assert.deepEqual(sortNotebooks(normalizeState(JSON.parse(JSON.stringify(getState()))).notebooks).map(n => n.id), want);

  const snap = actions.snapshot() as any;
  const { accounts: _a, account: _b, conflicts: _c, ...data } = snap;
  const file = JSON.parse(await encryptBackup({ app: '记得日记', ...data }, 'pass123456', 1));
  await actions.wipeAll();
  assert.equal(getState().notebooks.some(n => n.id === a.id), false);
  actions.restoreSnapshot(await decryptBackup<any>(file, 'pass123456'), 'merge');
  const restored = sortNotebooks(getState().notebooks).map(n => n.id).filter(id => want.includes(id));
  assert.deepEqual(restored, want);
  assert.ok(b.id);
});
