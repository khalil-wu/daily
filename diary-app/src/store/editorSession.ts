import { useSyncExternalStore } from 'react';
import type { AudioClip, Entry, MoodKey, Place, VideoClip, WeatherKey } from './types';
import { actions } from './store';
import { DEFAULT_NOTEBOOK_ID } from '../data/constants';

export interface EditorDraft {
  entry: Entry;
  dirty: boolean;
  lastAutoSavedAt?: number;
}

let draft: EditorDraft | null = null;
const subs = new Set<() => void>();
/**
 * 这次编辑里出现过的所有视频（进入时原有的 + 中途添加的）。
 * 编辑结束时，其中已经没有日记引用的文件会被清理：
 * 例如添加后又删掉的、选了「不保存」的新日记里的视频。
 */
let sessionVideos: VideoClip[] = [];

function notify() {
  subs.forEach(fn => fn());
}

export function startEditorSession(opts: { id?: string; templateId?: string; createdAt?: number; mood?: MoodKey; templateData?: { title: string; body: string; tags: string[]; template?: string } }) {
  if (opts.id) {
    const existing = actions.snapshot().entries.find(e => e.id === opts.id);
    if (existing) {
      draft = {
        entry: { ...existing, tags: [...existing.tags], photos: [...existing.photos], audios: [...existing.audios], videos: [...existing.videos] },
        dirty: false,
      };
      sessionVideos = [...existing.videos];
      notify();
      return draft;
    }
  }
  const activeNb = actions.snapshot().activeNotebook;
  const defaultNb = activeNb && activeNb !== DEFAULT_NOTEBOOK_ID ? activeNb : undefined;
  const base = actions.newEntry({
    createdAt: opts.createdAt ?? Date.now(),
    notebookId: defaultNb,
    ...(opts.mood ? { mood: opts.mood } : {}),
    ...(opts.templateData ?? {}),
  });
  draft = { entry: base, dirty: !!opts.templateData };
  sessionVideos = [];
  notify();
  return draft;
}

export function getEditorDraft(): EditorDraft | null {
  return draft;
}

export function updateEditorDraft(patch: Partial<Entry>, markDirty = true) {
  if (!draft) return;
  draft = {
    ...draft,
    entry: { ...draft.entry, ...patch },
    dirty: markDirty ? true : draft.dirty,
  };
  notify();
}

export function setEditorMood(mood?: MoodKey) {
  updateEditorDraft({ mood });
}

export function setEditorTags(tags: string[]) {
  updateEditorDraft({ tags });
}

export function setEditorPeople(people: string[]) {
  updateEditorDraft({ people });
}

export function addEditorPhotos(uris: string[]) {
  if (!draft) return;
  const merged = Array.from(new Set([...draft.entry.photos, ...uris]));
  updateEditorDraft({ photos: merged });
}

export function removeEditorPhoto(uri: string) {
  if (!draft) return;
  updateEditorDraft({ photos: draft.entry.photos.filter(p => p !== uri) });
}

export function addEditorAudio(clip: AudioClip) {
  if (!draft) return;
  updateEditorDraft({ audios: [...draft.entry.audios, clip] });
}

export function removeEditorAudio(id: string) {
  if (!draft) return;
  updateEditorDraft({ audios: draft.entry.audios.filter(a => a.id !== id) });
}

export function addEditorVideos(clips: VideoClip[]) {
  if (!draft || !clips.length) return;
  const have = new Set(draft.entry.videos.map(v => v.id));
  const fresh = clips.filter(v => !have.has(v.id));
  if (!fresh.length) return;
  sessionVideos = [...sessionVideos, ...fresh];
  updateEditorDraft({ videos: [...draft.entry.videos, ...fresh] });
}

export function removeEditorVideo(id: string) {
  if (!draft) return;
  updateEditorDraft({ videos: draft.entry.videos.filter(v => v.id !== id) });
}

export function setEditorEnvironment(weather?: WeatherKey, temperature?: number, place?: Place) {
  updateEditorDraft({ weather, temperature, place });
}

export function markAutoSaved() {
  if (!draft) return;
  draft = { ...draft, lastAutoSavedAt: Date.now() };
  notify();
}

export function clearEditorSession() {
  const touched = sessionVideos;
  draft = null;
  sessionVideos = [];
  notify();
  // 此时 store 里已经是最终结果（发布 / 存草稿 / 还原 / 丢弃），没人引用的视频文件可以清理了
  if (touched.length) actions.releaseVideos(touched);
}

export function useEditorDraft() {
  return useSyncExternalStore(
    cb => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => draft,
    () => draft,
  );
}
