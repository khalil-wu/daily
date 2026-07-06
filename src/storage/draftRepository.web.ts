import { normalizeMemoryDraft } from '@/src/storage/draftTypes';
import type { MemoryDraft } from '@/src/storage/draftTypes';

const STORAGE_KEY = 'remember-diary:draft:v1';
const ARCHIVE_KEY = 'remember-diary:draft-archive:v1';

function canUseLocalStorage(): boolean {
  return typeof globalThis.localStorage !== 'undefined';
}

export async function loadDraft(): Promise<MemoryDraft | null> {
  if (!canUseLocalStorage()) return null;
  const raw = globalThis.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return normalizeMemoryDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function saveDraft(draft: MemoryDraft): Promise<void> {
  if (!canUseLocalStorage()) return;
  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeMemoryDraft(draft)));
}

export async function clearDraft(): Promise<void> {
  if (!canUseLocalStorage()) return;
  globalThis.localStorage.removeItem(STORAGE_KEY);
}

// 归档草稿（多份）：用户主动存档的草稿快照列表
export type ArchivedDraft = MemoryDraft & { id: string };

export async function loadArchivedDrafts(): Promise<ArchivedDraft[]> {
  if (!canUseLocalStorage()) return [];
  const raw = globalThis.localStorage.getItem(ARCHIVE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const normalized = normalizeMemoryDraft(item);
        if (!normalized) return null;
        const id = typeof (item as Record<string, unknown>).id === 'string' ? String((item as Record<string, unknown>).id) : normalized.updatedAt;
        return { ...normalized, id };
      })
      .filter((item): item is ArchivedDraft => item !== null);
  } catch {
    return [];
  }
}

export async function saveArchivedDrafts(drafts: ArchivedDraft[]): Promise<void> {
  if (!canUseLocalStorage()) return;
  globalThis.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(drafts));
}

export async function removeArchivedDraft(id: string): Promise<ArchivedDraft[]> {
  const current = await loadArchivedDrafts();
  const next = current.filter((item) => item.id !== id);
  await saveArchivedDrafts(next);
  return next;
}
