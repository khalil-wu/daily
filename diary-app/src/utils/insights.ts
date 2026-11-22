import type { Entry, MoodKey } from '../store/types';
import { MOODS, MOOD_ORDER, moodMeta } from '../data/constants';
import { dayKey, daysBetween, startOfDay } from './date';
import { wordCount } from './text';
import type { MoodStat, TimeSlotStat, TrendPoint } from './stats';

/**
 * 「回顾」页的数据层：周 / 月 / 年三种时间段共用一套聚合。
 * 只看已发布、未隐藏、未删除的日记；一次遍历算完，切换时间段时不卡顿。
 */

export type PeriodKind = 'week' | 'month' | 'year';

export interface InsightPeriod {
  kind: PeriodKind;
  offset: number;
  from: number;
  /** 不含 */
  to: number;
  /** 本周 / 上月 / 2025年 */
  label: string;
  /** 11月16日 – 11月22日 / 2026年11月 / 2026年 */
  rangeText: string;
  isCurrent: boolean;
}

export interface DayCell {
  key: string;
  date: number;
  count: number;
  words: number;
  mood?: MoodKey;
  entryIds: string[];
  future: boolean;
}

export interface PeriodInsights {
  period: InsightPeriod;
  count: number;
  days: number;
  words: number;
  photos: number;
  avgWords: number;
  /** 上一个同类时间段的篇数，用来说「比上周多 2 篇」 */
  prevCount: number;
  /** 按次数从多到少 */
  moods: MoodStat[];
  moodTotal: number;
  dominantMood?: MoodKey;
  /** 时间段内的每一天（年视图 365/366 天） */
  cells: DayCell[];
  /** 周 / 月：逐日平均心情；年：逐月平均心情 */
  trend: TrendPoint[];
  /** 年视图：12 个月的篇数与心情构成 */
  months: { month: number; count: number; moods: { key: MoodKey; count: number }[] }[];
  tags: { id: string; count: number }[];
  people: { id: string; count: number }[];
  places: { name: string; count: number }[];
  timeSlots: TimeSlotStat[];
  longest?: Entry;
  first?: Entry;
  latestNight?: Entry;
  photoUris: string[];
}

