import type { Entry, Notebook } from '../store/types';

export function hasEntryContent(entry: Entry | undefined | null): boolean {
  return !!entry && !!(entry.title.trim() || entry.body.trim() || entry.photos.length || entry.audios.length || entry.videos.length);
}

/** Saving an edit must keep an already published diary in the diary list. */
export function entryForSave(entry: Entry, now = Date.now()): Entry {
  return { ...entry, status: entry.status === 'published' ? 'published' : 'draft', updatedAt: now };
}

/** Replace the current selection and advance the cursor for each speech result. */
export function insertDictation(body: string, text: string, selection: { start: number; end: number }) {
  const start = Math.max(0, Math.min(selection.start, body.length));
  const end = Math.max(start, Math.min(selection.end, body.length));
  return { body: body.slice(0, start) + text + body.slice(end), cursor: start + text.length };
}

/** /write?notebook=<id>：仅新建时生效；编辑已有日记、或日记本不存在时忽略（回落到当前日记本规则） */
export function resolveWriteNotebook(param: string | undefined, notebooks: Notebook[], editingId?: string): string | undefined {
  if (!param || editingId) return undefined;
  return notebooks.some(n => n.id === param) ? param : undefined;
}
