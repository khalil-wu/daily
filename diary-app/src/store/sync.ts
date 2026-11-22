import { sha256 } from '@noble/hashes/sha2.js';
import type { Entry, SyncConflict } from './types';
import { normalizeEntry } from './storage';

export type ConflictChoice = 'local' | 'cloud' | 'latest';

/** Compare persisted fields independently of JSON object key order. */
export function entryFingerprint(e: Entry): string {
  const content = [e.id, e.title, e.body, e.createdAt, e.updatedAt, e.status, e.mood,
    e.tags, e.people, e.photos,
    e.audios.map(a => [a.id, a.uri, a.duration, a.createdAt]),
    e.videos.map(v => [v.id, v.uri, v.duration, v.poster, v.width, v.height, v.createdAt]),
    e.favorite, e.pinned, e.hidden, e.deletedAt, e.purgedAt, e.weather, e.temperature,
    e.place?.name, e.place?.detail, e.place?.latitude, e.place?.longitude,
    e.template, e.notebookId, e.photoLayout, e.paper, e.ai?.reply?.text, e.ai?.reply?.at];
  return Array.from(sha256(new TextEncoder().encode(JSON.stringify(content))), n => n.toString(16).padStart(2, '0')).join('');
}

export function sameEntry(a: Entry, b: Entry): boolean {
  return entryFingerprint(a) === entryFingerprint(b);
}

export function mergeSyncEntries(local: Entry[], remote: Entry[], lastSync: number,
  deleted: Record<string, number> = {}, resolution?: { choice: ConflictChoice; conflicts: SyncConflict[] }, revisions?: Record<string, number>) {
  const deletedEntries = { ...deleted };
  const conflicts: SyncConflict[] = [];
  const merged = new Map(local.map(e => [e.id, e]));
  const resolved = new Map(resolution?.conflicts.map(c => [c.entryId, c]) ?? []);
  for (const raw of remote) {
    const r = normalizeEntry(raw);
    if (r.purgedAt) {
      deletedEntries[r.id] = Math.max(deletedEntries[r.id] ?? 0, r.purgedAt);
      continue;
    }
    if (deletedEntries[r.id]) {
      deletedEntries[r.id] = Math.max(deletedEntries[r.id], r.updatedAt + 1);
      continue;
    }
    const l = merged.get(r.id);
    if (!l) { merged.set(r.id, r); continue; }
    if (sameEntry(l, r)) continue;
    const known = resolved.get(r.id);
    const baseline = revisions?.[r.id] ?? lastSync;
    // A remote edit made after the user saw the conflict needs a fresh decision.
    if (resolution && known && sameEntry(known.cloudEntry, r)) {
      const selected = resolution.choice === 'cloud' || (resolution.choice === 'latest' && r.updatedAt > l.updatedAt) ? r : l;
      merged.set(r.id, { ...selected, updatedAt: Math.max(Date.now(), l.updatedAt, r.updatedAt) + 1 });
    } else if ((r.updatedAt > baseline && l.updatedAt > baseline) || r.updatedAt === l.updatedAt) {
      conflicts.push({ entryId: l.id, localUpdatedAt: l.updatedAt, cloudUpdatedAt: r.updatedAt, cloudEntry: r });
    } else if (r.updatedAt > l.updatedAt) {
      merged.set(r.id, r);
    }
  }
  Object.keys(deletedEntries).forEach(id => merged.delete(id));
  return { entries: [...merged.values()], deletedEntries, conflicts: conflicts.filter(c => !deletedEntries[c.entryId]) };
}

/** Tombstones deliberately contain no diary text or media. */
export function syncPayload(entries: Entry[], deletedEntries: Record<string, number>): Entry[] {
  return [...entries, ...Object.entries(deletedEntries).map(([id, at]) => normalizeEntry({
    id, title: '', body: '', createdAt: at, updatedAt: at, deletedAt: at, purgedAt: at, status: 'draft',
  }))];
}

/** Keep edits, additions and deletions made while an upload was in flight. */
export function preserveConcurrentEdits(before: Entry[], current: Entry[], synced: Entry[]): Entry[] {
  const base = new Map(before.map(e => [e.id, e]));
  const present = new Map(current.map(e => [e.id, e]));
  const result = new Map(synced.map(e => [e.id, e]));
  for (const e of current) if (base.get(e.id) !== e) result.set(e.id, e);
  for (const e of before) if (!present.has(e.id)) result.delete(e.id);
  return [...result.values()];
}
