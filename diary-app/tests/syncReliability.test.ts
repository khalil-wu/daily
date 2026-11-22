import test from 'node:test';
import assert from 'node:assert/strict';
import { actions, entrySaveStatus, getState, hydrate, setState } from '../src/store/store';
import { defaultState, normalizeEntry, saveCloud, loadState, flushPendingState } from '../src/store/storage';
import { entryFingerprint } from '../src/store/sync';
import { accountSpaceKey, switchAccount } from '../src/store/accountSpaces';
import { enabledMetadata, mergeMetadata, syncMetadata, syncNetworkBlock } from '../src/store/syncMetadata';
import { buildSnapshotPayload, listAutoBackups, readAutoBackup, writeAutoBackup, clearAutoBackups } from '../src/services/autoBackup';
import { createMediaSync, parseCloudMedia, type CloudMediaTransport } from '../src/services/syncMedia';
import { MAX_BACKUP_MEDIA_BYTES, type BackupMediaIO } from '../src/services/backupMedia';

const entry = (id: string, body = '日记正文', updatedAt = 100) => normalizeEntry({ id, body, updatedAt, createdAt: 100 });
const account = (id: string) => ({ id, identifier: `${id}@example.invalid`, nickname: id, createdAt: 1, remote: true });

test('保存确认要求当前内容实际落盘且云端确认同一指纹，开关或旧回执均不算完成', () => {
  const e = entry('a');
  const s = { ...defaultState(), account: account('a'), entries: [e] };
  s.sync.cloud = true;
  assert.equal(entrySaveStatus(s, null, 'a').local, false);
  assert.equal(entrySaveStatus(s, s, 'a').synced, false);
  s.sync.entryHashes = { a: entryFingerprint(e) };
  assert.equal(entrySaveStatus(s, s, 'a').synced, true);
  const updated = { ...s, entries: [{ ...e, body: '同一时间戳的不同内容' }] };
  assert.equal(entrySaveStatus(updated, s, 'a').local, false);
  assert.equal(entrySaveStatus(updated, updated, 'a').synced, false);
  assert.equal(entrySaveStatus(s, { ...s, account: account('b') }, 'a').local, false);
  assert.equal(entrySaveStatus({ ...s, account: { ...account('a'), remote: false } }, { ...s, account: { ...account('a'), remote: false } }, 'a').synced, false);
});

test('账号切换隔离日记、冲突、媒体缓存和回执；备份只包含当前账号', () => {
  const guest = { ...defaultState(), entries: [entry('guest')] };
  let s = switchAccount(guest, account('a'));
  assert.equal(s.entries.length, 0);
  s = { ...s, entries: [entry('a')], sync: { ...s.sync, entryHashes: { a: 'ack' }, mediaCache: { cloud: 'local' } } };
  s = switchAccount(s, account('b'));
  assert.equal(s.entries.length, 0);
  assert.equal(s.sync.entryHashes, undefined);
  assert.equal(s.sync.mediaCache, undefined);
  s = { ...s, entries: [entry('b')] };
  assert.equal(JSON.stringify(buildSnapshotPayload(s)).includes('guest'), false);
  assert.equal('accountSpaces' in buildSnapshotPayload(s), false);
  s = switchAccount(s, account('a'));
  assert.equal(s.entries[0].id, 'a');
  assert.equal(s.sync.entryHashes?.a, 'ack');
  assert.equal(switchAccount(s).entries[0].id, 'guest');
});

test('实际登录切换与注销只影响当前账号，关闭同步不上传', async () => {
  await hydrate();
  await actions.wipeAll();
  await actions.upsertEntry(entry('guest'), true);
  await actions.register('a@example.invalid', 'password-a');
  const aid = getState().account!.id;
  assert.equal(getState().entries.length, 0);
  await actions.upsertEntry(entry('a'), true);
  actions.setSync({ cloud: false });
  assert.equal((await actions.syncNow()).ok, false);
  await actions.logout();
  assert.equal(getState().entries[0].id, 'guest');
  await actions.register('b@example.invalid', 'password-b');
  assert.equal(getState().entries.length, 0);
  await actions.upsertEntry(entry('b'), true);
  await actions.deleteAccount();
  assert.equal(getState().entries[0].id, 'guest');
  await actions.login('a@example.invalid', 'password-a');
  assert.equal(getState().account?.id, aid);
  assert.equal(getState().entries[0].id, 'a');
  await flushPendingState();
  assert.equal((await loadState()).entries[0].id, 'a');
});

