import type { Entry, MoodKey, Person, Tag } from '../store/types';
import { personNames } from './people';
import { plainText } from './text';
import { videoSearchWords } from './video';

export interface SearchDocument {
  entry: Entry;
  text: string;
}

/** Prepare searchable text once per data change, not on every keystroke. */
export function buildSearchIndex(entries: Entry[], tags: Tag[], people: Person[]): SearchDocument[] {
  const tagNames = new Map(tags.map(tag => [tag.id, tag.name]));
  const names = new Map(people.map(person => [person.id, personNames(person).join(' ')]));
  return entries
    .filter(entry => !entry.deletedAt && !entry.hidden && entry.status === 'published')
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(entry => ({
      entry,
      text: [entry.title, plainText(entry.body), entry.place?.name ?? '',
        ...entry.tags.map(id => tagNames.get(id) ?? ''),
        ...entry.people.map(id => names.get(id) ?? ''), videoSearchWords(entry)]
        .join(' ').toLowerCase(),
    }));
}

export function searchEntries(index: SearchDocument[], query: string, filters: {
  tag?: string | null;
  mood?: MoodKey | null;
  person?: string | null;
} = {}): Entry[] {
  const q = query.trim().toLowerCase();
  if (!q && !filters.tag && !filters.mood && !filters.person) return [];
  return index.filter(({ entry, text }) =>
    (!filters.tag || entry.tags.includes(filters.tag)) &&
    (!filters.mood || entry.mood === filters.mood) &&
    (!filters.person || entry.people.includes(filters.person)) &&
    (!q || text.includes(q)),
  ).map(item => item.entry);
}
