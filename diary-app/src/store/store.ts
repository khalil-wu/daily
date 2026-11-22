import { useMemo, useRef, useSyncExternalStore } from 'react';
import type { Account, AppState, Entry, EntryAI, Notebook, PeriodReview, Person, RelationKey, StoredAccount, SyncConflict, Tag, VideoClip } from './types';
import { getPersistedSnapshot, getPersistenceError, subscribePersistenceError, defaultState, loadState, normalizeEntry, normalizeState, saveState, clearAllStorage, loadCloud, saveCloud, isEntryRecord } from './storage';
import { uid, sha256, isPhone } from '../utils/text';
import {
  cloudConfigured, currentRemoteAccount,
  loginByPhone, loginByEmail, loginByPassword,
  sendSmsCode, sendEmailCode, sendRegisterCode as requestRegisterCode, requestPasswordReset, confirmPasswordReset,
  logoutRemote, pullRemoteEntries, pushRemoteEntries, pullRemoteMetadata, pushRemoteMetadata, remoteMediaTransport, destroyRemoteAccount, cloudError,
  snapshotRemoteSession, restoreRemoteSession, dropRemoteSessionLocal, resetRemoteSessionCache,
} from '../services/cloud';
import { sortNotebooks } from '../utils/shelf';
import { unreferencedVideos } from '../utils/video';
import { normalizeBirthday } from '../utils/people';
import { clearAllVideoFiles, discardVideoFiles } from '../services/videoStore';
import { clearAllPhotoFiles, discardPhotoFiles, unreferencedPhotos } from '../services/photoStore';
import { clearAIKey } from '../services/aiKey';
import { clearAutoBackups, migrateLegacyAutoBackups } from '../services/autoBackup';
import { buildSampleDrafts, buildSampleEntries } from '../data/samples';
import { DEFAULT_NOTEBOOK_ID, PERSON_COLORS } from '../data/constants';
import { createMediaSync } from '../services/syncMedia';
import { accountSpaceKey, allStoredEntries, switchAccount } from './accountSpaces';
import { enabledMetadata, mergeMetadata, syncMetadata, syncNetworkBlock } from './syncMetadata';
import { entryFingerprint, mergeSyncEntries, preserveConcurrentEdits, syncPayload, type ConflictChoice } from './sync';

/* ---------------- 底层 store ---------------- */

let state: AppState = defaultState();
let hydrated = false;
let hydration: Promise<void> | null = null;
/** 当前正在进行的新手导览：home = 首页导览，editor = 写作页导览 */
export type TourKind = 'home' | 'editor' | 'shelf';
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
  if (next === state) return Promise.resolve();
  state = next;
  emit();
  // The persistence error is observable by the editor; never leave an unhandled rejection.
  return hydrated ? saveState(state, immediate).catch(() => {}) : Promise.resolve();
}

export async function hydrate() {
  if (hydrated) return;
  if (hydration) return hydration;
  hydration = hydrateOnce().finally(() => { hydration = null; });
  return hydration;
}

