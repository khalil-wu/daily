import * as Crypto from 'expo-crypto';
import { create } from 'zustand';

import { defaultAppSettings } from '@/src/storage/appSettingsTypes';
import type { AppSettings } from '@/src/storage/appSettingsTypes';
import { loadAppSettings, saveAppSettings } from '@/src/storage/appSettingsRepository';

type AppLockState = {
  hydrated: boolean;
  appLockEnabled: boolean;
  locked: boolean;
  settingsError: string | null;
  hydrateAppLock: () => Promise<void>;
  enableAppLock: (pin: string) => Promise<void>;
  disableAppLock: () => Promise<void>;
  lockApp: () => void;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockTrusted: () => void;
  appLockPinHash: string | null;
  appLockPinSalt: string | null;
};

const MIN_PIN_LENGTH = 4;

function createSalt(): string {
  return Array.from(Crypto.getRandomBytes(16))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

function hasValidLock(settings: AppSettings): boolean {
  return Boolean(settings.appLockEnabled && settings.appLockPinHash && settings.appLockPinSalt);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export const useAppLockStore = create<AppLockState>((set, get) => ({
  hydrated: false,
  appLockEnabled: false,
  locked: false,
  settingsError: null,
  appLockPinHash: null,
  appLockPinSalt: null,
  hydrateAppLock: async () => {
    if (get().hydrated) return;

    try {
      const settings = await loadAppSettings();
      const enabled = hasValidLock(settings);
      set({
        hydrated: true,
        appLockEnabled: enabled,
        locked: enabled,
        settingsError: null,
        appLockPinHash: enabled ? settings.appLockPinHash : null,
        appLockPinSalt: enabled ? settings.appLockPinSalt : null,
      });
    } catch (error) {
      set({
        hydrated: true,
        appLockEnabled: false,
        locked: false,
        settingsError: errorMessage(error, '应用锁读取失败'),
        appLockPinHash: null,
        appLockPinSalt: null,
      });
    }
  },
  enableAppLock: async (pin) => {
    const normalizedPin = pin.trim();
    if (normalizedPin.length < MIN_PIN_LENGTH) {
      throw new Error('密码至少 4 位。');
    }

    const appLockPinSalt = createSalt();
    const appLockPinHash = await hashPin(normalizedPin, appLockPinSalt);
    const settings: AppSettings = {
      appLockEnabled: true,
      appLockPinHash,
      appLockPinSalt,
    };

    try {
      await saveAppSettings(settings);
      set({
        hydrated: true,
        appLockEnabled: true,
        locked: false,
        settingsError: null,
        appLockPinHash,
        appLockPinSalt,
      });
    } catch (error) {
      set({ settingsError: errorMessage(error, '应用锁保存失败') });
      throw error;
    }
  },
  disableAppLock: async () => {
    try {
      await saveAppSettings(defaultAppSettings);
      set({
        hydrated: true,
        appLockEnabled: false,
        locked: false,
        settingsError: null,
        appLockPinHash: null,
        appLockPinSalt: null,
      });
    } catch (error) {
      set({ settingsError: errorMessage(error, '应用锁关闭失败') });
      throw error;
    }
  },
  lockApp: () => {
    if (get().appLockEnabled) set({ locked: true });
  },
  unlockWithPin: async (pin) => {
    const { appLockEnabled, appLockPinHash, appLockPinSalt } = get();
    if (!appLockEnabled || !appLockPinHash || !appLockPinSalt) return false;

    const hash = await hashPin(pin.trim(), appLockPinSalt);
    const unlocked = hash === appLockPinHash;
    if (unlocked) set({ locked: false });
    return unlocked;
  },
  unlockTrusted: () => {
    if (get().appLockEnabled) set({ locked: false });
  },
}));
