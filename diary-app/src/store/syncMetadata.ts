import type { AppState, SyncMetadata } from './types';

export function syncMetadata(s: AppState): SyncMetadata {
  return { ...(s.sync.syncTags ? { tags: s.tags, people: s.people, notebooks: s.notebooks } : {}),
    ...(s.sync.syncSettings ? { appearance: s.appearance, goals: s.goals, reminders: s.reminders } : {}) };
}

/** Three-way merge: independent keys combine; simultaneous changes keep this device. */
export function mergeMetadata(local: SyncMetadata, remote: SyncMetadata = {}, baseline: SyncMetadata = {}): SyncMetadata {
  const output: Record<string, unknown> = { ...remote };
  for (const key of Object.keys(local) as (keyof SyncMetadata)[]) {
    const a = local[key], b = remote[key], old = baseline[key];
    if (Array.isArray(a) && Array.isArray(b)) {
      const previous = new Map((Array.isArray(old) ? old : []).map(x => [x.id, x]));
      const left = new Map(a.map(x => [x.id, x]));
      const right = new Map(b.map(x => [x.id, x]));
      const result = new Map(right);
      for (const [id, item] of left) {
        if (!previous.has(id) || JSON.stringify(item) !== JSON.stringify(previous.get(id))) result.set(id, item);
      }
      for (const id of previous.keys()) if (!left.has(id)) result.delete(id);
      output[key] = [...result.values()];
    } else if (a && b && typeof a === 'object' && typeof b === 'object') {
      const merged = { ...b } as Record<string, unknown>;
      for (const [field, value] of Object.entries(a)) {
        if (!old || JSON.stringify(value) !== JSON.stringify((old as unknown as Record<string, unknown>)[field])) merged[field] = value;
      }
      output[key] = merged;
    } else output[key] = a;
  }
  return output as SyncMetadata;
}

export function enabledMetadata(s: AppState, metadata: SyncMetadata): SyncMetadata {
  return { ...(s.sync.syncTags ? { tags: metadata.tags, people: metadata.people, notebooks: metadata.notebooks } : {}),
    ...(s.sync.syncSettings ? { appearance: metadata.appearance, goals: metadata.goals, reminders: metadata.reminders } : {}) };
}

export function syncNetworkBlock(wifiOnly: boolean): string | null {
  if (typeof navigator === 'undefined') return null;
  if (navigator.onLine === false) return '当前网络离线，日记保留在本机，联网后可重试';
  if (!wifiOnly) return null;
  const connection = (navigator as unknown as { connection?: { type?: string } }).connection;
  if (connection?.type === 'wifi' || connection?.type === 'ethernet') return null;
  if (connection?.type === 'cellular') return '当前网络为移动数据，已按「仅 Wi-Fi」设置暂停同步';
  return '无法确认当前是否为 Wi-Fi，已暂停同步；确认网络后可关闭「仅 Wi-Fi」限制再试';
}
