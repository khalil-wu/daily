import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptBackup, encryptBackup, fromB64, isEncryptedBackup, toB64, WrongPasswordError } from '../src/utils/backupCrypto';

test('备份加密：同密码可还原，错误密码与篡改都会被拒绝', async () => {
  const payload = { entries: [{ id: 'e1', title: '山间的下午', body: '空气很清新 🌿' }], tags: [] };
  const txt = await encryptBackup(payload, '我的密码123', 1);
  const file = JSON.parse(txt);

  assert.ok(isEncryptedBackup(file));
  assert.equal(file.count, 1);
  // 明文不能出现在文件里
  assert.ok(!txt.includes('山间的下午'));

  const back = await decryptBackup<typeof payload>(file, '我的密码123');
  assert.deepEqual(back, payload);

  await assert.rejects(decryptBackup(file, '错误密码'), WrongPasswordError);

  const bytes = fromB64(file.data);
  bytes[0] ^= 1;
  await assert.rejects(decryptBackup({ ...file, data: toB64(bytes) }, '我的密码123'), WrongPasswordError);

  // 每次加密盐与 IV 都不同
  const again = JSON.parse(await encryptBackup(payload, '我的密码123', 1));
  assert.notEqual(again.kdf.salt, file.kdf.salt);
  assert.notEqual(again.data, file.data);
});

test('base64 往返覆盖所有余数长度', () => {
  for (let n = 0; n < 8; n++) {
    const b = new Uint8Array(n).map((_, i) => (i * 37 + 250) & 255);
    assert.deepEqual(fromB64(toB64(b)), b);
  }
});

test('加密备份 → 清空 → 解密合并恢复，日记与日记本完整回来', async () => {
  const { clearAllStorage } = await import('../src/store/storage');
  const { actions, getState, hydrate } = await import('../src/store/store');
  await clearAllStorage();
  await hydrate();
  await actions.wipeAll();
  const nb = actions.addNotebook('旅行手记', '#93AFCF')!;
  const e = actions.newEntry({ title: '西湖日落', body: '湖面金光闪闪', status: 'published' });
  actions.upsertEntry({ ...e, notebookId: nb.id }, true);

  const snap = actions.snapshot() as any;
  const { accounts: _a, account: _b, conflicts: _c, ...data } = snap;
  const file = JSON.parse(await encryptBackup({ app: '记得日记', ...data }, 'pass123456', 1));

  await actions.wipeAll();
  assert.equal(getState().entries.length, 0);

  const back = await decryptBackup<any>(file, 'pass123456');
  assert.equal(actions.restoreSnapshot(back, 'merge'), 1);
  const restored = getState().entries.find(x => x.id === e.id);
  assert.equal(restored?.title, '西湖日落');
  assert.ok(getState().notebooks.some(n => n.id === nb.id && n.name === '旅行手记'));
});

test('自动备份到期判断：关闭、无日记、未满 7 天都不写', async () => {
  const { isAutoBackupDue, AUTO_INTERVAL_MS } = await import('../src/services/autoBackup');
  const e = [{ id: 'a' }] as any;
  const now = 1_800_000_000_000;
  assert.equal(isAutoBackupDue({ backup: { auto: false }, entries: e }, now), false);
  assert.equal(isAutoBackupDue({ backup: { auto: true }, entries: [] }, now), false);
  assert.equal(isAutoBackupDue({ backup: { auto: true }, entries: [{ id: 'x', deletedAt: 1 }] as any }, now), false);
  assert.equal(isAutoBackupDue({ backup: { auto: true }, entries: e }, now), true);
  assert.equal(isAutoBackupDue({ backup: { auto: true, lastBackupAt: now - AUTO_INTERVAL_MS + 1000 }, entries: e }, now), false);
  assert.equal(isAutoBackupDue({ backup: { auto: true, lastBackupAt: now - AUTO_INTERVAL_MS }, entries: e }, now), true);
});

test('UTF-8 兜底编解码与内置实现一致（中文、emoji）', async () => {
  const { _utf8Encode, utf8Decode } = await import('../src/utils/backupCrypto');
  const s = '山间的下午 🌿 café ①';
  assert.deepEqual(_utf8Encode(s), new TextEncoder().encode(s));
  assert.equal(utf8Decode(new TextEncoder().encode(s)), s);
});
