export type AppSettings = {
  appLockEnabled: boolean;
  appLockPinHash: string | null;
  appLockPinSalt: string | null;
};

export const defaultAppSettings: AppSettings = {
  appLockEnabled: false,
  appLockPinHash: null,
  appLockPinSalt: null,
};

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function normalizeAppSettings(value: unknown): AppSettings {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const appLockPinHash = asNullableString(record.appLockPinHash);
  const appLockPinSalt = asNullableString(record.appLockPinSalt);

  return {
    appLockEnabled: Boolean(record.appLockEnabled && appLockPinHash && appLockPinSalt),
    appLockPinHash,
    appLockPinSalt,
  };
}
