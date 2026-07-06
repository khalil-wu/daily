import { File, Paths } from 'expo-file-system';

import { defaultAppSettings, normalizeAppSettings } from '@/src/storage/appSettingsTypes';
import type { AppSettings } from '@/src/storage/appSettingsTypes';

const SETTINGS_FILE = 'remember-diary-settings.json';

function settingsFile(): File {
  return new File(Paths.document, SETTINGS_FILE);
}

export async function loadAppSettings(): Promise<AppSettings> {
  const file = settingsFile();
  if (!file.exists) return defaultAppSettings;

  try {
    return normalizeAppSettings(JSON.parse(await file.text()));
  } catch {
    return defaultAppSettings;
  }
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  const file = settingsFile();
  file.create({ overwrite: true, intermediates: true });
  file.write(JSON.stringify(normalizeAppSettings(settings)));
}
