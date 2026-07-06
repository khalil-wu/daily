import type { MemoryAttachment, MemoryLocation, MemoryPrivacyMode } from '@/src/data/mock';
import { normalizeAttachments, normalizeTags } from '@/src/data/normalizeDiaryFields';
import { normalizeLocation } from '@/src/location/locationLabel';

export type MemoryDraft = {
  content: string;
  mood: string | null;
  personIds: string[];
  attachments: MemoryAttachment[];
  location: MemoryLocation | null;
  privacyMode: MemoryPrivacyMode | null;
  tags: string[];
  updatedAt: string;
};

export const emptyMemoryDraft: MemoryDraft = {
  content: '',
  mood: null,
  personIds: [],
  attachments: [],
  location: null,
  privacyMode: null,
  tags: [],
  updatedAt: '',
};

export function normalizeMemoryDraft(value: unknown): MemoryDraft | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const personIds = Array.isArray(record.personIds)
    ? Array.from(new Set(record.personIds.filter((id): id is string => typeof id === 'string' && id.length > 0)))
    : [];
  const privacyMode = record.privacyMode === 'hidden' || record.privacyMode === 'masked'
    ? record.privacyMode
    : null;

  return {
    content: typeof record.content === 'string' ? record.content : '',
    mood: typeof record.mood === 'string' ? record.mood : null,
    personIds,
    attachments: normalizeAttachments(record.attachments as MemoryAttachment[] | undefined),
    location: normalizeLocation(record.location),
    privacyMode,
    tags: normalizeTags(record.tags),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString(),
  };
}

export function hasDraftContent(draft: Pick<MemoryDraft, 'content' | 'attachments' | 'personIds' | 'mood' | 'location' | 'privacyMode' | 'tags'>): boolean {
  return (
    draft.content.trim().length > 0 ||
    draft.attachments.length > 0 ||
    draft.personIds.length > 0 ||
    Boolean(draft.mood) ||
    Boolean(draft.location) ||
    Boolean(draft.privacyMode) ||
    draft.tags.length > 0
  );
}
