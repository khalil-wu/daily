import type { DiaryData } from '@/src/storage/diaryRepository';
import type { CommunityPost, MemoryAttachment, MemoryPrivacyMode, MemorySummary, PersonSummary } from '@/src/data/mock';
import { normalizeAttachments as normalizeAttachmentList, normalizeAvatarUri, normalizeTags, normalizeVoiceNotes } from '@/src/data/normalizeDiaryFields';
import { normalizeLocation } from '@/src/location/locationLabel';

const BACKUP_KIND = 'remember-diary.backup';
const BACKUP_VERSION = 1;

export type DiaryBackupPayload = {
  kind: typeof BACKUP_KIND;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  data: DiaryData;
  media?: DiaryBackupMedia;
};

export type DiaryBackupEmbeddedMedia = {
  kind?: 'attachment';
  memoryId: string;
  attachmentId: string;
  fileName: string | null;
  mimeType: string | null;
  width?: number;
  height?: number;
  base64: string;
};

export type DiaryBackupEmbeddedVoiceNote = {
  kind?: 'voice';
  memoryId: string;
  voiceNoteId: string;
  fileName: string | null;
  mimeType: string | null;
  base64: string;
};

export type DiaryBackupEmbeddedAvatar = {
  kind?: 'avatar';
  personId: string;
  fileName: string | null;
  mimeType: string | null;
  base64: string;
};

export type DiaryBackupMedia = {
  attachments: DiaryBackupEmbeddedMedia[];
  avatars?: DiaryBackupEmbeddedAvatar[];
  voiceNotes?: DiaryBackupEmbeddedVoiceNote[];
};

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asPrivacyMode(value: unknown): MemoryPrivacyMode | undefined {
  return value === 'hidden' || value === 'masked' ? value : undefined;
}

