import type { AppState, Entry, Person } from './types';
import { DEFAULT_NOTEBOOKS, DEFAULT_TAGS, PERSON_COLORS, RELATIONS } from '../data/constants';
import { normalizeVideos } from '../utils/video';
import { normalizeBirthday } from '../utils/people';

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
      style: 'warm',
      accent: 'latte',
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
  return {
    ...e,
    tags: Array.isArray(e.tags) ? e.tags : [],
    people: Array.isArray(e.people) ? e.people.filter(x => typeof x === 'string') : [],
    photos: Array.isArray(e.photos) ? e.photos : [],
    audios: Array.isArray(e.audios) ? e.audios : [],
    videos: normalizeVideos(e.videos),
    favorite: !!e.favorite,
    pinned: !!e.pinned,
    hidden: !!e.hidden,
    status: e.status ?? 'published',
  } as Entry;
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
    profile: { ...d.profile, ...(raw.profile ?? {}) },
    appearance: { ...d.appearance, ...(raw.appearance ?? {}) },
    ai: { ...d.ai, ...(raw.ai ?? {}) },
    reviews: Array.isArray(raw.reviews) ? raw.reviews.filter(x => !!x && typeof x === 'object' && typeof x.id === 'string') : [],
    people: normalizePeople(raw.people),
    reminders: { ...d.reminders, ...(raw.reminders ?? {}) },
    privacy: { ...d.privacy, ...(raw.privacy ?? {}) },
    sync: { ...d.sync, ...(raw.sync ?? {}) },
    backup: { ...d.backup, ...(raw.backup ?? {}) },
    permissionsAsked: { ...d.permissionsAsked, ...(raw.permissionsAsked ?? {}) },
    entries: Array.isArray(raw.entries) ? raw.entries.map(normalizeEntry) : [],
    tags: Array.isArray(raw.tags) && raw.tags.length ? raw.tags : d.tags,
    notebooks: Array.isArray(raw.notebooks) && raw.notebooks.length ? raw.notebooks : d.notebooks,
    activeNotebook:
      typeof raw.activeNotebook === 'string' && Array.isArray(raw.notebooks) && raw.notebooks.some(n => n.id === raw.activeNotebook)
        ? raw.activeNotebook
        : null,
    goals: { ...d.goals, ...(raw.goals ?? {}) },
    accounts: Array.isArray(raw.accounts) ? raw.accounts : [],
    recentSearches: Array.isArray(raw.recentSearches) ? raw.recentSearches : [],
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
    return normalizeState(JSON.parse(txt));
  } catch {
    return defaultState();
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: AppState | null = null;

export function saveState(state: AppState, immediate = false) {
  pending = state;
  if (timer) clearTimeout(timer);
  const flush = async () => {
    timer = null;
    const s = pending;
    pending = null;
    if (!s) return;
    try {
      await getStorage().setItem(KEY, JSON.stringify(s));
    } catch (e) {
      console.warn('保存失败', e);
    }
  };
  if (immediate) return flush();
  timer = setTimeout(flush, 250);
  return Promise.resolve();
}

export async function clearAllStorage() {
  await getStorage().removeItem(KEY);
  await getStorage().removeItem(CLOUD_KEY);
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
