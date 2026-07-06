import { File, Paths } from 'expo-file-system';

import { normalizeMemoryDraft } from '@/src/storage/draftTypes';
import type { MemoryDraft } from '@/src/storage/draftTypes';

const DRAFT_FILE = 'remember-diary-draft.json';
const ARCHIVE_FILE = 'remember-diary-draft-archive.json';

function draftFile(): File {
  return new File(Paths.document, DRAFT_FILE);
}

function archiveFile(): File {
  return new File(Paths.document, ARCHIVE_FILE);
}

export async function loadDraft(): Promise<MemoryDraft | null> {
  const file = draftFile();
  if (!file.exists) return null;

  try {
    return normalizeMemoryDraft(JSON.parse(await file.text()));
  } catch {
    return null;
  }
}

export async function saveDraft(draft: MemoryDraft): Promise<void> {
  const normalized = normalizeMemoryDraft(draft);
  if (!normalized) return;
  const file = draftFile();
  file.create({ overwrite: true, intermediates: true });
  file.write(JSON.stringify(normalized));
}

export async function clearDraft(): Promise<void> {
  const file = draftFile();
  if (file.exists) {
    file.delete();
  }
}

// 归档草稿（多份）：用户主动存档的草稿快照列表
export type ArchivedDraft = MemoryDraft & { id: string };

export async function loadArchivedDrafts(): Promise<ArchivedDraft[]> {
  const file = archiveFile();
  if (!file.exists) return [];

  try {
    const parsed = JSON.parse(await file.text());
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
  const file = archiveFile();
  file.create({ overwrite: true, intermediates: true });
  file.write(JSON.stringify(drafts));
}

export async function removeArchivedDraft(id: string): Promise<ArchivedDraft[]> {
  const current = await loadArchivedDrafts();
  const next = current.filter((item) => item.id !== id);
  await saveArchivedDrafts(next);
  return next;
}
