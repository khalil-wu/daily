import test from 'node:test';
import assert from 'node:assert/strict';
import { actions, getState, hydrate, setState } from '../src/store/store';
import { clearAllStorage, defaultState, loadState, normalizeEntry, saveCloud, saveState } from '../src/store/storage';
import { mergeSyncEntries, preserveConcurrentEdits, syncPayload } from '../src/store/sync';
import { createWriteQueue } from '../src/store/persistence';
import { parseImportedEntries } from '../src/utils/transferFormat';
import { BACKUP_FORMAT, decryptBackup } from '../src/utils/backupCrypto';
import { buildSnapshotPayload } from '../src/services/autoBackup';

const entry = (id: string, updatedAt = 100) => normalizeEntry({ id, title: id, body: '日记内容', createdAt: 100, updatedAt });

test('持久化：慢旧写不会覆盖新写，失败后队列仍可继续', async () => {
  let release!: () => void;
  const pause = new Promise<void>(resolve => { release = resolve; });
  const written: number[] = [];
  const queue = createWriteQueue<number>(async value => {
    if (value === 1) await pause;
    if (value === 3) throw new Error('disk full');
    written.push(value);
  });
  const first = queue.write(1);
  const second = queue.write(2);
  await Promise.resolve();
  assert.deepEqual(written, []);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(written, [1, 2]);
  await assert.rejects(queue.write(3));
  await queue.write(4);
  assert.deepEqual(written, [1, 2, 4]);
});

test('清空存储会取消防抖保存，不会在稍后复活已清空数据', async () => {
  const pending = { ...defaultState(), entries: [entry('private')] };
  await saveState(pending);
  await clearAllStorage();
  await new Promise(resolve => setTimeout(resolve, 280));
  assert.deepEqual((await loadState()).entries, []);
});

test('导入验证与迁移：坏记录被拒绝、空字段补齐、同批重复 ID 独立保存', async () => {
  assert.throws(() => parseImportedEntries('{"entries":[null]}', 'json'), /无效/);
  assert.throws(() => parseImportedEntries('[{"body":{}},42]', 'json'), /无效/);
  const parsed = parseImportedEntries('\uFEFF' + JSON.stringify([{ id: 'same', body: '第一篇', tags: [null, 'x', 'x'], photos: [8], createdAt: null }, { id: 'same', body: '第二篇' }]), 'json');
  assert.equal(parsed.entries[0].title, '');
  assert.deepEqual(parsed.entries[0].tags, ['x']);
  assert.deepEqual(parsed.entries[0].photos, []);
  assert.equal(Number.isFinite(parsed.entries[0].createdAt), true);
  await hydrate();
  await actions.wipeAll();
  actions.importEntries(parsed.entries);
  assert.equal(new Set(getState().entries.map(e => e.id)).size, 2);
  const before = getState();
  assert.throws(() => actions.restoreSnapshot({ entries: [null] }, 'replace'));
  assert.equal(getState(), before);
});

test('同步：同时间不同正文也报告冲突，选择本地后不重复冲突', () => {
  const local = { ...entry('a', 200), body: '本机' };
  const remote = { ...entry('a', 200), body: '云端' };
  const detected = mergeSyncEntries([local], [remote], 100);
  assert.equal(detected.conflicts.length, 1);
  const resolved = mergeSyncEntries([local], [remote], 100, {}, { choice: 'local', conflicts: detected.conflicts });
  assert.equal(resolved.conflicts.length, 0);
  assert.equal(resolved.entries[0].body, '本机');
  assert.ok(resolved.entries[0].updatedAt > 200);
  const changedAgain = mergeSyncEntries([local], [{ ...remote, body: '云端又更新' }], 100, {}, { choice: 'local', conflicts: detected.conflicts });
  assert.equal(changedAgain.conflicts.length, 1);
});

