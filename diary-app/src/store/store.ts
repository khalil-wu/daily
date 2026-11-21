import { useRef, useSyncExternalStore } from 'react';
import type { AppState, Entry, EntryAI, Notebook, PeriodReview, Person, RelationKey, StoredAccount, SyncConflict, Tag, VideoClip } from './types';
import { defaultState, loadState, normalizeEntry, normalizeState, saveState, clearAllStorage, loadCloud, saveCloud } from './storage';
import { uid, sha256, isPhone } from '../utils/text';
import {
  initCloud, cloudConfigured, currentRemoteAccount,
  loginByPhone, loginByEmail, loginByPassword, registerByEmail,
  sendSmsCode, sendEmailCode, sendResetSmsCode, resetPasswordBySms, requestPasswordResetEmail,
  logoutRemote, pullRemoteEntries, pushRemoteEntries, destroyRemoteAccount, cloudError,
} from '../services/cloud';
import { unreferencedVideos } from '../utils/video';
import { normalizeBirthday } from '../utils/people';
import { clearAllVideoFiles, discardVideoFiles } from '../services/videoStore';
import { clearAllPhotoFiles, discardPhotoFiles, unreferencedPhotos } from '../services/photoStore';
import { clearAIKey } from '../services/aiKey';
import { buildSampleDrafts, buildSampleEntries } from '../data/samples';
import { DEFAULT_NOTEBOOK_ID, PERSON_COLORS } from '../data/constants';

/* ---------------- 底层 store ---------------- */

let state: AppState = defaultState();
let hydrated = false;
/** 当前正在进行的新手导览：home = 首页导览，editor = 写作页导览 */
export type TourKind = 'home' | 'editor';
let activeTour: TourKind | null = null;
const listeners = new Set<() => void>();
const hydrateListeners = new Set<() => void>();
const tutorialListeners = new Set<() => void>();

function emit() {
  listeners.forEach(l => l());
}

export function openTutorial(kind: TourKind = 'home') {
  activeTour = kind;
  tutorialListeners.forEach(l => l());
}

export function closeTutorial() {
  activeTour = null;
  tutorialListeners.forEach(l => l());
}

export function useActiveTour(): TourKind | null {
  return useSyncExternalStore(
    cb => {
      tutorialListeners.add(cb);
      return () => tutorialListeners.delete(cb);
    },
    () => activeTour,
    () => activeTour,
  );
}

export function useTutorialVisible() {
  return useActiveTour() !== null;
}

export function getState() {
  return state;
}

export function setState(updater: (s: AppState) => AppState, immediate = false) {
  const next = updater(state);
  if (next === state) return;
  state = next;
  emit();
  if (hydrated) void saveState(state, immediate);
}

export async function hydrate() {
  if (hydrated) return;
  state = await loadState();
  hydrated = true;
  emit();
  hydrateListeners.forEach(l => l());
  // 恢复云端登录态：本地存的是云端账号但会话已失效时，要求重新登录
  initCloud();
  void currentRemoteAccount().then(remote => {
    if (!state.account?.remote && !remote) return;
    if (remote && state.account?.remote && remote.id === state.account.id) return;
    setState(s => ({
      ...s,
      account: remote ?? undefined,
      usageMode: remote ? 'account' : s.usageMode === 'account' ? 'local' : s.usageMode,
      sync: remote ? s.sync : { ...s.sync, cloud: false },
    }), true);
  }).catch(() => {});
}

export function isHydrated() {
  return hydrated;
}

export function useHydrated() {
  return useSyncExternalStore(
    cb => {
      hydrateListeners.add(cb);
      return () => hydrateListeners.delete(cb);
    },
    () => hydrated,
    () => hydrated,
  );
}

function shallowEqual(a: unknown, b: unknown) {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
    return true;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (!Object.is((a as any)[k], (b as any)[k])) return false;
    return true;
  }
  return false;
}

/** 订阅 store 的某一部分；返回值做浅比较，避免无谓重渲染 */
export function useStore<T>(selector: (s: AppState) => T): T {
  const cache = useRef<{ s: AppState; v: T } | null>(null);
  const get = () => {
    const c = cache.current;
    if (c && c.s === state) return c.v;
    const v = selector(state);
    if (c && shallowEqual(c.v, v)) {
      cache.current = { s: state, v: c.v };
      return c.v;
    }
    cache.current = { s: state, v };
    return v;
  };
  return useSyncExternalStore(
    cb => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    get,
    get,
  );
}

