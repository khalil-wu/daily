import type { MemoryLocation } from '@/src/data/mock';

function formatCoordinate(value: number, positive: string, negative: string): string {
  const direction = value >= 0 ? positive : negative;
  return `${Math.abs(value).toFixed(4)}${direction}`;
}

export function formatLocationLabel(latitude: number, longitude: number): string {
  return `${formatCoordinate(latitude, 'N', 'S')}, ${formatCoordinate(longitude, 'E', 'W')}`;
}

export function normalizeLocation(value: unknown): MemoryLocation | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const latitude = typeof record.latitude === 'number' ? record.latitude : Number(record.latitude);
  const longitude = typeof record.longitude === 'number' ? record.longitude : Number(record.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  const label = typeof record.label === 'string' && record.label.trim().length > 0
    ? record.label.trim()
    : formatLocationLabel(latitude, longitude);
  const accuracy = typeof record.accuracy === 'number' && Number.isFinite(record.accuracy)
    ? record.accuracy
    : null;

  return { latitude, longitude, label, accuracy };
}