async function hydrateOnce() {
  state = await loadState();
  await migrateLegacyAutoBackups(accountSpaceKey(state.account)).catch(() => {});
  hydrated = true;
  emit();
  hydrateListeners.forEach(l => l());
  // 恢复云端登录态：本地存的是云端账号但会话已失效时，要求重新登录
  const accountAtHydration = state.account;
  void Promise.resolve().then(() => currentRemoteAccount()).then(remote => {
    if (state.account !== accountAtHydration) return;
    if (!state.account?.remote && !remote) return;
    if (remote && state.account?.remote && remote.id === state.account.id) return;
    void setState(s => {
      const next = switchAccount(s, remote ?? undefined);
      return remote ? rememberAccount(next, remote) : next;
    }, true);
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
  const cache = useRef<{ s: AppState; selector: typeof selector; v: T } | null>(null);
  const get = () => {
    const c = cache.current;
    if (c && c.s === state && c.selector === selector) return c.v;
    const v = selector(state);
    if (c && shallowEqual(c.v, v)) {
      cache.current = { s: state, selector, v: c.v };
      return c.v;
    }
    cache.current = { s: state, selector, v };
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

/** 按日记本取日记（null = 全部）；可见性规则（删除/隐藏/草稿）仍由各使用处自行过滤 */
export function scopeEntries(entries: Entry[], notebookId: string | null): Entry[] {
  return notebookId ? entries.filter(e => inNotebook(e, notebookId)) : entries;
}

/** 当前打开的这本书里的日记（activeNotebook = null 即「全部日记」） */
export function useBookEntries(): Entry[] {
  const entries = useStore(s => s.entries);
  const activeNotebook = useStore(s => s.activeNotebook);
  return useMemo(() => scopeEntries(entries, activeNotebook), [entries, activeNotebook]);
}

/** 当前打开的这本书；全部日记返回 null */
export function useActiveBook(): Notebook | null {
  const notebooks = useStore(s => s.notebooks);
  const activeNotebook = useStore(s => s.activeNotebook);
  return useMemo(() => (activeNotebook ? notebooks.find(n => n.id === activeNotebook) ?? null : null), [notebooks, activeNotebook]);
}

/** 回收站保留天数 */
export const TRASH_DAYS = 30;

/* ---------------- 动作 ---------------- */

function patchEntry(id: string, patch: Partial<Entry>, touch = true) {
  setState(s => ({
    ...s,
    entries: s.entries.map(e => (e.id === id ? { ...e, ...patch, ...(touch ? { updatedAt: nextRevision(e) } : {}) } : e)),
  }));
}

const nextRevision = (entry: Entry) => Math.max(Date.now(), entry.updatedAt + 1);

function withPermanentDeletions(s: AppState, gone: Entry[]) {
  if (!gone.length) return s.sync;
  const deletedEntries = { ...s.sync.deletedEntries };
  gone.forEach(e => { deletedEntries[e.id] = nextRevision(e); });
  return { ...s.sync, deletedEntries };
}

/**
 * 清理视频文件：候选里已经没有任何日记（含草稿、回收站、待处理的云端冲突版本）在引用的，才会被删除。
 * 返回被清理的段数。
 */
function releaseVideos(candidates: VideoClip[]) {
  if (!candidates.length) return 0;
  const holders = allStoredEntries(state).map(e => ({ ...e, videos: [...e.videos, ...e.audios] }));
  const orphans = unreferencedVideos(candidates, holders);
  if (orphans.length) {
    void discardVideoFiles(orphans.map(v => ({ ...v, poster: undefined })));
    releasePhotos(orphans.flatMap(v => v.poster ? [v.poster] : []));
  }
  return orphans.length;
}

/** 清理照片文件：规则同视频，只删应用自己收进来的、已经没人引用的文件 */
function releasePhotos(candidates: string[]) {
  if (!candidates.length) return 0;
  const holders = allStoredEntries(state).map(e => ({ photos: [...e.photos, ...e.videos.flatMap(v => v.poster ? [v.poster] : [])] }));
  for (const profile of [state.profile, ...Object.values(state.accountSpaces ?? {}).map(space => space.profile)]) holders.push({ photos: [profile.avatar, profile.cover].filter((uri): uri is string => !!uri) });
  const orphans = unreferencedPhotos(candidates, holders);
  if (orphans.length) void discardPhotoFiles(orphans);
  return orphans.length;
}

export interface SyncResult { ok: boolean; conflicts: number; message?: string; partial?: boolean }
export type SyncProgress = { status: 'idle' | 'syncing' | 'error'; message?: string };
let syncProgress: SyncProgress = { status: 'idle' };
const syncListeners = new Set<() => void>();
function setSyncProgress(next: SyncProgress) { syncProgress = next; syncListeners.forEach(fn => fn()); }
export function useSyncProgress() { return useSyncExternalStore(cb => { syncListeners.add(cb); return () => { syncListeners.delete(cb); }; }, () => syncProgress, () => syncProgress); }
let syncInFlight: Promise<SyncResult> | null = null;

function scheduleSync(resolution?: { choice: ConflictChoice; conflicts: SyncConflict[] }): Promise<SyncResult> {
  if (syncInFlight) {
    return resolution ? syncInFlight.then(() => scheduleSync(resolution)) : syncInFlight;
  }
  const run = performSync(resolution).finally(() => { if (syncInFlight === run) syncInFlight = null; });
  syncInFlight = run;
  return run;
}

async function performSync(resolution?: { choice: ConflictChoice; conflicts: SyncConflict[] }): Promise<SyncResult> {
  const acc = state.account;
  if (!acc) return { ok: false, conflicts: 0, message: '请先登录账号' };
  if (!state.sync.cloud) return { ok: false, conflicts: 0, message: '同步已关闭，请先开启云端同步' };
  const blocked = acc.remote ? syncNetworkBlock(state.sync.wifiOnly) : null;
  if (blocked) { setSyncProgress({ status: 'error', message: blocked }); return { ok: false, conflicts: 0, message: blocked }; }
  const startedAt = Date.now();
  const initial = state;
  const sameAccount = () => accountSpaceKey(state.account) === accountSpaceKey(acc);
  const media = acc.remote ? createMediaSync(acc.id, state.sync.mediaCache ?? {}, remoteMediaTransport(acc.id)) : null;
  setSyncProgress({ status: 'syncing' });
  try {
    const remoteRaw = acc.remote ? await pullRemoteEntries(acc.id) : (await loadCloud())[acc.id]?.entries ?? [];
    const remoteMetadata = acc.remote ? await pullRemoteMetadata(acc.id) : undefined;
    if (!sameAccount()) throw new Error('云端会话账号已切换，请重新同步');
    // Download before merge, so attachment references compare against this device's durable files.
    let remote = media ? initial.sync.syncPhotos ? await media.download(remoteRaw) : remoteRaw.map(e => {
      const local = state.entries.find(x => x.id === e.id);
      return { ...e, photos: local?.photos ?? [], audios: local?.audios ?? [], videos: local?.videos ?? [] };
    }) : remoteRaw;
    if (!initial.sync.syncTags && acc.remote) remote = remote.map(e => {
      const l = state.entries.find(x => x.id === e.id);
      return { ...e, tags: l?.tags ?? [], people: l?.people ?? [], notebookId: l?.notebookId };
    });
    if (!sameAccount()) throw new Error('云端会话账号已切换，请重新同步');
    const local = state.entries;
    const merged = mergeSyncEntries(local, remote, state.sync.lastSyncAt ?? 0, state.sync.deletedEntries, resolution, state.sync.entryRevisions);
    const metadata = mergeMetadata(syncMetadata(initial), remoteMetadata, initial.sync.metadataBaseline ?? syncMetadata(defaultState()));
    let partial = false;
    const conflictingIds = new Set(merged.conflicts.map(c => c.entryId));
    const confirmed = merged.entries.filter(e => !conflictingIds.has(e.id));
    {
      let payload = syncPayload(confirmed, merged.deletedEntries);
      if (acc.remote) {
        if (!initial.sync.syncPhotos) {
          // Excluding media never erases a prior cloud attachment or uploads a local-only URI.
          payload = payload.map(e => {
            if (e.purgedAt) return e;
            const r = remoteRaw.find(x => x.id === e.id);
            if (e.photos.length || e.audios.length || e.videos.length || r?.photos.length || r?.audios.length || r?.videos.length) partial = true;
            return { ...e, photos: r?.photos ?? [], audios: r?.audios ?? [], videos: r?.videos ?? [] };
          });
        } else payload = await media!.upload(payload);
        if (!initial.sync.syncTags) payload = payload.map(e => {
          if (e.purgedAt) return e;
          const r = remoteRaw.find(x => x.id === e.id);
          if (e.tags.length || e.people.length || e.notebookId || r?.tags.length || r?.people.length || r?.notebookId) partial = true;
          return { ...e, tags: r?.tags ?? [], people: r?.people ?? [], notebookId: r?.notebookId };
        });
        if (!sameAccount() || !state.sync.cloud) throw new Error('云端同步已暂停，尚未确认完成');
        await pushRemoteEntries(payload, remoteRaw, acc.id);
        if (!merged.conflicts.length && (initial.sync.syncTags || initial.sync.syncSettings)) await pushRemoteMetadata(metadata, remoteMetadata, acc.id);
      } else {
        const cloud = await loadCloud();
        cloud[acc.id] = { entries: [...payload, ...remoteRaw.filter(e => conflictingIds.has(e.id))], updatedAt: startedAt };
        await saveCloud(cloud);
      }
    }
    if (!sameAccount()) throw new Error('云端会话账号已切换，请重新同步');
    await setState(s => {
      const applied = enabledMetadata(initial, metadata);
      // Settings edited while uploading stay local and will sync on the next pass.
      for (const key of Object.keys(applied) as (keyof typeof applied)[]) {
        if (s[key] !== initial[key] || applied[key] === undefined) delete applied[key];
      }
      return {
        ...s, ...(merged.conflicts.length ? {} : applied),
        entries: preserveConcurrentEdits(local, s.entries, merged.entries),
        conflicts: merged.conflicts,
        sync: { ...s.sync,
          mediaCache: media?.cache ?? s.sync.mediaCache,
          deletedEntries: { ...merged.deletedEntries, ...s.sync.deletedEntries },
          ...(merged.conflicts.length ? {} : { lastSyncAt: startedAt, metadataBaseline: metadata }),
          entryRevisions: { ...s.sync.entryRevisions, ...Object.fromEntries(confirmed.map(e => [e.id, e.updatedAt])) },
          entryHashes: { ...s.sync.entryHashes, ...Object.fromEntries(confirmed.map(e => {
            const r = remoteRaw.find(x => x.id === e.id);
            const full = !acc.remote || ((initial.sync.syncPhotos || !(e.photos.length || e.audios.length || e.videos.length || r?.photos.length || r?.audios.length || r?.videos.length)) && (initial.sync.syncTags || !(e.tags.length || e.people.length || e.notebookId || r?.tags.length || r?.people.length || r?.notebookId)));
            return [e.id, full ? entryFingerprint(e) : ''];
          })) },
        },
      };
    }, true);
    if (getPersistenceError()) throw new Error(getPersistenceError()!);
    setSyncProgress({ status: 'idle' });
    return { ok: true, conflicts: merged.conflicts.length, partial };
  } catch (e) {
    // A cloud write may have succeeded; never claim its version until this entire operation confirms.
    if (!sameAccount() && media) await media.rollback();
    if (sameAccount() && media) await setState(s => ({ ...s, sync: { ...s.sync, mediaCache: media.cache } }), true);
    const message = cloudError(e, e instanceof Error && /日记尚未保存/.test(e.message) ? e.message : '同步失败，请检查网络后重试');
    if (sameAccount()) setSyncProgress({ status: 'error', message });
    return { ok: false, conflicts: state.conflicts.length, message };
  }
}

export function useEntrySaveStatus(id?: string, revision?: number) {
  const s = useStore(s => s);
  const persisted = useSyncExternalStore(subscribePersistenceError, getPersistedSnapshot, getPersistedSnapshot);
  const error = useSyncExternalStore(subscribePersistenceError, getPersistenceError, getPersistenceError);
  const progress = useSyncProgress();
  return { ...entrySaveStatus(s, persisted, id, revision), error, progress };
}

export function entrySaveStatus(s: AppState, persisted: AppState | null, id?: string, revision?: number) {
  const entry = s.entries.find(e => e.id === id);
  const disk = accountSpaceKey(persisted?.account) === accountSpaceKey(s.account) ? persisted?.entries.find(e => e.id === id) : undefined;
  const exact = !!entry && (!revision || entry.updatedAt >= revision);
  const local = exact && !!disk && entryFingerprint(entry!) === entryFingerprint(disk);
  const synced = local && !!s.account?.remote && s.sync.entryHashes?.[entry!.id] === entryFingerprint(entry!);
  const conflict = !!id && s.conflicts.some(c => c.entryId === id);
  return { entry, local, synced, conflict, enabled: !!s.account && s.sync.cloud };
}

/** 登录/注册成功的账号记入本机账号表，供「切换账号」快速选择。 */
function rememberAccount(s: AppState, acc: Account): AppState {
  const idx = s.accounts.findIndex(a => a.id === acc.id || a.identifier === acc.identifier);
  const accounts = [...s.accounts];
  if (idx >= 0) accounts[idx] = { ...accounts[idx], ...acc };
  else accounts.push(acc);
  return { ...s, accounts };
}

/** 把当前云端会话快照存回当前账号条目；快照在切换账号后用于免密恢复。 */
function captureRemoteSession(s: AppState): AppState {
  const acc = s.account;
  if (!acc?.remote) return s;
  const snap = snapshotRemoteSession();
  if (!snap) return s;
  if (!s.accounts.some(a => a.id === acc.id)) {
    return { ...s, accounts: [...s.accounts, { ...acc, remoteSession: snap }] };
  }
  return { ...s, accounts: s.accounts.map(a => (a.id === acc.id ? { ...a, remoteSession: snap } : a)) };
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
  setShelfDragHintSeen(seen: boolean) {
    setState(s => ({ ...s, shelfDragHintSeen: seen }), true);
  },
  setShelfTourSeen(seen: boolean) {
    setState(s => ({ ...s, shelfTourSeen: seen }), true);
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
    return setState(s => {
      const exists = s.entries.some(e => e.id === entry.id);
      const deletedEntries = { ...s.sync.deletedEntries };
      delete deletedEntries[entry.id];
      return {
        ...s,
        sync: { ...s.sync, deletedEntries },
        entries: exists ? s.entries.map(e => (e.id === entry.id ? entry : e)) : [entry, ...s.entries],
      };
    }, immediate);
  },

  updateEntry(id: string, patch: Partial<Entry>) {
    patchEntry(id, patch);
  },

  publishEntry(entry: Entry) {
    return actions.upsertEntry({ ...entry, status: 'published', updatedAt: nextRevision(entry) }, true);
  },

  toggleFavorite(id: string) {
    const e = state.entries.find(x => x.id === id);
    if (e) patchEntry(id, { favorite: !e.favorite });
    return !e?.favorite;
  },

  togglePinned(id: string) {
    const e = state.entries.find(x => x.id === id);
    if (e) patchEntry(id, { pinned: !e.pinned });
    return !e?.pinned;
  },

  toggleHidden(id: string) {
    const e = state.entries.find(x => x.id === id);
    if (e) patchEntry(id, { hidden: !e.hidden });
    return !e?.hidden;
  },

  /** 移入回收站 */
  trashEntry(id: string) {
    patchEntry(id, { deletedAt: Date.now() });
  },

  restoreEntry(id: string) {
    patchEntry(id, { deletedAt: undefined });
  },

  /** 彻底删除（连同只属于这篇日记的照片、视频文件） */
  destroyEntry(id: string) {
    const gone = state.entries.filter(e => e.id === id);
    setState(s => ({ ...s, entries: s.entries.filter(e => e.id !== id), sync: withPermanentDeletions(s, gone), conflicts: s.conflicts.filter(c => c.entryId !== id) }));
    releaseVideos(gone.flatMap(e => [...e.videos, ...e.audios]));
    releasePhotos(gone.flatMap(e => e.photos));
  },

  emptyTrash() {
    const gone = state.entries.filter(e => !!e.deletedAt);
    const ids = new Set(gone.map(e => e.id));
    setState(s => ({ ...s, entries: s.entries.filter(e => !e.deletedAt), sync: withPermanentDeletions(s, gone), conflicts: s.conflicts.filter(c => !ids.has(c.entryId)) }));
    releaseVideos(gone.flatMap(e => [...e.videos, ...e.audios]));
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
      return keep.length === s.entries.length ? s : { ...s, entries: keep, sync: withPermanentDeletions(s, gone) };
    });
    releaseVideos(gone.flatMap(e => [...e.videos, ...e.audios]));
    releasePhotos(gone.flatMap(e => e.photos));
  },

  importSamples() {
    setState(s => ({ ...s, entries: [...buildSampleEntries(), ...buildSampleDrafts(), ...s.entries] }), true);
  },

  importEntries(list: Entry[]) {
    if (!Array.isArray(list) || !list.every(isEntryRecord)) throw new Error('导入文件中有无效的日记记录');
    setState(s => {
      const ids = new Set(s.entries.map(e => e.id));
      // 外部文件可能来自旧版本，缺少后来新增的字段（如 videos），先补全再入库
      const add = list.map(normalizeEntry).map(e => {
        const id = ids.has(e.id) ? uid('e') : e.id;
        ids.add(id);
        return { ...e, id };
      });
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
      entries: s.entries.map(e => (e.tags.includes(id) ? { ...e, tags: e.tags.filter(x => x !== id), updatedAt: nextRevision(e) } : e)),
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
      entries: s.entries.map(e => (e.people.includes(id) ? { ...e, people: e.people.filter(x => x !== id), updatedAt: nextRevision(e) } : e)),
    }));
  },

  /* —— 「记得」（AI） —— */
  setAI(p: Partial<AppState['ai']>) {
    setState(s => ({ ...s, ai: { ...s.ai, ...p } }), true);
  },

  /** AI 回信也是持久化内容，需要同步到其他设备。 */
  setEntryAI(id: string, patch: Partial<EntryAI>) {
    setState(s => ({
      ...s,
      entries: s.entries.map(e => {
        if (e.id !== id) return e;
        const next: EntryAI = { ...(e.ai ?? {}), ...patch };
        (Object.keys(next) as (keyof EntryAI)[]).forEach(k => next[k] === undefined && delete next[k]);
        return { ...e, ai: Object.keys(next).length ? next : undefined, updatedAt: nextRevision(e) };
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
    const sorted = sortNotebooks(state.notebooks);
    const nextOrder = sorted.length ? Math.max(...sorted.map((x, i) => x.order ?? i)) + 1 : 0;
    const nb: Notebook = { id: uid('nb'), name: n.slice(0, 16), color, createdAt: Date.now(), order: nextOrder };
    setState(s => ({ ...s, notebooks: [...s.notebooks, nb] }));
    return nb;
  },

  updateNotebook(id: string, patch: Partial<Pick<Notebook, 'name' | 'color'>>) {
    setState(s => ({
      ...s,
      notebooks: s.notebooks.map(n => (n.id === id ? { ...n, ...patch, name: (patch.name ?? n.name).trim().slice(0, 16) || n.name } : n)),
    }));
  },

  /** 按给定 id 顺序重排书架：写入连续 order，数组也同步成同样的顺序 */
  reorderNotebooks(ids: string[]) {
    setState(s => {
      const rank = new Map(ids.map((id, i) => [id, i] as const));
      const sorted = sortNotebooks(s.notebooks);
      const known = sorted.filter(n => rank.has(n.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
      const rest = sorted.filter(n => !rank.has(n.id));
      return { ...s, notebooks: [...known, ...rest].map((n, i) => ({ ...n, order: i })) };
    });
  },

  /** 删除日记本：其中的日记归入默认日记本，默认日记本不可删除 */
  removeNotebook(id: string) {
    if (id === DEFAULT_NOTEBOOK_ID) return false;
    setState(s => ({
      ...s,
      notebooks: s.notebooks.filter(n => n.id !== id),
      activeNotebook: s.activeNotebook === id ? null : s.activeNotebook,
      entries: s.entries.map(e => (e.notebookId === id ? { ...e, notebookId: undefined, updatedAt: nextRevision(e) } : e)),
    }));
    return true;
  },

  setActiveNotebook(id: string | null) {
    setState(s => ({ ...s, activeNotebook: id }));
  },

  moveToNotebook(entryIds: string[], notebookId: string) {
    const ids = new Set(entryIds);
    const target = notebookId === DEFAULT_NOTEBOOK_ID ? undefined : notebookId;
    setState(s => ({ ...s, entries: s.entries.map(e => (ids.has(e.id) ? { ...e, notebookId: target, updatedAt: nextRevision(e) } : e)) }));
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
    if (syncInFlight) await syncInFlight;
    const id = identifier.trim();
    if (cloudConfigured()) {
      return { ok: false, message: '请获取验证码完成注册' };
    }
    if (state.accounts.some(a => a.identifier === id)) return { ok: false, message: '该账号已注册，请直接登录' };
    const acc: StoredAccount = {
      id: uid('u'),
      identifier: id,
      nickname: state.profile.name || '记得自己',
      createdAt: Date.now(),
      passwordHash: await sha256(password),
    };
    await setState(s => switchAccount({ ...s, accounts: [...s.accounts, acc] }, { id: acc.id, identifier: acc.identifier, nickname: acc.nickname, createdAt: acc.createdAt }), true);
    setSyncProgress({ status: 'idle' });
    return { ok: true };
  },

  async login(identifier: string, password: string): Promise<{ ok: boolean; message?: string }> {
    if (syncInFlight) await syncInFlight;
    if (cloudConfigured()) {
      try {
        const acc = await loginByPassword(identifier, password);
        await setState(s => rememberAccount(switchAccount(s, acc), acc), true);
        setSyncProgress({ status: 'idle' });
        return { ok: true };
      } catch (e) {
        return { ok: false, message: cloudError(e, '登录失败，请稍后再试') };
      }
    }
    const acc = state.accounts.find(a => a.identifier === identifier.trim());
    if (!acc) return { ok: false, message: '账号不存在，请先注册' };
    if ((await sha256(password)) !== acc.passwordHash) return { ok: false, message: '密码错误，请重新输入' };
    await setState(s => switchAccount(s, { id: acc.id, identifier: acc.identifier, nickname: acc.nickname, createdAt: acc.createdAt }), true);
    setSyncProgress({ status: 'idle' });
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

  /** 注册验证码：signUp 携带密码，验证后账号自带密码，可直接密码登录。 */
  async sendRegisterCode(identifier: string, password: string): Promise<{ ok: boolean; message?: string }> {
    if (!cloudConfigured()) return { ok: false, message: '云端尚未配置' };
    try {
      await requestRegisterCode(identifier, password);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: cloudError(e, '验证码发送失败，请稍后再试') };
    }
  },

  /** 手机号/邮箱 + 验证码登录；未注册的自动注册并登录 */
  async loginByCode(identifier: string, code: string): Promise<{ ok: boolean; message?: string }> {
    if (syncInFlight) await syncInFlight;
    if (!cloudConfigured()) return { ok: false, message: '云端尚未配置' };
    try {
      const id = identifier.trim();
      const acc = isPhone(id) ? await loginByPhone(id, code) : await loginByEmail(id, code);
      await setState(s => rememberAccount(switchAccount(s, acc), acc), true);
        setSyncProgress({ status: 'idle' });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: cloudError(e, '登录失败，请检查验证码') };
    }
  },

  /** 发送重置密码验证码：手机号发短码、邮箱发邮件（账号须已存在）。 */
  async sendResetCode(identifier: string): Promise<{ ok: boolean; message?: string }> {
    if (!cloudConfigured()) return { ok: false, message: '云端尚未配置' };
    try {
      await requestPasswordReset(identifier.trim());
      return { ok: true };
    } catch (e) {
      return { ok: false, message: cloudError(e, '发送失败，请稍后再试') };
    }
  },

  async resetPassword(identifier: string, password: string, code?: string): Promise<{ ok: boolean; message?: string; account?: boolean }> {
    if (cloudConfigured()) {
      try {
        const acc = await confirmPasswordReset(code ?? '', password);
        await setState(s => rememberAccount(switchAccount(s, acc), acc), true);
        setSyncProgress({ status: 'idle' });
        return { ok: true, account: true };
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

  async logout() {
    if (syncInFlight) await syncInFlight;
    const leavingId = state.account?.id;
    if (state.account?.remote) await logoutRemote();
    // 显式退出会吊销云端会话，同时清掉本机快照；其他账号的快照不受影响
    await setState(s => ({
      ...switchAccount(s),
      accounts: leavingId ? s.accounts.map(a => (a.id === leavingId && a.remoteSession ? { ...a, remoteSession: undefined } : a)) : s.accounts,
    }), true);
    setSyncProgress({ status: 'idle' });
  },

  /**
   * 免密切换账号：先把当前云端会话存回其账号条目，再恢复目标账号快照并在线校验；
   * 快照缺失或已失效返回 needsLogin，由 UI 引导重新登录。
   */
  async quickSwitchTo(accountId: string): Promise<{ ok: boolean; needsLogin?: boolean }> {
    if (syncInFlight) await syncInFlight;
    const target = state.accounts.find(a => a.id === accountId);
    if (!target) return { ok: false };
    if (state.account?.id === accountId) return { ok: true };
    await setState(s => captureRemoteSession(s), true);
    if (target.remote) {
      const snap = target.remoteSession;
      dropRemoteSessionLocal();
      resetRemoteSessionCache();
      if (snap) {
        restoreRemoteSession(snap);
        try {
          const acc = await currentRemoteAccount();
          if (acc?.id === target.id) {
            await setState(s => captureRemoteSession(rememberAccount(switchAccount(s, acc), acc)), true);
            setSyncProgress({ status: 'idle' });
            return { ok: true };
          }
        } catch { /* 会话失效 */ }
        dropRemoteSessionLocal();
      }
      await setState(s => ({ ...s, accounts: s.accounts.map(a => (a.id === target.id ? { ...a, remoteSession: undefined } : a)) }), true);
      return { ok: false, needsLogin: true };
    }
    dropRemoteSessionLocal();
    resetRemoteSessionCache();
    await setState(s => switchAccount(s, { id: target.id, identifier: target.identifier, nickname: target.nickname, createdAt: target.createdAt }), true);
    setSyncProgress({ status: 'idle' });
    return { ok: true };
  },

  /** 去登录新账号：保留当前账号会话快照并只清本地凭证，当前账号可随时免密切回。 */
  async prepareAddAccount() {
    if (syncInFlight) await syncInFlight;
    await setState(s => captureRemoteSession(s), true);
    dropRemoteSessionLocal();
    resetRemoteSessionCache();
    await setState(s => switchAccount(s), true);
    setSyncProgress({ status: 'idle' });
  },

  /** 注销账号：删除账号与本地全部数据 */
  async deleteAccount() {
    if (syncInFlight) await syncInFlight;
    const accId = state.account?.id;
    if (state.account?.remote) {
      await destroyRemoteAccount(Object.keys(state.sync.mediaCache ?? {}));
    } else {
      const cloud = await loadCloud();
      if (accId) delete cloud[accId];
      await saveCloud(cloud);
    }
    const removed = state.entries;
    const removedProfile = state.profile;
    const owner = accountSpaceKey(state.account);
    await setState(s => {
      const next = switchAccount(s);
      const spaces = { ...next.accountSpaces };
      delete spaces[owner];
      return { ...next, accountSpaces: spaces, accounts: s.accounts.filter(a => a.id !== accId) };
    }, true);
    releasePhotos([...removed.flatMap(e => e.photos), removedProfile.avatar, removedProfile.cover].filter((uri): uri is string => !!uri));
    releaseVideos(removed.flatMap(e => [...e.videos, ...e.audios]));
    await clearAutoBackups(owner);
    setSyncProgress({ status: 'idle' });
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
    await clearAutoBackups();
  },

  /* —— 同步：同一时间只执行一次，保留上传期间的本机编辑 —— */
  syncNow(): Promise<SyncResult> {
    return scheduleSync();
  },

  resolveConflicts(choice: ConflictChoice, entryId?: string): Promise<SyncResult> {
    return scheduleSync({ choice, conflicts: state.conflicts.filter(c => !entryId || c.entryId === entryId) });
  },

  importLocalDiaries() {
    if (!state.account || !state.accountSpaces?.guest) return 0;
    const guest = state.accountSpaces.guest;
    return actions.restoreSnapshot({ ...guest, entries: guest.entries.map(e => ({ ...e, id: uid('e'), updatedAt: Date.now() })) }, 'merge');
  },

  /* —— 备份 / 恢复 —— */
  snapshot(): AppState {
    return state;
  },
  restoreSnapshot(raw: unknown, mode: 'merge' | 'replace' = 'merge') {
    if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Partial<AppState>).entries)
      || !(raw as AppState).entries.every(isEntryRecord)) throw new Error('备份格式不正确，原有日记未被修改');
    const incoming = normalizeState(raw as Partial<AppState>);
    // Explicitly restoring a permanently deleted diary creates a fresh identity.
    incoming.entries = incoming.entries.map(e => state.sync.deletedEntries?.[e.id] ? { ...e, id: uid('e') } : e);
    if (mode === 'replace') {
      // AI 的服务地址与授权属于这台设备，不随备份覆盖
      setState(s => ({ ...incoming, accountSpaces: s.accountSpaces, accounts: s.accounts, account: s.account, onboarded: true, usageMode: s.usageMode, ai: s.ai, privacy: s.privacy, sync: s.sync, conflicts: [] }), true);
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
      incoming.notebooks.forEach(n => {
        const cur = nbMap.get(n.id);
        if (!cur) nbMap.set(n.id, n);
        else if (cur.order === undefined && n.order !== undefined) nbMap.set(n.id, { ...cur, order: n.order });
      });
      // 身边人：id 相同的保留本机版本；备份里新出现的人补进来
      const peopleMap = new Map(s.people.map(p => [p.id, p]));
      incoming.people.forEach(p => { if (!peopleMap.has(p.id)) peopleMap.set(p.id, p); });
      const reviewMap = new Map(s.reviews.map(r => [r.id, r]));
      incoming.reviews.forEach(r => { if (!reviewMap.has(r.id)) reviewMap.set(r.id, r); });
      return {
        ...s,
        entries: Array.from(map.values()),
        tags: Array.from(tagMap.values()),
        notebooks: sortNotebooks(Array.from(nbMap.values())),
        people: Array.from(peopleMap.values()),
        reviews: Array.from(reviewMap.values()).sort((a, b) => b.from - a.from),
      };
    }, true);
    return incoming.entries.length;
  },
};

export type Actions = typeof actions;