test('冲突逐篇处理：第一篇保留本地不替第二篇做决定，再同步不复发', async () => {
  await actions.wipeAll();
  await actions.register('conflict@example.invalid', 'password');
  await actions.upsertEntry(entry('one'), true);
  await actions.upsertEntry(entry('two'), true);
  await actions.syncNow();
  const base = getState().entries;
  await actions.upsertEntry({ ...base.find(e => e.id === 'one')!, body: 'one local', updatedAt: 200 }, true);
  await actions.upsertEntry({ ...base.find(e => e.id === 'two')!, body: 'two local', updatedAt: 200 }, true);
  await saveCloud({ [getState().account!.id]: { entries: base.map(e => ({ ...e, body: `${e.id} remote`, updatedAt: 201 })), updatedAt: 201 } });
  assert.equal((await actions.syncNow()).conflicts, 2);
  assert.equal((await actions.resolveConflicts('local', 'one')).conflicts, 1);
  assert.equal(getState().conflicts[0].entryId, 'two');
  assert.equal((await actions.resolveConflicts('cloud', 'two')).conflicts, 0);
  assert.equal(getState().entries.find(e => e.id === 'one')?.body, 'one local');
  assert.equal(getState().entries.find(e => e.id === 'two')?.body, 'two remote');
  assert.equal((await actions.syncNow()).conflicts, 0);
});

test('标签与设置三方合并保留不同字段的修改和明确删除，关闭的类别不应用', () => {
  const tag = (id: string, name = id) => ({ id, name, icon: 'Star' });
  const baseline = { tags: [tag('one'), tag('two')], goals: { enabled: true, dailyWords: 200 } };
  const local = { tags: [tag('one', '本机'), tag('new')], goals: { enabled: true, dailyWords: 300 } };
  const remote = { tags: [tag('one'), tag('two'), tag('remote')], goals: { enabled: false, dailyWords: 200 } };
  const merged = mergeMetadata(local, remote, baseline);
  assert.deepEqual(merged.tags?.map(t => t.id).sort(), ['new', 'one', 'remote']);
  assert.deepEqual(merged.goals, { enabled: false, dailyWords: 300 });
  const disabled = defaultState();
  disabled.sync.syncTags = false;
  disabled.sync.syncSettings = false;
  assert.deepEqual(syncMetadata(disabled), {});
  assert.deepEqual(enabledMetadata(disabled, merged), {});
});

function mediaHarness() {
  const local = new Map<string, { bytes: Uint8Array; mime: string }>();
  const cloud = new Map<string, Uint8Array>();
  let count = 0, uploads = 0, downloads = 0;
  const io: BackupMediaIO = {
    async read(uri, _kind, max) { const item = local.get(uri); if (!item) throw new Error('missing'); if (item.bytes.length > max) throw new Error('too large'); return item; },
    async write(_kind, mime, bytes) { const uri = `idb:photo/restored${++count}`; local.set(uri, { bytes, mime }); return uri; },
    async remove(uri) { local.delete(uri); },
  };
  const transport: CloudMediaTransport = {
    async upload(path, bytes) { uploads++; const id = `cloud://test/${path}`; cloud.set(id, bytes.slice()); return id; },
    async download(id) { downloads++; const bytes = cloud.get(id); if (!bytes) throw new Error('missing'); return bytes.slice(); },
  };
  return { local, cloud, io, transport, stats: () => ({ uploads, downloads }) };
}

test('跨设备同步真正上传和下载照片/音视频，下载后可离线读取，重试不重复上传', async () => {
  const h = mediaHarness();
  for (const [uri, mime, value] of [['p', 'image/png', 1], ['a', 'audio/mp4', 2], ['v', 'video/mp4', 3]] as const) h.local.set(uri, { bytes: Uint8Array.of(value, 2, 3), mime });
  const e = { ...entry('media'), photos: ['p'], audios: [{ id: 'a', uri: 'a', duration: 2, createdAt: 1 }], videos: [{ id: 'v', uri: 'v', poster: 'p', duration: 2, createdAt: 1 }] };
  const sender = createMediaSync('owner', {}, h.transport, h.io);
  const uploaded = await sender.upload([e]);
  assert.equal(h.stats().uploads, 3);
  assert.ok(parseCloudMedia(uploaded[0].photos[0]));
  h.local.clear();
  const receiver = createMediaSync('owner', {}, h.transport, h.io);
  const restored = await receiver.download(uploaded);
  assert.equal(h.stats().downloads, 3);
  assert.equal((await h.io.read(restored[0].photos[0], 'image', 10)).bytes[0], 1);
  assert.equal((await h.io.read(restored[0].audios[0].uri, 'audio', 10)).bytes[0], 2);
  assert.equal((await h.io.read(restored[0].videos[0].uri, 'video', 10)).bytes[0], 3);
  const again = createMediaSync('owner', receiver.cache, h.transport, h.io);
  assert.deepEqual(await again.upload(restored), uploaded);
  assert.deepEqual(await again.download(uploaded), restored);
  assert.equal(h.stats().uploads, 3);
  assert.equal(h.stats().downloads, 3);
});

