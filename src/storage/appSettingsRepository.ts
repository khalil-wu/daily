import { defaultAppSettings, normalizeAppSettings } from '@/src/storage/appSettingsTypes';
import type { AppSettings } from '@/src/storage/appSettingsTypes';

const STORAGE_KEY = 'remember-diary:settings:v1';

function canUseLocalStorage(): boolean {
  return typeof globalThis.localStorage !== 'undefined';
}

export async function loadAppSettings(): Promise<AppSettings> {
  if (!canUseLocalStorage()) return defaultAppSettings;
  const raw = globalThis.localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultAppSettings;

  try {
    return normalizeAppSettings(JSON.parse(raw));
  } catch {
    return defaultAppSettings;
  }
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  if (!canUseLocalStorage()) return;
  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeAppSettings(settings)));
}
