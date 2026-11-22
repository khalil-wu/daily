import type { AppState, Entry, Person } from './types';
import { DEFAULT_NOTEBOOKS, DEFAULT_TAGS, PERSON_COLORS, RELATIONS } from '../data/constants';
import { normalizeVideos } from '../utils/video';
import { normalizeBirthday } from '../utils/people';
import { uid } from '../utils/text';
import { createWriteQueue } from './persistence';

const KEY = 'jide-diary:state:v1';
const mem = new Map<string, string>();

interface KVStore {
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
  removeItem(k: string): Promise<void>;
}

const memDriver: KVStore = {
  async getItem(k) { return mem.get(k) ?? null; },
  async setItem(k, v) { mem.set(k, v); },
  async removeItem(k) { mem.delete(k); },
};

function getStorage(): KVStore {
  if (typeof process !== 'undefined' && process.versions?.node && typeof window === 'undefined') {
    return memDriver;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-async-storage/async-storage');
    return mod?.default ?? mod ?? memDriver;
  } catch {
    return memDriver;
  }
}

export function defaultState(): AppState {
  return {
    version: 1,
    onboarded: false,
    tutorialSeen: false,
    editorTourSeen: false,
    shelfTourSeen: false,
    shelfDragHintSeen: false,
    usageMode: null,
    entries: [],
    tags: DEFAULT_TAGS,
    people: [],
    notebooks: DEFAULT_NOTEBOOKS,
    activeNotebook: null,
    goals: { enabled: true, dailyWords: 200 },
    accounts: [],
    profile: { name: '记得自己', avatar: 'asset:avatar', signature: '记下生活，记得自己' },
    ai: { enabled: false, baseUrl: '', model: '', autoReply: true, useMemory: true },
    reviews: [],
    appearance: {
      theme: 'light',
      style: 'companion',
      accent: 'teal',
      fontScale: 'standard',
      fontFamily: 'serif',
      lineHeight: 'standard',
      contentWidth: 0.5,
      cardStyle: 'image',
      homeView: 'list',
    },
    reminders: {
      daily: true,
      hour: 20,
      minute: 30,
      repeat: 'daily',
      days: [0, 1, 2, 3, 4, 5, 6],
      text: '该写日记啦 ✨ 记录今天的生活，想法与心情',
      important: true,
      method: 'notify_sound',
    },
    privacy: { appLock: false, biometric: false, lockHidden: true, encryptBackup: false, lockDelay: 0 },
    sync: { cloud: false, wifiOnly: true, syncPhotos: true, syncTags: true, syncSettings: true },
    backup: { auto: true },
    recentSearches: [],
    conflicts: [],
    firstUseAt: Date.now(),
    permissionsAsked: {},
  };
}

/** 补全单篇日记的字段：旧版本数据、外部导入的 JSON、云端快照都从这里过一遍 */
export function normalizeEntry(item: unknown): Entry {
  const e = (item && typeof item === 'object' ? item : {}) as Partial<Entry>;
  const timestamp = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;
  const strings = (v: unknown): string[] => Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string' && x))] : [];
  const createdAt = timestamp(e.createdAt, Date.now());
  return {
    ...e,
    id: typeof e.id === 'string' && e.id.trim() ? e.id : uid('e'),
    title: typeof e.title === 'string' ? e.title : '',
    body: typeof e.body === 'string' ? e.body : '',
    createdAt,
    updatedAt: timestamp(e.updatedAt, createdAt),
    deletedAt: typeof e.deletedAt === 'number' && Number.isFinite(e.deletedAt) && e.deletedAt > 0 ? e.deletedAt : undefined,
    purgedAt: typeof e.purgedAt === 'number' && Number.isFinite(e.purgedAt) && e.purgedAt > 0 ? e.purgedAt : undefined,
    tags: strings(e.tags),
    people: strings(e.people),
    photos: strings(e.photos),
    audios: Array.isArray(e.audios) ? e.audios.filter(a => a && typeof a.id === 'string' && typeof a.uri === 'string').map(a => ({ ...a, duration: timestamp(a.duration, 0), createdAt: timestamp(a.createdAt, createdAt) })) : [],
    videos: normalizeVideos(e.videos),
    favorite: !!e.favorite,
    pinned: !!e.pinned,
    hidden: !!e.hidden,
    status: e.status === 'draft' ? 'draft' : 'published',
    place: e.place && typeof e.place.name === 'string' ? e.place : undefined,
  } as Entry;
}

export function isEntryRecord(value: unknown): value is Partial<Entry> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && ['id', 'title', 'body'].some(key => typeof (value as Record<string, unknown>)[key] === 'string');
}

