import type { MoodDef } from '@/src/i18n/copy';

const STORAGE_KEY = 'remember-diary:moods:v1';

function canUseLocalStorage(): boolean {
  return typeof globalThis.localStorage !== 'undefined';
}

export async function loadCustomMoods(): Promise<MoodDef[]> {
  if (!canUseLocalStorage()) return [];
  const raw = globalThis.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is MoodDef => (
        item && typeof item === 'object'
        && typeof item.id === 'string' && item.id.length > 0
        && typeof item.emoji === 'string'
        && typeof item.label === 'string' && item.label.length > 0
      ))
      .map((item) => ({ ...item, custom: true }));
  } catch {
    return [];
  }
}

export async function saveCustomMoods(moods: MoodDef[]): Promise<void> {
  if (!canUseLocalStorage()) return;
  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(moods));
}
