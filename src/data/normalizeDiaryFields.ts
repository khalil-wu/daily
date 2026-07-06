import type { MemoryAttachment, MemoryVoiceNote } from '@/src/data/mock';

export function normalizeAvatarUri(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const item of value) {
    if (typeof item !== 'string') continue;
    const tag = item.trim().replace(/^#+/, '').replace(/\s+/g, ' ');
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }

  return tags.slice(0, 12);
}

export function normalizeAttachments(attachments?: MemoryAttachment[]): MemoryAttachment[] {
  return (attachments ?? []).filter((attachment) => attachment.type === 'image' && Boolean(attachment.uri));
}

export function normalizeVoiceNotes(value: unknown): MemoryVoiceNote[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): MemoryVoiceNote | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const uri = typeof record.uri === 'string' ? record.uri : '';
      if (!uri) return null;

      return {
        id: typeof record.id === 'string' && record.id
          ? record.id
          : `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        uri,
        durationMs: typeof record.durationMs === 'number' && Number.isFinite(record.durationMs)
          ? Math.max(0, record.durationMs)
          : 0,
        createdAt: typeof record.createdAt === 'string' && record.createdAt
          ? record.createdAt
          : new Date().toISOString(),
      };
    })
    .filter((item): item is MemoryVoiceNote => item !== null);
}
