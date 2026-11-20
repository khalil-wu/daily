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

export interface AutoBackupInfo {
  id: string;
  at: number;
  count: number;
}

export function isAutoBackupDue(s: Pick<AppState, 'backup' | 'entries'>, now = Date.now()) {
  if (!s.backup.auto) return false;
  if (!s.entries.some(e => !e.deletedAt)) return false;
  return !s.backup.lastBackupAt || now - s.backup.lastBackupAt >= AUTO_INTERVAL_MS;
}

export function buildSnapshotPayload(snap: AppState) {
  // 账号与待处理冲突属于本机会话状态，不进备份
  // AI 的服务地址和授权时间属于这台设备，也不进备份（密钥本来就不在 state 里）
  const { accounts: _a, account: _b, conflicts: _c, ai: _d, ...data } = snap as any;
  return { app: '记得日记', version: snap.version, exportedAt: Date.now(), ...data };
}

function countOf(snap: AppState) {
  return snap.entries.filter(e => !e.deletedAt).length;
}

/* ---------------- Web ---------------- */

type WebItem = AutoBackupInfo & { data: string };

function webRead(): WebItem[] {
  try {
    const t = globalThis.localStorage?.getItem(WEB_KEY);
    return t ? (JSON.parse(t) as WebItem[]) : [];
  } catch {
    return [];
  }
}

function webWrite(list: WebItem[]) {
  // localStorage 容量有限：写不下时逐份丢掉最旧的
  let l = list;
  while (l.length) {
    try {
      globalThis.localStorage?.setItem(WEB_KEY, JSON.stringify(l));
      return true;
    } catch {
      l = l.slice(1);
    }
  }
  return false;
}

/* ---------------- 原生 ---------------- */

function nativeDir() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Directory, Paths } = require('expo-file-system');
  const dir = new Directory(Paths.document, DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function parseName(name: string): AutoBackupInfo | null {
  const m = /^auto-(\d+)-(\d+)\.json$/.exec(name);
  return m ? { id: name, at: Number(m[1]), count: Number(m[2]) } : null;
}

/* ---------------- 对外 ---------------- */

const isWeb = () => typeof document !== 'undefined' && typeof localStorage !== 'undefined';

export async function writeAutoBackup(snap: AppState): Promise<AutoBackupInfo> {
  const at = Date.now();
  const count = countOf(snap);
  const data = JSON.stringify(buildSnapshotPayload(snap));
  const id = `auto-${at}-${count}.json`;
  if (isWeb()) {
    const list = [...webRead(), { id, at, count, data }].slice(-KEEP);
    if (!webWrite(list)) throw new Error('浏览器存储空间不足');
  } else {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { File } = require('expo-file-system');
    const dir = nativeDir();
    const f = new File(dir, id);
    f.create({ overwrite: true });
    f.write(data);
    const old = (await listAutoBackups()).slice(KEEP);
    for (const o of old) {
      try {
        new File(dir, o.id).delete();
      } catch {
        /* 删不掉的旧文件下次再试 */
      }
    }
  }
  return { id, at, count };
}

/** 最新的在前 */
export async function listAutoBackups(): Promise<AutoBackupInfo[]> {
  try {
    if (isWeb()) return webRead().map(({ id, at, count }) => ({ id, at, count })).reverse();
    const dir = nativeDir();
    return (dir.list() as { name: string }[])
      .map(x => parseName(x.name))
      .filter((x): x is AutoBackupInfo => !!x)
      .sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

export async function readAutoBackup(id: string): Promise<unknown> {
  if (isWeb()) {
    const item = webRead().find(x => x.id === id);
    if (!item) throw new Error('找不到这份自动备份');
    return JSON.parse(item.data);
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { File } = require('expo-file-system');
  return JSON.parse(await new File(nativeDir(), id).text());
}
