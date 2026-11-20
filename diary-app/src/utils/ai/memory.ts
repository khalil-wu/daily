import type { Entry } from '../../store/types';
import { extractKeywords } from '../keywords';
import { excerpt, plainText } from '../text';
import { sendableEntries } from './privacy';

export interface Memory {
  entryId: string;
  at: number;
  title: string;
  excerpt: string;
}

const WINDOW_MS = 180 * 86400000;

/**
 * 给「回信」挑几段相关的旧日记，让「记得」能提起以前写过的事。
 * 只在本机挑选；只有被挑中的片段（每段约一百字）会随这次请求发出。
 * 相关的标准：写到了同一个人，或者有两个以上相同的关键词。只是标签相同不算。
 */
export function pickMemories(entry: Pick<Entry, 'id' | 'title' | 'body' | 'createdAt' | 'tags' | 'people'>, entries: Entry[], limit = 3): Memory[] {
  const keywords = extractKeywords([`${entry.title}\n${entry.body}`], 14).map(k => k.word);
  const scored: { e: Entry; score: number }[] = [];
  for (const e of sendableEntries(entries)) {
    if (e.id === entry.id || e.createdAt >= entry.createdAt) continue;
    const age = entry.createdAt - e.createdAt;
    if (age > WINDOW_MS) continue;
    const sharedPeople = e.people.filter(id => entry.people.includes(id)).length;
    const text = `${e.title}\n${plainText(e.body)}`.toLowerCase();
    const keywordHits = keywords.filter(k => text.includes(k)).length;
    if (!sharedPeople && keywordHits < 2) continue;
    const sharedTags = Math.min(2, e.tags.filter(id => entry.tags.includes(id)).length);
    const score = sharedPeople * 3 + Math.min(4, keywordHits) + sharedTags + (1 - age / WINDOW_MS);
    scored.push({ e, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || b.e.createdAt - a.e.createdAt)
    .slice(0, Math.max(0, limit))
    .map(({ e }) => ({ entryId: e.id, at: e.createdAt, title: e.title.trim(), excerpt: excerpt(e.body, 110) }))
    .filter(m => !!m.excerpt);
}
