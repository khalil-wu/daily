import test from 'node:test';
import assert from 'node:assert/strict';
import { createPortableBackup, restorePortableBackup, isSafeStoredMediaUri, MAX_BACKUP_MEDIA_BYTES, type BackupMediaIO, type MediaKind } from '../src/services/backupMedia';
import { defaultState, normalizeEntry } from '../src/store/storage';
import { decryptBackup, encryptBackup } from '../src/utils/backupCrypto';
import { actions, hydrate } from '../src/store/store';

function fixture() {
  const snapshot = defaultState();
  snapshot.profile.avatar = 'idb:photo/avatar';
  snapshot.profile.cover = 'idb:photo/cover';
  snapshot.entries = [normalizeEntry({
    id: 'diary', title: '湖边', body: '带着照片与声音的日记',
    photos: ['idb:photo/shared', 'idb:photo/shared', 'asset:photo-lake'],
    audios: [{ id: 'audio', uri: 'idb:video/audio', duration: 12, createdAt: 100 }],
    videos: [{ id: 'video', uri: 'idb:video/video', poster: 'idb:photo/poster', duration: 20, createdAt: 100 }],
  }), normalizeEntry({ id: 'diary-shared', body: '同一张照片', photos: ['idb:photo/shared'] })];
  return snapshot;
}

function memoryIO() {
  const calls = { reads: [] as string[], removed: [] as string[] };
  const written = new Map<string, { kind: MediaKind; mime: string; bytes: Uint8Array }>();
  const io: BackupMediaIO = {
    async read(uri, kind, maxBytes) {
      calls.reads.push(uri);
      const bytes = new TextEncoder().encode(`binary:${uri}`);
      assert.ok(bytes.length <= maxBytes);
      return { bytes, mime: kind === 'image' ? 'image/png' : `${kind}/mp4` };
    },
    async write(kind, mime, bytes) {
      const uri = `idb:${kind === 'image' ? 'photo' : 'video'}/restored_${written.size}`;
      written.set(uri, { kind, mime, bytes });
      return uri;
    },
    async remove(uri) { calls.removed.push(uri); written.delete(uri); },
  };
  return { io, calls, written };
}

test('完整备份打包照片、录音、视频、封面与头像，相同附件只读取一次', async () => {
  const snapshot = fixture();
  const { io, calls } = memoryIO();
  const result = await createPortableBackup(snapshot, io);
  assert.equal(result.media.length, 6);
  assert.equal(calls.reads.filter(uri => uri === 'idb:photo/shared').length, 1);
  assert.equal(result.entries[0].photos[0], result.entries[1].photos[0]);
  assert.equal(result.entries[0].photos[1], 'asset:photo-lake');
  assert.ok(result.entries[0].audios[0].uri.startsWith('backup-media:'));
  assert.ok(result.entries[0].videos[0].poster?.startsWith('backup-media:'));
  assert.ok(result.profile.avatar?.startsWith('backup-media:'));
  assert.equal(snapshot.entries[0].photos[0], 'idb:photo/shared');
});

test('加密媒体备份跨设备恢复真实字节，所有引用在持久化完成后重写', async () => {
  const { io: source } = memoryIO();
  const portable = await createPortableBackup(fixture(), source);
  const encrypted = JSON.parse(await encryptBackup(portable, 'portable-pass', 1));
  const decrypted = await decryptBackup(encrypted, 'portable-pass');
  const target = memoryIO();
  const restored = await restorePortableBackup(decrypted, target.io);
  assert.equal(restored.legacy, false);
  assert.equal(restored.mediaCount, 6);
  assert.equal('media' in restored.snapshot, false);
  const audioUri = restored.snapshot.entries[0].audios[0].uri;
  assert.equal(new TextDecoder().decode(target.written.get(audioUri)?.bytes), 'binary:idb:video/audio');
  assert.equal(target.written.get(audioUri)?.mime, 'audio/mp4');
  assert.equal(restored.snapshot.entries[0].body, '带着照片与声音的日记');
  assert.equal(restored.snapshot.entries[0].photos[0], restored.snapshot.entries[1].photos[0]);
});