test('相同照片字节的不同本机文件不会造成同步引用反复变化', async () => {
  const h = mediaHarness();
  h.local.set('p1', { bytes: Uint8Array.of(1), mime: 'image/png' });
  h.local.set('p2', { bytes: Uint8Array.of(1), mime: 'image/png' });
  const entries = [{ ...entry('a'), photos: ['p1', 'p2'] }];
  const sender = createMediaSync('owner', {}, h.transport, h.io);
  const uploaded = await sender.upload(entries);
  assert.equal(h.stats().uploads, 1);
  assert.notEqual(uploaded[0].photos[0], uploaded[0].photos[1]);
  assert.deepEqual(await sender.download(uploaded), entries);
});

test('附件上传拒绝或字节被篡改时明确失败，已下载临时文件可回滚', async () => {
  const h = mediaHarness();
  h.local.set('p1', { bytes: Uint8Array.of(1), mime: 'image/png' });
  h.local.set('p2', { bytes: Uint8Array.of(2), mime: 'image/png' });
  const entries = [{ ...entry('a'), photos: ['p1', 'p2'] }];
  const denied = createMediaSync('owner', {}, { ...h.transport, async upload() { throw new Error('quota exceeded'); } }, h.io);
  await assert.rejects(denied.upload(entries), /quota/);
  assert.deepEqual(denied.cache, {});
  const sender = createMediaSync('owner', {}, h.transport, h.io);
  const uploaded = await sender.upload(entries);
  h.local.clear();
  h.cloud.set(parseCloudMedia(uploaded[0].photos[1])!.fileID, Uint8Array.of(9));
  const receiver = createMediaSync('owner', {}, h.transport, h.io);
  await assert.rejects(receiver.download(uploaded), /校验失败/);
  assert.equal(h.local.size, 1);
  await receiver.rollback();
  assert.equal(h.local.size, 0);
});

test('附件限额按整次总量计算，Wi-Fi 无法识别时不擅自上传', async () => {
  const h = mediaHarness();
  h.local.set('large1', { bytes: new Uint8Array(15 * 1024 * 1024), mime: 'image/png' });
  h.local.set('large2', { bytes: new Uint8Array(15 * 1024 * 1024).fill(1), mime: 'image/png' });
  const sender = createMediaSync('owner', {}, h.transport, h.io);
  await assert.rejects(sender.upload([{ ...entry('a'), photos: ['large1', 'large2'] }]), /large|25 MiB/);
  assert.equal(h.stats().uploads, 1);
  assert.equal(MAX_BACKUP_MEDIA_BYTES, 25 * 1024 * 1024);
  if (typeof navigator !== 'undefined') assert.match(syncNetworkBlock(true)!, /无法确认/);
});

test('自动快照按账号隔离，读取或清除当前账号不会影响另一个账号', async () => {
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'document', { value: {}, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) }, configurable: true });
  try {
    const a = { ...defaultState(), account: account('a'), entries: [entry('private-a')] };
    const b = { ...defaultState(), account: account('b'), entries: [entry('private-b')] };
    const fileA = await writeAutoBackup(a);
    await writeAutoBackup(b);
    assert.equal((await listAutoBackups(accountSpaceKey(a.account))).length, 1);
    assert.equal((await listAutoBackups('guest')).length, 0);
    await assert.rejects(readAutoBackup(fileA.id, 'guest'), /找不到/);
    await clearAutoBackups(accountSpaceKey(b.account));
    assert.equal((await listAutoBackups(accountSpaceKey(a.account))).length, 1);
  } finally {
    if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument); else Reflect.deleteProperty(globalThis, 'document');
    if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage); else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
