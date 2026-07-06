import { File, Paths } from 'expo-file-system';

import type { MoodDef } from '@/src/i18n/copy';

const MOOD_FILE = 'remember-diary-moods.json';

function moodFile(): File {
  return new File(Paths.document, MOOD_FILE);
}

function isMoodDef(item: unknown): item is MoodDef {
  return (
    item !== null
    && typeof item === 'object'
    && typeof (item as MoodDef).id === 'string' && (item as MoodDef).id.length > 0
    && typeof (item as MoodDef).emoji === 'string'
    && typeof (item as MoodDef).label === 'string' && (item as MoodDef).label.length > 0
  );
}

export async function loadCustomMoods(): Promise<MoodDef[]> {
  const file = moodFile();
  if (!file.exists) return [];

  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isMoodDef).map((item) => ({ ...item, custom: true }));
  } catch {
    return [];
  }
}

export async function saveCustomMoods(moods: MoodDef[]): Promise<void> {
  const file = moodFile();
  file.create({ overwrite: true, intermediates: true });
  file.write(JSON.stringify(moods));
}
