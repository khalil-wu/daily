import { accountSpaceKey } from '../store/accountSpaces';
import { sha256 } from '@noble/hashes/sha2.js';
import type { AppState } from '../store/types';

/**
 * 自动备份：开启后每 7 天在本机留一份完整快照，保留最近 KEEP 份。
 * 原生端写到应用文档目录（卸载前一直在），Web 端存进独立的 localStorage 键。
 * 快照和日记本身在同一个沙盒里，所以不再额外加密；需要带出设备时用「手动备份」。
 */

export const AUTO_INTERVAL_MS = 7 * 24 * 3600 * 1000;
const KEEP = 4;
const WEB_KEY = 'jide-diary:auto-backups:v1';
const DIR = 'auto-backups';
const ownerToken = (owner: string) => Array.from(sha256(new TextEncoder().encode(owner)), n => n.toString(16).padStart(2, '0')).join('').slice(0, 20);

export interface AutoBackupInfo {
  id: string;
  at: number;
  count: number;
  owner?: string;
}

export function isAutoBackupDue(s: Pick<AppState, 'backup' | 'entries'>, now = Date.now()) {
  if (!s.backup.auto) return false;
  if (!s.entries.some(e => !e.deletedAt)) return false;
  return !s.backup.lastBackupAt || now - s.backup.lastBackupAt >= AUTO_INTERVAL_MS;
}

export function buildSnapshotPayload(snap: AppState) {
  // 账号与待处理冲突属于本机会话状态，不进备份
  // AI 的服务地址和授权时间属于这台设备，也不进备份（密钥本来就不在 state 里）
  const { accounts: _a, account: _b, conflicts: _c, ai: _d, accountSpaces: _spaces, ...data } = snap;
  const { passcodeHash: _passcode, ...privacy } = data.privacy;
  return { app: '记得日记', exportedAt: Date.now(), ...data,
    privacy: { ...privacy, appLock: false, biometric: false },
    sync: { cloud: false, wifiOnly: snap.sync.wifiOnly, syncPhotos: snap.sync.syncPhotos, syncTags: snap.sync.syncTags, syncSettings: snap.sync.syncSettings },
  };
}

function countOf(snap: AppState) {
  return snap.entries.filter(e => !e.deletedAt).length;
}

/* ---------------- Web ---------------- */

type WebItem = AutoBackupInfo & { data: string };

function webRead(): WebItem[] {
  try {
    const t = globalThis.localStorage?.getItem(WEB_KEY);
    const parsed = t ? JSON.parse(t) : [];
    return Array.isArray(parsed) ? parsed.filter(x => x && typeof x.id === 'string' && typeof x.at === 'number' && typeof x.count === 'number' && typeof x.data === 'string') : [];
  } catch {
    return [];
  }
}

function webWrite(list: WebItem[], owner: string) {
  // localStorage 容量有限：写不下时逐份丢掉最旧的
  let l = list;
  while (l.length) {
    try {
      globalThis.localStorage?.setItem(WEB_KEY, JSON.stringify(l));
      return true;
    } catch {
      const own = l.filter(x => x.owner === owner);
      if (own.length <= 1) return false;
      l = l.filter(x => x !== own[0]);
    }
  }
  return false;
}

/* ---------------- 原生 ---------------- */

function nativeDir(owner?: string) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Directory, Paths } = require('expo-file-system');
  const dir = new Directory(Paths.document, DIR, ...(owner ? [ownerToken(owner)] : []));
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function parseName(name: string): AutoBackupInfo | null {
  const m = /^auto-(\d+)-(\d+)\.json$/.exec(name);
  return m ? { id: name, at: Number(m[1]), count: Number(m[2]) } : null;
}

/* ---------------- 对外 ---------------- */

const isWeb = () => typeof document !== 'undefined' && typeof localStorage !== 'undefined';

/** Attribute old snapshots once, before a user can switch the loaded account. */
export async function migrateLegacyAutoBackups(owner: string) {
  if (isWeb()) {
    const items = webRead();
    if (items.some(x => !x.owner)) localStorage.setItem(WEB_KEY, JSON.stringify(items.map(x => x.owner ? x : { ...x, owner })));
    return;
  }
  if (typeof process !== 'undefined' && process.versions?.node && typeof window === 'undefined') return;
  const { File } = require('expo-file-system');
  const root = nativeDir();
  const target = nativeDir(owner);
  for (const file of root.list() as { name: string }[]) {
    if (parseName(file.name)) new File(root, file.name).move(new File(target, file.name));
  }
}

export async function writeAutoBackup(snap: AppState): Promise<AutoBackupInfo> {
  const at = Date.now();
  const owner = accountSpaceKey(snap.account);
  const count = countOf(snap);
  const data = JSON.stringify(buildSnapshotPayload(snap));
  const id = `auto-${at}-${count}.json`;
  if (isWeb()) {
    const all = webRead();
    const list = [...all.filter(x => x.owner !== owner), ...[...all.filter(x => x.owner === owner), { id, at, count, data, owner }].slice(-KEEP)];
    if (!webWrite(list, owner)) throw new Error('浏览器存储空间不足');
  } else {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { File } = require('expo-file-system');
    const dir = nativeDir(owner);
    const f = new File(dir, id);
    f.create({ overwrite: true });
    f.write(data);
    const old = (await listAutoBackups(owner)).slice(KEEP);
    for (const o of old) {
      try {
        new File(dir, o.id).delete();
      } catch {
        /* 删不掉的旧文件下次再试 */
      }
    }
  }
  return { id, at, count, owner };
}

/** 最新的在前 */
export async function listAutoBackups(owner = 'guest'): Promise<AutoBackupInfo[]> {
  try {
    if (isWeb()) return webRead().filter(x => x.owner === owner).map(({ id, at, count }) => ({ id, at, count, owner })).reverse();
    const dir = nativeDir(owner);
    return (dir.list() as { name: string }[])
      .map(x => parseName(x.name))
      .filter((x): x is AutoBackupInfo => !!x)
      .sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

export async function readAutoBackup(id: string, owner = 'guest'): Promise<unknown> {
  if (!parseName(id)) throw new Error('备份文件名不正确');
  if (isWeb()) {
    const item = webRead().find(x => x.id === id && (x.owner === owner));
    if (!item) throw new Error('找不到这份自动备份');
    return JSON.parse(item.data);
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { File } = require('expo-file-system');
  return JSON.parse(await new File(nativeDir(owner), id).text());
}

/** Clear retained snapshots together with the user's diary data. */
export async function clearAutoBackups(owner?: string): Promise<void> {
  if (isWeb()) {
    if (owner) { localStorage.setItem(WEB_KEY, JSON.stringify(webRead().filter(x => x.owner !== owner))); }
    else localStorage.removeItem(WEB_KEY);
    return;
  }
  if (typeof process !== 'undefined' && process.versions?.node && typeof window === 'undefined') return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Directory, Paths } = require('expo-file-system');
  const dir = new Directory(Paths.document, DIR, ...(owner ? [ownerToken(owner)] : []));
  if (dir.exists) dir.delete();
}