const md = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`;

/** 自然周（周一起）、自然月、自然年。offset：0 = 当前，-1 = 上一个 */
export function insightPeriod(kind: PeriodKind, offset = 0, now = Date.now()): InsightPeriod {
  const d = new Date(startOfDay(now));
  const isCurrent = offset === 0;
  if (kind === 'week') {
    const sinceMonday = (d.getDay() + 6) % 7;
    const from = new Date(d.getFullYear(), d.getMonth(), d.getDate() - sinceMonday + offset * 7);
    const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
    const last = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 1);
    const sameYear = from.getFullYear() === d.getFullYear();
    const rangeText = `${sameYear ? '' : `${from.getFullYear()}年`}${md(from)} – ${md(last)}`;
    const label = offset === 0 ? '本周' : offset === -1 ? '上周' : rangeText;
    return { kind, offset, from: from.getTime(), to: to.getTime(), label, rangeText, isCurrent };
  }
  if (kind === 'month') {
    const from = new Date(d.getFullYear(), d.getMonth() + offset, 1);
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
    const rangeText = `${from.getFullYear()}年${from.getMonth() + 1}月`;
    const label = offset === 0 ? '本月' : offset === -1 ? '上月' : rangeText;
    return { kind, offset, from: from.getTime(), to: to.getTime(), label, rangeText, isCurrent };
  }
  const from = new Date(d.getFullYear() + offset, 0, 1);
  const to = new Date(from.getFullYear() + 1, 0, 1);
  const rangeText = `${from.getFullYear()}年`;
  const label = offset === 0 ? '今年' : offset === -1 ? '去年' : rangeText;
  return { kind, offset, from: from.getTime(), to: to.getTime(), label, rangeText, isCurrent };
}

const SLOTS: { key: TimeSlotStat['key']; label: string; range: string; match: (h: number) => boolean }[] = [
  { key: 'dawn', label: '清晨', range: '05–09', match: h => h >= 5 && h < 9 },
  { key: 'morning', label: '上午', range: '09–12', match: h => h >= 9 && h < 12 },
  { key: 'afternoon', label: '午后', range: '12–18', match: h => h >= 12 && h < 18 },
  { key: 'evening', label: '夜晚', range: '18–23', match: h => h >= 18 && h < 23 },
  { key: 'night', label: '深夜', range: '23–05', match: h => h >= 23 || h < 5 },
];

const visible = (e: Entry) => !e.deletedAt && !e.hidden && e.status === 'published';

/** 一天里最常出现的心情；次数相同时取较晚写下的那篇 */
function dayMood(list: Entry[]): MoodKey | undefined {
  const freq = new Map<MoodKey, { n: number; at: number }>();
  for (const e of list) {
    if (!e.mood) continue;
    const cur = freq.get(e.mood);
    freq.set(e.mood, { n: (cur?.n ?? 0) + 1, at: Math.max(cur?.at ?? 0, e.createdAt) });
  }
  let best: MoodKey | undefined;
  let bestN = 0;
  let bestAt = 0;
  freq.forEach((v, k) => {
    if (v.n > bestN || (v.n === bestN && v.at > bestAt)) {
      best = k;
      bestN = v.n;
      bestAt = v.at;
    }
  });
  return best;
}

/** 夜里越晚分数越高：21 点 → 21，凌晨 2 点 → 26；白天的日记不算 */
function nightScore(ts: number): number {
  const d = new Date(ts);
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 21) return h;
  if (h < 5) return h + 24;
  return -1;
}

const rank = <K>(m: Map<K, number>) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]);

export function computeInsights(entries: Entry[], kind: PeriodKind, offset = 0, now = Date.now()): PeriodInsights {
  const period = insightPeriod(kind, offset, now);
  const prev = insightPeriod(kind, offset - 1, now);
  const todayStart = startOfDay(now);

  const list: Entry[] = [];
  let prevCount = 0;
  for (const e of entries) {
    if (!visible(e)) continue;
    if (e.createdAt >= period.from && e.createdAt < period.to) list.push(e);
    else if (e.createdAt >= prev.from && e.createdAt < prev.to) prevCount += 1;
  }
  list.sort((a, b) => a.createdAt - b.createdAt);

  const byDay = new Map<string, Entry[]>();
  const moodCounts = new Map<MoodKey, number>();
  const tagMap = new Map<string, number>();
  const peopleMap = new Map<string, number>();
  const placeMap = new Map<string, number>();
  const slotCounts = new Map<TimeSlotStat['key'], number>();
  const monthAgg = Array.from({ length: 12 }, () => ({ count: 0, moods: new Map<MoodKey, number>(), score: 0, scored: 0 }));
  const photoUris: string[] = [];
  let words = 0;
  let photos = 0;
  let longest: { e: Entry; w: number } | undefined;
  let latestNight: { e: Entry; s: number } | undefined;

  for (const e of list) {
    const k = dayKey(e.createdAt);
    const arr = byDay.get(k);
    if (arr) arr.push(e);
    else byDay.set(k, [e]);
    const w = wordCount(e.title) + wordCount(e.body);
    words += w;
    photos += e.photos.length;
    for (const p of e.photos) if (photoUris.length < 12) photoUris.push(p);
    if (!longest || w > longest.w) longest = { e, w };
    const ns = nightScore(e.createdAt);
    if (ns >= 0 && (!latestNight || ns >= latestNight.s)) latestNight = { e, s: ns };
    if (e.mood) moodCounts.set(e.mood, (moodCounts.get(e.mood) ?? 0) + 1);
    for (const id of e.tags) tagMap.set(id, (tagMap.get(id) ?? 0) + 1);
    for (const id of e.people) peopleMap.set(id, (peopleMap.get(id) ?? 0) + 1);
    const place = e.place?.name?.trim();
    if (place) placeMap.set(place, (placeMap.get(place) ?? 0) + 1);
    const h = new Date(e.createdAt).getHours();
    const slot = SLOTS.find(s => s.match(h))!;
    slotCounts.set(slot.key, (slotCounts.get(slot.key) ?? 0) + 1);
    const m = monthAgg[new Date(e.createdAt).getMonth()];
    m.count += 1;
    if (e.mood) {
      m.moods.set(e.mood, (m.moods.get(e.mood) ?? 0) + 1);
      m.score += moodMeta(e.mood)?.score ?? 3;
      m.scored += 1;
    }
  }

  // 每一天的格子（按本地日历逐日推进，避开夏令时的 24 小时误差）
  const cells: DayCell[] = [];
  const trend: TrendPoint[] = [];
  const start = new Date(period.from);
  for (let i = 0; ; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const ts = d.getTime();
    if (ts >= period.to) break;
    const k = dayKey(d);
    const dayList = byDay.get(k) ?? [];
    const mood = dayMood(dayList);
    cells.push({
      key: k,
      date: ts,
      count: dayList.length,
      words: dayList.reduce((s, e) => s + wordCount(e.title) + wordCount(e.body), 0),
      mood,
      entryIds: dayList.map(e => e.id),
      future: ts > todayStart,
    });
    if (kind !== 'year') {
      const scored = dayList.filter(e => e.mood);
      const score = scored.length ? Math.round((scored.reduce((s, e) => s + (moodMeta(e.mood)?.score ?? 3), 0) / scored.length) * 10) / 10 : null;
      trend.push({ date: ts, label: `${d.getMonth() + 1}/${d.getDate()}`, score, count: dayList.length });
    }
  }
  if (kind === 'year') {
    const y = start.getFullYear();
    monthAgg.forEach((m, i) => {
      trend.push({ date: new Date(y, i, 1).getTime(), label: `${i + 1}月`, score: m.scored ? Math.round((m.score / m.scored) * 10) / 10 : null, count: m.count });
    });
  }

  const moodTotal = Array.from(moodCounts.values()).reduce((a, b) => a + b, 0);
  const moods: MoodStat[] = MOOD_ORDER.filter(k => moodCounts.has(k))
    .map(key => {
      const meta = MOODS.find(m => m.key === key)!;
      const count = moodCounts.get(key)!;
      return { key, label: meta.label, color: meta.color, count, percent: Math.round((count / moodTotal) * 100) };
    })
    .sort((a, b) => b.count - a.count);

  const count = list.length;
  return {
    period,
    count,
    days: byDay.size,
    words,
    photos,
    avgWords: count ? Math.round(words / count) : 0,
    prevCount,
    moods,
    moodTotal,
    dominantMood: moods[0]?.key,
    cells,
    trend,
    months: kind === 'year'
      ? monthAgg.map((m, i) => ({ month: i + 1, count: m.count, moods: rank(m.moods).map(([key, n]) => ({ key, count: n })) }))
      : [],
    tags: rank(tagMap).map(([id, n]) => ({ id, count: n })),
    people: rank(peopleMap).map(([id, n]) => ({ id, count: n })),
    places: rank(placeMap).map(([name, n]) => ({ name, count: n })),
    timeSlots: SLOTS.map(s => {
      const n = slotCounts.get(s.key) ?? 0;
      return { key: s.key, label: s.label, range: s.range, count: n, percent: count ? Math.round((n / count) * 100) : 0 };
    }),
    longest: longest?.e,
    first: list[0],
    latestNight: latestNight?.e,
    photoUris,
  };
}

/** 当前连续天数（今天还没写但昨天写了，仍算连续）与历史最长连续 */
export function computeStreaks(entries: Entry[], now = Date.now()): { current: number; longest: number } {
  const days = new Set<string>();
  for (const e of entries) if (visible(e)) days.add(dayKey(e.createdAt));
  let current = 0;
  const cursor = new Date(startOfDay(now));
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  let longest = 0;
  let run = 0;
  let prevTs: number | null = null;
  for (const k of Array.from(days).sort()) {
    const [y, m, d] = k.split('-').map(Number);
    const ts = new Date(y, m - 1, d).getTime();
    run = prevTs !== null && daysBetween(prevTs, ts) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
    prevTs = ts;
  }
  return { current, longest };
}

/** 回顾页最早能往回翻到哪一期（有日记的最早那一期；没有日记时只看当前期） */
export function earliestOffset(entries: Entry[], kind: PeriodKind, now = Date.now()): number {
  let min = Infinity;
  for (const e of entries) if (visible(e) && e.createdAt < min) min = e.createdAt;
  if (!Number.isFinite(min) || min >= now) return 0;
  const today = new Date(startOfDay(now));
  const first = new Date(startOfDay(min));
  if (kind === 'year') return first.getFullYear() - today.getFullYear();
  if (kind === 'month') return (first.getFullYear() - today.getFullYear()) * 12 + first.getMonth() - today.getMonth();
  const monday = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime();
  return -Math.round((monday(today) - monday(first)) / (7 * 86400000));
}
