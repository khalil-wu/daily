import type { Entry, MoodKey } from '../../store/types';
import { moodMeta } from '../../data/constants';
import { WEEK_CN, dayKey } from '../date';
import { plainText, wordCount } from '../text';
import type { EntryContext } from './prompts';
import { sendableEntries } from './privacy';

export type ReviewKind = 'week' | 'month';

/** 至少要有这么多篇，才值得做一次回顾 */
export const MIN_REVIEW_ENTRIES = 2;

export interface Period {
  kind: ReviewKind;
  from: number;
  /** 不含 */
  to: number;
  label: string;
}

/** 自然周（周一到周日）或自然月。offset：0 = 当前，-1 = 上一个 */
export function periodRange(kind: ReviewKind, offset = 0, now = Date.now()): Period {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (kind === 'week') {
    const sinceMonday = (d.getDay() + 6) % 7;
    const from = new Date(d.getFullYear(), d.getMonth(), d.getDate() - sinceMonday + offset * 7);
    const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
    const last = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 1);
    const label =
      offset === 0 ? '本周' : offset === -1 ? '上周' : `${from.getMonth() + 1}月${from.getDate()}日 – ${last.getMonth() + 1}月${last.getDate()}日`;
    return { kind, from: from.getTime(), to: to.getTime(), label };
  }
  const from = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  const label = offset === 0 ? '本月' : offset === -1 ? '上月' : `${from.getFullYear()}年${from.getMonth() + 1}月`;
  return { kind, from: from.getTime(), to: to.getTime(), label };
}

/** 这段时间里可以发给 AI 的日记（已发布、未隐藏、未删除），按时间先后 */
export function entriesInRange(entries: Entry[], from: number, to: number): Entry[] {
  return sendableEntries(entries)
    .filter(e => e.createdAt >= from && e.createdAt < to)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export interface PeriodStats {
  count: number;
  days: number;
  words: number;
  moods: { mood: MoodKey; count: number }[];
  people: { id: string; count: number }[];
}

/** 这段时间的基本数字：不需要 AI，本机直接算 */
export function periodStats(entries: Entry[], from: number, to: number): PeriodStats {
  const list = entriesInRange(entries, from, to);
  const moods = new Map<MoodKey, number>();
  const people = new Map<string, number>();
  const days = new Set<string>();
  let words = 0;
  for (const e of list) {
    days.add(dayKey(e.createdAt));
    words += wordCount(e.title) + wordCount(e.body);
    if (e.mood) moods.set(e.mood, (moods.get(e.mood) ?? 0) + 1);
    for (const id of e.people) people.set(id, (people.get(id) ?? 0) + 1);
  }
  const rank = <K>(m: Map<K, number>) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  return {
    count: list.length,
    days: days.size,
    words,
    moods: rank(moods).map(([mood, count]) => ({ mood, count })),
    people: rank(people).map(([id, count]) => ({ id, count })),
  };
}

/**
 * 把一段时间的日记压成给模型看的摘录。
 * 总长度有上限：篇数越多，每篇留的正文越短（但至少 160 字）。
 */
export function buildDigest(list: Entry[], ctx: EntryContext, budget = 9000): string {
  if (!list.length) return '';
  const per = Math.max(160, Math.floor(budget / list.length));
  return list
    .map(e => {
      const d = new Date(e.createdAt);
      const head = [`${d.getMonth() + 1}月${d.getDate()}日 ${WEEK_CN[d.getDay()]}`];
      const mood = moodMeta(e.mood);
      if (mood) head.push(`心情：${mood.label}`);
      const names = e.people.map(id => ctx.people.find(p => p.id === id)?.name).filter(Boolean);
      if (names.length) head.push(`和：${names.join('、')}`);
      const body = plainText(e.body).replace(/\n{2,}/g, '\n').trim();
      const clipped = body.length > per ? `${body.slice(0, per)}…` : body;
      return `【${head.join('｜')}】${e.title.trim() ? ` ${e.title.trim()}` : ''}\n${clipped || '（只有标题）'}`;
    })
    .join('\n\n');
}