/* ---------------- 选择器 ---------------- */

export const selectAlive = (s: AppState) => s.entries.filter(e => !e.deletedAt);
export const selectPublished = (s: AppState) =>
  s.entries.filter(e => !e.deletedAt && e.status === 'published').sort((a, b) => b.createdAt - a.createdAt);
export const selectDrafts = (s: AppState) =>
  s.entries.filter(e => !e.deletedAt && e.status === 'draft').sort((a, b) => b.updatedAt - a.updatedAt);
export const selectTrash = (s: AppState) =>
  s.entries.filter(e => !!e.deletedAt).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));

export function useEntry(id?: string) {
  return useStore(s => (id ? s.entries.find(e => e.id === id) : undefined));
}

/** 日记是否属于某个日记本（null = 全部；默认日记本包含未指定 notebookId 的日记） */
export function inNotebook(e: Entry, notebookId: string | null) {
  if (!notebookId) return true;
  if (notebookId === DEFAULT_NOTEBOOK_ID) return !e.notebookId || e.notebookId === DEFAULT_NOTEBOOK_ID;
  return e.notebookId === notebookId;
}

/** 回收站保留天数 */
export const TRASH_DAYS = 30;

/* ---------------- 动作 ---------------- */

function patchEntry(id: string, patch: Partial<Entry>, touch = true) {
  setState(s => ({
    ...s,
    entries: s.entries.map(e => (e.id === id ? { ...e, ...patch, ...(touch ? { updatedAt: Date.now() } : {}) } : e)),
  }));
}

/**
 * 清理视频文件：候选里已经没有任何日记（含草稿、回收站、待处理的云端冲突版本）在引用的，才会被删除。
 * 返回被清理的段数。
 */
function releaseVideos(candidates: VideoClip[]) {
  if (!candidates.length) return 0;
  const holders = [...state.entries, ...state.conflicts.map(c => c.cloudEntry)];
  const orphans = unreferencedVideos(candidates, holders);
  if (orphans.length) void discardVideoFiles(orphans);
  return orphans.length;
}

/** 清理照片文件：规则同视频，只删应用自己收进来的、已经没人引用的文件 */
function releasePhotos(candidates: string[]) {
  if (!candidates.length) return 0;
  const holders = [...state.entries, ...state.conflicts.map(c => c.cloudEntry)];
  const orphans = unreferencedPhotos(candidates, holders);
  if (orphans.length) void discardPhotoFiles(orphans);
  return orphans.length;
}