function normalizeAttachments(value: unknown): MemoryAttachment[] {
  if (!Array.isArray(value)) return [];

  return normalizeAttachmentList(value
    .map((item): MemoryAttachment | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const uri = asString(record.uri);
      if (!uri) return null;

      return {
        id: asString(record.id, `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
        type: 'image',
        uri,
        width: typeof record.width === 'number' ? record.width : undefined,
        height: typeof record.height === 'number' ? record.height : undefined,
        fileName: typeof record.fileName === 'string' ? record.fileName : null,
        mimeType: typeof record.mimeType === 'string' ? record.mimeType : null,
      };
    })
    .filter((item): item is MemoryAttachment => item !== null));
}

function normalizePeople(value: unknown): PersonSummary[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): PersonSummary | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const id = asString(record.id);
      const name = asString(record.name).trim();
      if (!id || !name) return null;

      return {
        id,
        name,
        relation: asString(record.relation, '其他'),
        note: asString(record.note, '还没有写下描述。'),
        avatarUri: normalizeAvatarUri(record.avatarUri),
        memoryCount: typeof record.memoryCount === 'number' ? record.memoryCount : 0,
        lastDate: asString(record.lastDate, '还没有'),
        recent: Boolean(record.recent),
        stars: typeof record.stars === 'number' ? record.stars : 1,
        isPrivate: Boolean(record.isPrivate),
        privacyMode: Boolean(record.isPrivate)
          ? (record.privacyMode === 'masked' ? 'masked' : 'hidden')
          : undefined,
      };
    })
    .filter((item): item is PersonSummary => item !== null);
}

function normalizeMemories(value: unknown, people: PersonSummary[]): MemorySummary[] {
  if (!Array.isArray(value)) return [];
  const personIds = new Set(people.map((person) => person.id));

  return value
    .map((item): MemorySummary | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const id = asString(record.id);
      if (!id) return null;

      const relatedIds = Array.isArray(record.personIds)
        ? record.personIds.filter((personId): personId is string => typeof personId === 'string' && personIds.has(personId))
        : typeof record.personId === 'string' && personIds.has(record.personId)
          ? [record.personId]
          : [];
      const content = asString(record.content, asString(record.excerpt));
      const attachments = normalizeAttachments(record.attachments);

      return {
        id,
        personId: relatedIds[0] ?? null,
        personIds: relatedIds,
        title: asString(record.title, content.slice(0, 18) || '一段记忆'),
        content,
        excerpt: asString(record.excerpt, content),
        date: asString(record.date, '今天'),
        year: asString(record.year, String(new Date().getFullYear())),
        mood: asString(record.mood, '说不清'),
        hasMedia: Boolean(record.hasMedia || attachments.length),
        attachments,
        voiceNotes: normalizeVoiceNotes(record.voiceNotes),
        tags: normalizeTags(record.tags),
        isPrivate: Boolean(record.isPrivate),
        privacyMode: Boolean(record.isPrivate) ? asPrivacyMode(record.privacyMode) ?? 'hidden' : undefined,
        location: normalizeLocation(record.location),
      };
    })
    .filter((item): item is MemorySummary => item !== null);
}

function normalizeCommunityPosts(value: unknown): CommunityPost[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): CommunityPost | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const id = asString(record.id);
      const memoryId = asString(record.memoryId);
      if (!id || !memoryId) return null;
      return {
        id,
        memoryId,
        title: asString(record.title, '公开日记'),
        excerpt: asString(record.excerpt, asString(record.content)),
        content: asString(record.content, asString(record.excerpt)),
        date: asString(record.date, '今天'),
        mood: typeof record.mood === 'string' ? record.mood : null,
        attachmentUri: typeof record.attachmentUri === 'string' ? record.attachmentUri : null,
        likes: typeof record.likes === 'number' ? record.likes : 0,
        comments: typeof record.comments === 'number' ? record.comments : 0,
        followedByMe: Boolean(record.followedByMe),
        likedByMe: Boolean(record.likedByMe),
        repostedByMe: Boolean(record.repostedByMe),
      };
    })
    .filter((item): item is CommunityPost => item !== null);
}

function shortDateFrom(memory: MemorySummary | undefined): string {
  return memory?.date.split(' · ')[0] ?? '还没有';
}

export function normalizeDiaryData(value: unknown): DiaryData {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const people = normalizePeople(record.people);
  const memories = normalizeMemories(record.memories, people);

  return {
    people: people.map((person) => {
      const relatedMemories = memories.filter((memory) => memory.personIds.includes(person.id));
      const memoryCount = relatedMemories.length;
      return {
        ...person,
        memoryCount,
        lastDate: shortDateFrom(relatedMemories[0]),
        recent: memoryCount > 0,
        stars: memoryCount > 0 ? Math.min(2, Math.max(1, memoryCount)) : 1,
      };
    }),
    memories,
    communityPosts: normalizeCommunityPosts(record.communityPosts),
  };
}

export function createBackupPayload(data: DiaryData): DiaryBackupPayload {
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: normalizeDiaryData(data),
  };
}

export function parseBackupPayload(raw: string): DiaryData {
  const parsed = JSON.parse(raw) as unknown;
  const record = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};

  if (record.kind === BACKUP_KIND && record.version === BACKUP_VERSION) {
    return normalizeDiaryData(record.data);
  }

  return normalizeDiaryData(record);
}

export function parseBackupMedia(raw: string): DiaryBackupMedia {
  const parsed = JSON.parse(raw) as unknown;
  const record = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  const mediaRecord = record.media && typeof record.media === 'object'
    ? record.media as Record<string, unknown>
    : {};
  const attachments = Array.isArray(mediaRecord.attachments) ? mediaRecord.attachments : [];
  const avatars = Array.isArray(mediaRecord.avatars) ? mediaRecord.avatars : [];
  const voiceNotes = Array.isArray(mediaRecord.voiceNotes) ? mediaRecord.voiceNotes : [];

  return {
    attachments: attachments
      .map((item): DiaryBackupEmbeddedMedia | null => {
        if (!item || typeof item !== 'object') return null;
        const embedded = item as Record<string, unknown>;
        const memoryId = asString(embedded.memoryId);
        const attachmentId = asString(embedded.attachmentId);
        const base64 = asString(embedded.base64);
        if (!memoryId || !attachmentId || !base64) return null;

        return {
          memoryId,
          attachmentId,
          base64,
          fileName: typeof embedded.fileName === 'string' ? embedded.fileName : null,
          mimeType: typeof embedded.mimeType === 'string' ? embedded.mimeType : null,
          width: typeof embedded.width === 'number' ? embedded.width : undefined,
          height: typeof embedded.height === 'number' ? embedded.height : undefined,
        };
      })
      .filter((item): item is DiaryBackupEmbeddedMedia => item !== null),
    avatars: avatars
      .map((item): DiaryBackupEmbeddedAvatar | null => {
        if (!item || typeof item !== 'object') return null;
        const embedded = item as Record<string, unknown>;
        const personId = asString(embedded.personId);
        const base64 = asString(embedded.base64);
        if (!personId || !base64) return null;

        return {
          kind: 'avatar',
          personId,
          base64,
          fileName: typeof embedded.fileName === 'string' ? embedded.fileName : null,
          mimeType: typeof embedded.mimeType === 'string' ? embedded.mimeType : null,
        };
      })
      .filter((item): item is DiaryBackupEmbeddedAvatar => item !== null),
    voiceNotes: voiceNotes
      .map((item): DiaryBackupEmbeddedVoiceNote | null => {
        if (!item || typeof item !== 'object') return null;
        const embedded = item as Record<string, unknown>;
        const memoryId = asString(embedded.memoryId);
        const voiceNoteId = asString(embedded.voiceNoteId);
        const base64 = asString(embedded.base64);
        if (!memoryId || !voiceNoteId || !base64) return null;

        return {
          kind: 'voice',
          memoryId,
          voiceNoteId,
          base64,
          fileName: typeof embedded.fileName === 'string' ? embedded.fileName : null,
          mimeType: typeof embedded.mimeType === 'string' ? embedded.mimeType : null,
        };
      })
      .filter((item): item is DiaryBackupEmbeddedVoiceNote => item !== null),
  };
}