test('缺失附件与过大的附件均明确拒绝，不生成假完整备份', async () => {
  const missing = memoryIO();
  missing.io.read = async () => { throw new Error('附件已丢失'); };
  await assert.rejects(createPortableBackup(fixture(), missing.io), /丢失/);
  const oversized = memoryIO();
  oversized.io.read = async () => ({ bytes: new Uint8Array(MAX_BACKUP_MEDIA_BYTES + 1), mime: 'image/png' });
  await assert.rejects(createPortableBackup(fixture(), oversized.io), /25 MiB/);
});

test('恢复校验拒绝文件路径注入、目录穿越、重复附件和未打包引用', async () => {
  const portable = await createPortableBackup(fixture(), memoryIO().io);
  const target = memoryIO();
  const bad = structuredClone(portable);
  bad.entries[0].photos[0] = 'file:///etc/passwd';
  await assert.rejects(restorePortableBackup(bad, target.io), /未打包/);
  const missing = structuredClone(portable);
  missing.entries[0].photos[0] = 'backup-media:missing';
  await assert.rejects(restorePortableBackup(missing, target.io), /缺少/);
  const duplicate = structuredClone(portable);
  duplicate.media.push(duplicate.media[0]);
  await assert.rejects(restorePortableBackup(duplicate, target.io), /无效/);
  const legacy = fixture();
  legacy.entries[0].photos = ['appdoc:photos/../../credentials'];
  await assert.rejects(restorePortableBackup(legacy, target.io), /不安全/);
  assert.equal(target.written.size, 0);
  assert.equal(target.calls.reads.length, 0);
  assert.equal(isSafeStoredMediaUri('appdoc:videos/%2e%2e/secrets'), false);
  assert.equal(isSafeStoredMediaUri('idb:photo/../../secrets'), false);
});

test('附件篡改与中途保存失败会回滚新文件，原有日记不被修改', async () => {
  const source = fixture();
  const portable = await createPortableBackup(source, memoryIO().io);
  portable.media[1].sha256 = '0'.repeat(64);
  const damaged = memoryIO();
  await assert.rejects(restorePortableBackup(portable, damaged.io), /已损坏/);
  assert.equal(damaged.written.size, 0);
  assert.equal(damaged.calls.removed.length, 1);
  const clean = await createPortableBackup(source, memoryIO().io);
  const failing = memoryIO();
  const write = failing.io.write;
  failing.io.write = async (...args) => {
    if (failing.written.size) throw new Error('磁盘已满');
    return write(...args);
  };
  await assert.rejects(restorePortableBackup(clean, failing.io), /磁盘已满/);
  assert.equal(failing.written.size, 0);
  assert.equal(source.entries[0].photos[0], 'idb:photo/shared');
});

test('旧 JSON 保留文字与安全附件位置，恢复过程不会读取旧路径', async () => {
  const source = fixture();
  const target = memoryIO();
  const restored = await restorePortableBackup(source, target.io);
  assert.equal(restored.legacy, true);
  assert.equal(restored.mediaCount, 0);
  assert.equal(restored.snapshot.entries[0].photos[0], 'idb:photo/shared');
  assert.equal(target.calls.reads.length, 0);
  assert.equal(target.written.size, 0);
});

test('录音共用媒体存储时，被日记引用的文件不会误删', async () => {
  await hydrate();
  await actions.wipeAll();
  const audio = fixture().entries[0].audios[0];
  await actions.upsertEntry(normalizeEntry({ id: 'audio-diary', body: '录音', audios: [audio] }), true);
  assert.equal(actions.releaseVideos([audio]), 0);
  actions.destroyEntry('audio-diary');
  assert.equal(actions.releaseVideos([audio]), 1);
});