export const actions = {
  /* —— 引导 & 模式 —— */
  completeOnboarding(mode: 'local' | 'account') {
    setState(s => ({ ...s, onboarded: true, usageMode: mode }), true);
  },
  setTutorialSeen(seen: boolean) {
    setState(s => ({ ...s, tutorialSeen: seen }), true);
  },
  setEditorTourSeen(seen: boolean) {
    setState(s => ({ ...s, editorTourSeen: seen }), true);
  },

  /* —— 日记 —— */
  newEntry(partial: Partial<Entry> = {}): Entry {
    const now = Date.now();
    return {
      id: uid('e'),
      title: '',
      body: '',
      createdAt: now,
      updatedAt: now,
      tags: [],
      people: [],
      photos: [],
      audios: [],
      videos: [],
      favorite: false,
      pinned: false,
      hidden: false,
      status: 'draft',
      ...partial,
    };
  },

  /** 新增或整体覆盖 */
  upsertEntry(entry: Entry, immediate = false) {
    setState(s => {
      const exists = s.entries.some(e => e.id === entry.id);
      return {
        ...s,
        entries: exists ? s.entries.map(e => (e.id === entry.id ? entry : e)) : [entry, ...s.entries],
      };
    }, immediate);
  },

  updateEntry(id: string, patch: Partial<Entry>) {
    patchEntry(id, patch);
  },

  publishEntry(entry: Entry) {
    actions.upsertEntry({ ...entry, status: 'published', updatedAt: Date.now() }, true);
  },

  toggleFavorite(id: string) {
    const e = state.entries.find(x => x.id === id);
    if (e) patchEntry(id, { favorite: !e.favorite }, false);
    return !e?.favorite;
  },

  togglePinned(id: string) {
    const e = state.entries.find(x => x.id === id);
    if (e) patchEntry(id, { pinned: !e.pinned }, false);
    return !e?.pinned;
  },

  toggleHidden(id: string) {
    const e = state.entries.find(x => x.id === id);
    if (e) patchEntry(id, { hidden: !e.hidden }, false);
    return !e?.hidden;
  },

  /** 移入回收站 */
  trashEntry(id: string) {
    patchEntry(id, { deletedAt: Date.now() }, false);
  },

  restoreEntry(id: string) {
    setState(s => ({ ...s, entries: s.entries.map(e => (e.id === id ? { ...e, deletedAt: undefined } : e)) }));
  },

  /** 彻底删除（连同只属于这篇日记的照片、视频文件） */
  destroyEntry(id: string) {
    const gone = state.entries.filter(e => e.id === id);
    setState(s => ({ ...s, entries: s.entries.filter(e => e.id !== id) }));
    releaseVideos(gone.flatMap(e => e.videos));
    releasePhotos(gone.flatMap(e => e.photos));
  },

  emptyTrash() {
    const gone = state.entries.filter(e => !!e.deletedAt);
    setState(s => ({ ...s, entries: s.entries.filter(e => !e.deletedAt) }));
    releaseVideos(gone.flatMap(e => e.videos));
    releasePhotos(gone.flatMap(e => e.photos));
  },

  /** 视频文件清理入口：只删除已经没有任何日记引用的文件 */
  releaseVideos(candidates: VideoClip[]) {
    return releaseVideos(candidates);
  },

  /** 照片文件清理入口：规则同视频 */
  releasePhotos(candidates: string[]) {
    return releasePhotos(candidates);
  },

  /** 清理超过 30 天的回收站条目 */
  purgeExpiredTrash() {
    const limit = Date.now() - TRASH_DAYS * 86400000;
    const gone = state.entries.filter(e => !!e.deletedAt && e.deletedAt <= limit);
    setState(s => {
      const keep = s.entries.filter(e => !e.deletedAt || e.deletedAt > limit);
      return keep.length === s.entries.length ? s : { ...s, entries: keep };
    });
    releaseVideos(gone.flatMap(e => e.videos));
    releasePhotos(gone.flatMap(e => e.photos));
  },

  importSamples() {
    setState(s => ({ ...s, entries: [...buildSampleEntries(), ...buildSampleDrafts(), ...s.entries] }), true);
  },

  importEntries(list: Entry[]) {
    setState(s => {
      const ids = new Set(s.entries.map(e => e.id));
      // 外部文件可能来自旧版本，缺少后来新增的字段（如 videos），先补全再入库
      const add = list.map(normalizeEntry).map(e => (ids.has(e.id) ? { ...e, id: uid('e') } : e));
      return { ...s, entries: [...add, ...s.entries] };
    }, true);
    return list.length;
  },

  /* —— 标签 —— */
  addTag(name: string, icon = 'Star'): Tag {
    const exist = state.tags.find(t => t.name === name.trim());
    if (exist) return exist;
    const tag: Tag = { id: uid('t'), name: name.trim(), icon };
    setState(s => ({ ...s, tags: [...s.tags, tag] }));
    return tag;
  },

  removeTag(id: string) {
    setState(s => ({
      ...s,
      tags: s.tags.filter(t => t.id !== id),
      entries: s.entries.map(e => (e.tags.includes(id) ? { ...e, tags: e.tags.filter(x => x !== id) } : e)),
    }));
  },

  /* —— 身边人 —— */
  addPerson(name: string, relation: RelationKey = 'other', extra: Partial<Pick<Person, 'aliases' | 'note' | 'birthday' | 'color'>> = {}): Person | null {
    const n = name.trim().slice(0, 12);
    if (!n) return null;
    const exist = state.people.find(p => p.name === n);
    if (exist) return exist;
    const person: Person = {
      id: uid('p'),
      name: n,
      relation,
      aliases: (extra.aliases ?? []).map(a => a.trim()).filter(a => a && a !== n),
      note: extra.note?.trim() || undefined,
      birthday: extra.birthday ? normalizeBirthday(extra.birthday) ?? undefined : undefined,
      color: extra.color ?? PERSON_COLORS[state.people.length % PERSON_COLORS.length],
      createdAt: Date.now(),
    };
    setState(s => ({ ...s, people: [...s.people, person] }));
    return person;
  },

  updatePerson(id: string, patch: Partial<Omit<Person, 'id' | 'createdAt'>>) {
    setState(s => ({
      ...s,
      people: s.people.map(p => {
        if (p.id !== id) return p;
        const name = (patch.name ?? p.name).trim().slice(0, 12) || p.name;
        // 改名不能和别人重名
        const taken = s.people.some(o => o.id !== id && o.name === name);
        return {
          ...p,
          ...patch,
          name: taken ? p.name : name,
          aliases: (patch.aliases ?? p.aliases).map(a => a.trim()).filter(a => a && a !== name),
          note: patch.note !== undefined ? patch.note.trim() || undefined : p.note,
          birthday: patch.birthday !== undefined ? normalizeBirthday(patch.birthday) ?? undefined : p.birthday,
        };
      }),
    }));
  },

  /** 删除身边人：日记本身保留，只解除关联 */
  removePerson(id: string) {
    setState(s => ({
      ...s,
      people: s.people.filter(p => p.id !== id),
      entries: s.entries.map(e => (e.people.includes(id) ? { ...e, people: e.people.filter(x => x !== id) } : e)),
    }));
  },

  /* —— 「记得」（AI） —— */
  setAI(p: Partial<AppState['ai']>) {
    setState(s => ({ ...s, ai: { ...s.ai, ...p } }), true);
  },

  /** 写入或清除某篇日记的 AI 内容；不算作对日记的修改（updatedAt 不变） */
  setEntryAI(id: string, patch: Partial<EntryAI>) {
    setState(s => ({
      ...s,
      entries: s.entries.map(e => {
        if (e.id !== id) return e;
        const next: EntryAI = { ...(e.ai ?? {}), ...patch };
        (Object.keys(next) as (keyof EntryAI)[]).forEach(k => next[k] === undefined && delete next[k]);
        return { ...e, ai: Object.keys(next).length ? next : undefined };
      }),
    }));
  },

  /** 保存一份周 / 月回顾；同一时段只留最新的一份 */
  saveReview(review: PeriodReview) {
    setState(s => ({
      ...s,
      reviews: [review, ...s.reviews.filter(r => !(r.kind === review.kind && r.from === review.from))].slice(0, 60),
    }));
  },

  removeReview(id: string) {
    setState(s => ({ ...s, reviews: s.reviews.filter(r => r.id !== id) }));
  },

  /* —— 日记本 —— */
  addNotebook(name: string, color: string): Notebook | null {
    const n = name.trim();
    if (!n) return null;
    const exist = state.notebooks.find(x => x.name === n);
    if (exist) return exist;
    const nb: Notebook = { id: uid('nb'), name: n.slice(0, 16), color, createdAt: Date.now() };
    setState(s => ({ ...s, notebooks: [...s.notebooks, nb] }));
    return nb;
  },

  updateNotebook(id: string, patch: Partial<Pick<Notebook, 'name' | 'color'>>) {
    setState(s => ({
      ...s,
      notebooks: s.notebooks.map(n => (n.id === id ? { ...n, ...patch, name: (patch.name ?? n.name).trim().slice(0, 16) || n.name } : n)),
    }));
  },

  /** 删除日记本：其中的日记归入默认日记本，默认日记本不可删除 */
  removeNotebook(id: string) {
    if (id === DEFAULT_NOTEBOOK_ID) return false;
    setState(s => ({
      ...s,
      notebooks: s.notebooks.filter(n => n.id !== id),
      activeNotebook: s.activeNotebook === id ? null : s.activeNotebook,
      entries: s.entries.map(e => (e.notebookId === id ? { ...e, notebookId: undefined } : e)),
    }));
    return true;
  },

  setActiveNotebook(id: string | null) {
    setState(s => ({ ...s, activeNotebook: id }));
  },

  moveToNotebook(entryIds: string[], notebookId: string) {
    const ids = new Set(entryIds);
    const target = notebookId === DEFAULT_NOTEBOOK_ID ? undefined : notebookId;
    setState(s => ({ ...s, entries: s.entries.map(e => (ids.has(e.id) ? { ...e, notebookId: target } : e)) }));
  },

  setGoals(p: Partial<AppState['goals']>) {
    setState(s => ({ ...s, goals: { ...s.goals, ...p } }));
  },

  /* —— 搜索记录 —— */
  pushSearch(q: string) {
    const k = q.trim();
    if (!k) return;
    setState(s => ({ ...s, recentSearches: [k, ...s.recentSearches.filter(x => x !== k)].slice(0, 10) }));
  },
  removeSearch(q: string) {
    setState(s => ({ ...s, recentSearches: s.recentSearches.filter(x => x !== q) }));
  },
  clearSearches() {
    setState(s => ({ ...s, recentSearches: [] }));
  },

  /* —— 设置 —— */
  setAppearance(p: Partial<AppState['appearance']>) {
    setState(s => ({ ...s, appearance: { ...s.appearance, ...p } }));
  },
  setReminders(p: Partial<AppState['reminders']>) {
    setState(s => ({ ...s, reminders: { ...s.reminders, ...p } }));
  },
  setPrivacy(p: Partial<AppState['privacy']>) {
    setState(s => ({ ...s, privacy: { ...s.privacy, ...p } }), true);
  },
  setSync(p: Partial<AppState['sync']>) {
    setState(s => ({ ...s, sync: { ...s.sync, ...p } }));
  },
  setBackup(p: Partial<AppState['backup']>) {
    setState(s => ({ ...s, backup: { ...s.backup, ...p } }));
  },
  setProfile(p: Partial<AppState['profile']>) {
    setState(s => ({ ...s, profile: { ...s.profile, ...p } }));
  },
  markPermissionAsked(k: keyof AppState['permissionsAsked']) {
    setState(s => ({ ...s, permissionsAsked: { ...s.permissionsAsked, [k]: true } }));
  },

  /* —— 应用锁 —— */
  async setPasscode(code: string) {
    const passcodeHash = await sha256(code);
    actions.setPrivacy({ passcodeHash, appLock: true });
  },
  async verifyPasscode(code: string) {
    const h = state.privacy.passcodeHash;
    if (!h) return false;
    return (await sha256(code)) === h;
  },
  disableAppLock() {
    actions.setPrivacy({ appLock: false, passcodeHash: undefined, biometric: false });
  },

  /* —— 账号：已配置云端则走远端（services/cloud.ts），否则保持本机模拟 —— */
  async register(identifier: string, password: string): Promise<{ ok: boolean; message?: string }> {
    const id = identifier.trim();
    if (cloudConfigured()) {
      if (isPhone(id)) return { ok: false, message: '手机号请使用验证码注册' };
      try {
        const acc = await registerByEmail(id, password);
        setState(s => ({ ...s, account: acc, usageMode: 'account', sync: { ...s.sync, cloud: true } }), true);
        return { ok: true };
      } catch (e) {
        return { ok: false, message: cloudError(e, '注册失败，请稍后再试') };
      }
    }
    if (state.accounts.some(a => a.identifier === id)) return { ok: false, message: '该账号已注册，请直接登录' };
    const acc: StoredAccount = {
      id: uid('u'),
      identifier: id,
      nickname: state.profile.name || '记得自己',
      createdAt: Date.now(),
      passwordHash: await sha256(password),
    };
    setState(s => ({
      ...s,
      accounts: [...s.accounts, acc],
      account: { id: acc.id, identifier: acc.identifier, nickname: acc.nickname, createdAt: acc.createdAt },
      usageMode: 'account',
      sync: { ...s.sync, cloud: true },
    }), true);
    return { ok: true };
  },

  async login(identifier: string, password: string): Promise<{ ok: boolean; message?: string }> {
    if (cloudConfigured()) {
      try {
        const acc = await loginByPassword(identifier, password);
        setState(s => ({ ...s, account: acc, usageMode: 'account', sync: { ...s.sync, cloud: true } }), true);
        return { ok: true };
      } catch (e) {
        return { ok: false, message: cloudError(e, '登录失败，请稍后再试') };
      }
    }
    const acc = state.accounts.find(a => a.identifier === identifier.trim());
    if (!acc) return { ok: false, message: '账号不存在，请先注册' };
    if ((await sha256(password)) !== acc.passwordHash) return { ok: false, message: '密码错误，请重新输入' };
    setState(s => ({
      ...s,
      account: { id: acc.id, identifier: acc.identifier, nickname: acc.nickname, createdAt: acc.createdAt },
      usageMode: 'account',
      sync: { ...s.sync, cloud: true },
    }), true);
    return { ok: true };
  },

  /** 发送验证码：手机号走短信，邮箱走内置邮件代发的验证码 */
  async sendLoginCode(identifier: string): Promise<{ ok: boolean; message?: string }> {
    if (!cloudConfigured()) return { ok: false, message: '云端尚未配置' };
    const id = identifier.trim();
    try {
      if (isPhone(id)) await sendSmsCode(id);
      else await sendEmailCode(id);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: cloudError(e, '验证码发送失败，请稍后再试') };
    }
  },

  /** 手机号/邮箱 + 验证码登录；未注册的自动注册并登录 */
  async loginByCode(identifier: string, code: string): Promise<{ ok: boolean; message?: string }> {
    if (!cloudConfigured()) return { ok: false, message: '云端尚未配置' };
    try {
      const id = identifier.trim();
      const acc = isPhone(id) ? await loginByPhone(id, code) : await loginByEmail(id, code);
      setState(s => ({ ...s, account: acc, usageMode: 'account', sync: { ...s.sync, cloud: true } }), true);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: cloudError(e, '登录失败，请检查验证码') };
    }
  },

  /** 发送重置密码验证：手机号发短码，邮箱发重置邮件 */
  async sendResetCode(identifier: string): Promise<{ ok: boolean; message?: string }> {
    if (!cloudConfigured()) return { ok: false, message: '云端尚未配置' };
    const id = identifier.trim();
    try {
      if (isPhone(id)) await sendResetSmsCode(id);
      else await requestPasswordResetEmail(id);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: cloudError(e, '发送失败，请稍后再试') };
    }
  },

  async resetPassword(identifier: string, password: string, code?: string): Promise<{ ok: boolean; message?: string }> {
    if (cloudConfigured()) {
      try {
        await resetPasswordBySms(code ?? '', password);
        return { ok: true };
      } catch (e) {
        return { ok: false, message: cloudError(e, '重置失败，请检查验证码') };
      }
    }
    const acc = state.accounts.find(a => a.identifier === identifier.trim());
    if (!acc) return { ok: false, message: '该账号尚未注册' };
    const passwordHash = await sha256(password);
    setState(s => ({ ...s, accounts: s.accounts.map(a => (a.id === acc.id ? { ...a, passwordHash } : a)) }), true);
    return { ok: true };
  },

  logout() {
    if (state.account?.remote) void logoutRemote();
    setState(s => ({ ...s, account: undefined, usageMode: 'local', sync: { ...s.sync, cloud: false } }), true);
  },

  /** 注销账号：删除账号与本地全部数据 */
  async deleteAccount() {
    const accId = state.account?.id;
    if (state.account?.remote) {
      await destroyRemoteAccount().catch(() => {});
    } else {
      const cloud = await loadCloud();
      if (accId) delete cloud[accId];
      await saveCloud(cloud);
    }
    const accounts = state.accounts.filter(a => a.id !== accId);
    state = { ...defaultState(), accounts };
    emit();
    await saveState(state, true);
    await clearAllVideoFiles();
    await clearAllPhotoFiles();
    await clearAIKey();
  },

  /** 清空所有数据（保留账号表） */
  async wipeAll() {
    await clearAllStorage();
    state = defaultState();
    emit();
    await saveState(state, true);
    await clearAllVideoFiles();
    await clearAllPhotoFiles();
    await clearAIKey();
  },

  /* —— 同步：云端账号走 LeanCloud，本机账号走模拟云端 —— */
  async syncNow(): Promise<{ ok: boolean; conflicts: number; message?: string }> {
    const acc = state.account;
    if (!acc) return { ok: false, conflicts: 0, message: '请先登录账号' };
    let remote: { entries: Entry[]; updatedAt: number } | undefined;
    if (acc.remote) {
      try {
        remote = { entries: await pullRemoteEntries(), updatedAt: 0 };
      } catch (e) {
        return { ok: false, conflicts: 0, message: cloudError(e, '同步失败，请检查网络后重试') };
      }
    } else {
      remote = (await loadCloud())[acc.id];
    }
    const local = state.entries;
    const conflicts: SyncConflict[] = [];
    const merged = new Map<string, Entry>();
    local.forEach(e => merged.set(e.id, e));
    const lastSync = state.sync.lastSyncAt ?? 0;
    if (remote) {
      for (const r of remote.entries) {
        const l = merged.get(r.id);
        if (!l) {
          merged.set(r.id, r);
        } else if (r.updatedAt !== l.updatedAt) {
          // 双方在上次同步之后都修改过 => 冲突
          if (r.updatedAt > lastSync && l.updatedAt > lastSync) {
            conflicts.push({ entryId: l.id, localUpdatedAt: l.updatedAt, cloudUpdatedAt: r.updatedAt, cloudEntry: r });
          } else if (r.updatedAt > l.updatedAt) {
            merged.set(r.id, r);
          }
        }
      }
    }
    const entries = Array.from(merged.values());
    const now = Date.now();
    if (!conflicts.length) {
      if (acc.remote) {
        try {
          await pushRemoteEntries(entries);
        } catch (e) {
          return { ok: false, conflicts: 0, message: cloudError(e, '同步失败，请检查网络后重试') };
        }
      } else {
        const cloud = await loadCloud();
        cloud[acc.id] = { entries, updatedAt: now };
        await saveCloud(cloud);
      }
    }
    setState(s => ({
      ...s,
      entries,
      conflicts,
      sync: conflicts.length ? s.sync : { ...s.sync, lastSyncAt: now },
    }), true);
    return { ok: true, conflicts: conflicts.length };
  },

  /** 处理同步冲突 */
  async resolveConflicts(choice: 'local' | 'cloud' | 'latest') {
    const list = state.conflicts;
    setState(s => ({
      ...s,
      conflicts: [],
      entries: s.entries.map(e => {
        const c = list.find(x => x.entryId === e.id);
        if (!c) return e;
        if (choice === 'cloud') return c.cloudEntry;
        if (choice === 'latest') return c.cloudUpdatedAt > c.localUpdatedAt ? c.cloudEntry : e;
        return { ...e, updatedAt: Date.now() };
      }),
    }), true);
    return actions.syncNow();
  },

  /* —— 备份 / 恢复 —— */
  snapshot(): AppState {
    return state;
  },
  restoreSnapshot(raw: unknown, mode: 'merge' | 'replace' = 'merge') {
    const incoming = normalizeState(raw as Partial<AppState>);
    if (mode === 'replace') {
      // AI 的服务地址与授权属于这台设备，不随备份覆盖
      setState(s => ({ ...incoming, accounts: s.accounts, account: s.account, onboarded: true, usageMode: s.usageMode, ai: s.ai }), true);
      return incoming.entries.length;
    }
    setState(s => {
      const map = new Map(s.entries.map(e => [e.id, e]));
      incoming.entries.forEach(e => {
        const cur = map.get(e.id);
        if (!cur || e.updatedAt > cur.updatedAt) map.set(e.id, e);
      });
      const tagMap = new Map(s.tags.map(t => [t.id, t]));
      incoming.tags.forEach(t => tagMap.set(t.id, t));
      const nbMap = new Map(s.notebooks.map(n => [n.id, n]));
      incoming.notebooks.forEach(n => { if (!nbMap.has(n.id)) nbMap.set(n.id, n); });
      // 身边人：id 相同的保留本机版本；备份里新出现的人补进来
      const peopleMap = new Map(s.people.map(p => [p.id, p]));
      incoming.people.forEach(p => { if (!peopleMap.has(p.id)) peopleMap.set(p.id, p); });
      const reviewMap = new Map(s.reviews.map(r => [r.id, r]));
      incoming.reviews.forEach(r => { if (!reviewMap.has(r.id)) reviewMap.set(r.id, r); });
      return {
        ...s,
        entries: Array.from(map.values()),
        tags: Array.from(tagMap.values()),
        notebooks: Array.from(nbMap.values()),
        people: Array.from(peopleMap.values()),
        reviews: Array.from(reviewMap.values()).sort((a, b) => b.from - a.from),
      };
    }, true);
    return incoming.entries.length;
  },
};

export type Actions = typeof actions;