/** 补全身边人字段；没有名字的记录直接丢弃 */
export function normalizePeople(raw: unknown): Person[] {
  if (!Array.isArray(raw)) return [];
  const out: Person[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const p = (item && typeof item === 'object' ? item : {}) as Partial<Person>;
    const name = typeof p.name === 'string' ? p.name.trim() : '';
    if (!name || typeof p.id !== 'string' || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push({
      id: p.id,
      name,
      relation: RELATIONS.some(r => r.key === p.relation) ? p.relation! : 'other',
      aliases: Array.isArray(p.aliases) ? p.aliases.filter(a => typeof a === 'string' && a.trim()).map(a => a.trim()) : [],
      note: typeof p.note === 'string' && p.note ? p.note : undefined,
      birthday: typeof p.birthday === 'string' ? normalizeBirthday(p.birthday) ?? undefined : undefined,
      color: typeof p.color === 'string' && p.color ? p.color : PERSON_COLORS[out.length % PERSON_COLORS.length],
      createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
    });
  }
  return out;
}

/** 合并旧数据与默认值，保证新增字段存在 */
export function normalizeState(raw: Partial<AppState> | null | undefined): AppState {
  const d = defaultState();
  if (!raw || typeof raw !== 'object') return d;
  return {
    ...d,
    ...raw,
    profile: {
      name: typeof raw.profile?.name === 'string' ? raw.profile.name : d.profile.name,
      signature: typeof raw.profile?.signature === 'string' ? raw.profile.signature : d.profile.signature,
      avatar: typeof raw.profile?.avatar === 'string' ? raw.profile.avatar : d.profile.avatar,
      cover: typeof raw.profile?.cover === 'string' ? raw.profile.cover : undefined,
    },
    appearance: { ...d.appearance, ...(raw.appearance ?? {}) },
    ai: { ...d.ai, ...(raw.ai ?? {}) },
    reviews: Array.isArray(raw.reviews) ? raw.reviews.filter(x => !!x && typeof x === 'object' && typeof x.id === 'string') : [],
    people: normalizePeople(raw.people),
    reminders: { ...d.reminders, ...(raw.reminders ?? {}) },
    privacy: { ...d.privacy, ...(raw.privacy ?? {}) },
    sync: { ...d.sync, ...(raw.sync ?? {}) },
    backup: { ...d.backup, ...(raw.backup ?? {}) },
    permissionsAsked: { ...d.permissionsAsked, ...(raw.permissionsAsked ?? {}) },
    entries: Array.isArray(raw.entries) ? raw.entries.filter(isEntryRecord).map(normalizeEntry) : [],
    tags: Array.isArray(raw.tags) && raw.tags.length ? raw.tags.filter(t => t && typeof t.id === 'string' && typeof t.name === 'string').map(t => ({ ...t, icon: typeof t.icon === 'string' ? t.icon : 'Star' })) : d.tags,
    notebooks: Array.isArray(raw.notebooks) && raw.notebooks.length ? raw.notebooks.filter(n => n && typeof n.id === 'string' && typeof n.name === 'string') : d.notebooks,
    activeNotebook:
      typeof raw.activeNotebook === 'string' && Array.isArray(raw.notebooks) && raw.notebooks.some(n => n?.id === raw.activeNotebook)
        ? raw.activeNotebook
        : null,
    goals: { ...d.goals, ...(raw.goals ?? {}) },
    accounts: Array.isArray(raw.accounts) ? raw.accounts : [],
    recentSearches: Array.isArray(raw.recentSearches) ? raw.recentSearches.filter(x => typeof x === 'string') : [],
    conflicts: Array.isArray(raw.conflicts)
      ? raw.conflicts.filter(x => !!x && typeof x === 'object').map(x => ({ ...x, cloudEntry: normalizeEntry(x.cloudEntry) }))
      : [],
    version: 1,
  };
}

export async function loadState(): Promise<AppState> {
  try {
    const txt = await getStorage().getItem(KEY);
    if (!txt) return defaultState();
    const loaded = normalizeState(JSON.parse(txt));
    persistedSnapshot = loaded;
    return loaded;
  } catch {
    return defaultState();
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: AppState | null = null;
let persistenceError: string | null = null;
let persistedSnapshot: AppState | null = null;
export const getPersistedSnapshot = () => persistedSnapshot;
const persistenceListeners = new Set<() => void>();
export const getPersistenceError = () => persistenceError;
export function subscribePersistenceError(listener: () => void) {
  persistenceListeners.add(listener);
  return () => { persistenceListeners.delete(listener); };
}
function setPersistenceError(message: string | null) {
  if (persistenceError === message) return;
  persistenceError = message;
  persistenceListeners.forEach(fn => fn());
}
const writes = createWriteQueue(async (snapshot: AppState) => {
  try {
    await getStorage().setItem(KEY, JSON.stringify(snapshot));
    persistedSnapshot = snapshot;
    setPersistenceError(null);
    persistenceListeners.forEach(fn => fn());
  } catch {
    setPersistenceError('日记尚未保存到设备，请释放存储空间后重试');
    throw new Error(persistenceError!);
  }
});

export async function flushPendingState(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  const snapshot = pending;
  pending = null;
  if (snapshot) await writes.write(snapshot);
  else await writes.settled();
}

export function saveState(state: AppState, immediate = false) {
  pending = state;
  if (timer) clearTimeout(timer);
  if (immediate) return flushPendingState();
  timer = setTimeout(() => { void flushPendingState().catch(() => {}); }, 250);
  return Promise.resolve();
}

export async function clearAllStorage() {
  if (timer) clearTimeout(timer);
  timer = null;
  pending = null;
  await writes.settled();
  await getStorage().removeItem(KEY);
  await getStorage().removeItem(CLOUD_KEY);
  persistedSnapshot = null;
  setPersistenceError(null);
}

/** —— 模拟云端（无服务端时，用独立存储空间模拟云端快照，便于演示同步/冲突流程） —— */
export const CLOUD_KEY = 'jide-diary:cloud:v1';

export async function loadCloud(): Promise<Record<string, { entries: AppState['entries']; updatedAt: number }>> {
  try {
    const t = await getStorage().getItem(CLOUD_KEY);
    if (!t) return {};
    const data = JSON.parse(t) as Record<string, { entries: AppState['entries']; updatedAt: number }>;
    // 云端快照可能是旧版本存下的，缺少后来新增的字段（如 videos）
    for (const key of Object.keys(data)) {
      const snap = data[key];
      if (snap && Array.isArray(snap.entries)) snap.entries = snap.entries.map(normalizeEntry);
    }
    return data;
  } catch {
    return {};
  }
}

export async function saveCloud(data: Record<string, { entries: AppState['entries']; updatedAt: number }>) {
  await getStorage().setItem(CLOUD_KEY, JSON.stringify(data));
}