test('同步期间编辑、添加与删除的日记都保留本机结果', () => {
  const before = [entry('edited'), entry('removed')];
  const current = [{ ...before[0], body: '上传中刚写的内容' }, entry('new')];
  const synced = [...before, entry('remote')];
  const result = preserveConcurrentEdits(before, current, synced);
  assert.equal(result.find(e => e.id === 'edited')?.body, '上传中刚写的内容');
  assert.equal(result.some(e => e.id === 'removed'), false);
  assert.equal(result.some(e => e.id === 'new'), true);
  assert.equal(result.some(e => e.id === 'remote'), true);
});

test('其他日记的未来时间不会让本篇的双方修改漏报冲突', () => {
  const local = { ...entry('a', 201), body: '本机改动' };
  const remote = { ...entry('a', 202), body: '其他设备改动' };
  const result = mergeSyncEntries([local], [remote], 999999, {}, undefined, { a: 200 });
  assert.equal(result.conflicts.length, 1);
});

test('永久删除的日记不会被旧设备复活，云端删除标记不含正文', () => {
  const old = entry('deleted');
  const localDeleted = mergeSyncEntries([], [old], 50, { deleted: 200 });
  assert.equal(localDeleted.entries.length, 0);
  const payload = syncPayload([], localDeleted.deletedEntries);
  assert.equal(payload[0].body, '');
  assert.equal(payload[0].title, '');
  assert.equal(payload[0].purgedAt, 200);
  const otherDevice = mergeSyncEntries([old], payload, 50);
  assert.equal(otherDevice.entries.length, 0);
  assert.equal(otherDevice.deletedEntries.deleted, 200);
});

test('同步全流程：收藏、隐藏、删除均上传；保留本机冲突成功并可再次同步', async () => {
  await actions.wipeAll();
  await actions.register('reliable@example.com', 'test-password');
  const accountId = getState().account!.id;
  await actions.upsertEntry(entry('a'), true);
  await actions.syncNow();
  const originalRevision = getState().entries[0].updatedAt;
  actions.toggleFavorite('a');
  assert.ok(getState().entries[0].updatedAt > originalRevision);
  actions.toggleHidden('a');
  const concurrent = { ...getState().entries[0], title: '其他设备', updatedAt: getState().entries[0].updatedAt + 1 };
  await saveCloud({ [accountId]: { entries: [concurrent], updatedAt: concurrent.updatedAt } });
  assert.equal((await actions.syncNow()).conflicts, 1);
  assert.equal((await actions.resolveConflicts('local')).conflicts, 0);
  assert.equal(getState().entries[0].title, 'a');
  assert.equal((await actions.syncNow()).conflicts, 0);
  actions.destroyEntry('a');
  assert.equal((await actions.syncNow()).ok, true);
  assert.equal(getState().entries.length, 0);
  assert.equal((await actions.syncNow()).conflicts, 0);
  assert.equal(getState().entries.length, 0);
});

test('备份不携带设备锁密码；异常 scrypt 参数在计算前拒绝', async () => {
  const state = defaultState();
  state.privacy = { ...state.privacy, passcodeHash: 'private-hash', appLock: true, biometric: true };
  const snapshot = buildSnapshotPayload(state);
  assert.equal('passcodeHash' in snapshot.privacy, false);
  assert.equal(snapshot.privacy.appLock, false);
  const invalid: any = { format: BACKUP_FORMAT, v: 1, kdf: { name: 'scrypt', N: 1 << 20, r: 100000, p: 1000 }, cipher: { name: 'aes-256-gcm' } };
  await assert.rejects(decryptBackup(invalid, 'password'), /参数异常/);
  await assert.rejects(decryptBackup({ ...invalid, v: 2 }, 'password'), /不支持/);
});

test('备份替换保留当前设备锁与同步会话，不能用外部快照解除应用锁', async () => {
  await actions.wipeAll();
  await setState(s => ({ ...s, privacy: { ...s.privacy, appLock: true, passcodeHash: 'device-hash' }, sync: { ...s.sync, lastSyncAt: 100 } }));
  actions.restoreSnapshot({ ...defaultState(), entries: [entry('restored')] }, 'replace');
  assert.equal(getState().privacy.passcodeHash, 'device-hash');
  assert.equal(getState().privacy.appLock, true);
  assert.equal(getState().sync.lastSyncAt, 100);
});
