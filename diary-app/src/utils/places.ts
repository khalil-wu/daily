import type { Entry } from '../store/types';

export interface PlaceGroup {
  name: string;
  entries: Entry[];
  count: number;
  latest: number;
  locatedCount: number;
  lat?: number;
  lng?: number;
}

/** Manual place names remain useful even without coordinates; never invent a point. */
export function groupByPlace(entries: Entry[]): PlaceGroup[] {
  const groups = new Map<string, PlaceGroup>();
  for (const entry of entries) {
    const name = entry.place?.name?.trim();
    if (!name || entry.deletedAt || entry.hidden || entry.status !== 'published') continue;
    let group = groups.get(name);
    if (!group) {
      group = { name, entries: [], count: 0, latest: 0, locatedCount: 0 };
      groups.set(name, group);
    }
    group.entries.push(entry);
    group.count += 1;
    group.latest = Math.max(group.latest, entry.createdAt);
    const latitude = entry.place?.latitude;
    const longitude = entry.place?.longitude;
    if (typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180) {
      const count = group.locatedCount;
      group.lat = ((group.lat ?? 0) * count + latitude) / (count + 1);
      group.lng = ((group.lng ?? 0) * count + longitude) / (count + 1);
      group.locatedCount += 1;
    }
  }
  for (const group of groups.values()) group.entries.sort((a, b) => b.createdAt - a.createdAt);
  return [...groups.values()].sort((a, b) => b.count - a.count || b.latest - a.latest);
}
