import type { Entry } from '../store/types';
import { dayKey, isSameDay, startOfDay } from './date';
import { wordCount } from './text';

export interface EntryGroup {
  key: string;
  title: string;
  entries: Entry[];
}

export interface GoalProgress {
  written: number;
  target: number;
  percent: number;
  achieved: boolean;
}

/**
 * 将日记列表按「置顶 / 今天 / 昨天 / 本周 / 本月 / YYYY年M月」分组，并过滤空组。
 * 每组内部按 createdAt 降序排列。
 */
export function groupEntriesByDate(entries: Entry[], now = Date.now(), respectPinned = true): EntryGroup[] {
  if (!entries.length) return [];

  const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt);
  const todayStart = startOfDay(now);

  const yDate = new Date(todayStart);
  yDate.setDate(yDate.getDate() - 1);
  const yesterdayStart = yDate.getTime();

  const dNow = new Date(todayStart);
  const dow = (dNow.getDay() + 6) % 7; // 周一为 0
  const wDate = new Date(dNow);
  wDate.setDate(dNow.getDate() - dow);
  const weekStart = wDate.getTime();

  const monthStart = new Date(dNow.getFullYear(), dNow.getMonth(), 1).getTime();

  const pinned: Entry[] = [];
  const today: Entry[] = [];
  const yesterday: Entry[] = [];
  const week: Entry[] = [];
  const month: Entry[] = [];
  const earlierMap = new Map<string, { year: number; month: number; entries: Entry[] }>();

  for (const e of sorted) {
    if (respectPinned && e.pinned) {
      pinned.push(e);
      continue;
    }
    const dayStart = startOfDay(e.createdAt);
    if (dayStart >= todayStart) {
      today.push(e);
    } else if (dayStart >= yesterdayStart) {
      yesterday.push(e);
    } else if (dayStart >= weekStart) {
      week.push(e);
    } else if (dayStart >= monthStart) {
      month.push(e);
    } else {
      const ed = new Date(e.createdAt);
      const y = ed.getFullYear();
      const m = ed.getMonth();
      const k = `ym_${y}_${m}`;
      let bucket = earlierMap.get(k);
      if (!bucket) {
        bucket = { year: y, month: m, entries: [] };
        earlierMap.set(k, bucket);
      }
      bucket.entries.push(e);
    }
  }

  const groups: EntryGroup[] = [];
  if (pinned.length) groups.push({ key: 'pinned', title: '置顶', entries: pinned });
  if (today.length) groups.push({ key: 'today', title: '今天', entries: today });
  if (yesterday.length) groups.push({ key: 'yesterday', title: '昨天', entries: yesterday });
  if (week.length) groups.push({ key: 'week', title: '本周', entries: week });
  if (month.length) groups.push({ key: 'month', title: '本月', entries: month });

  const earlier = Array.from(earlierMap.entries()).sort((a, b) => {
    if (b[1].year !== a[1].year) return b[1].year - a[1].year;
    return b[1].month - a[1].month;
  });
  for (const [k, b] of earlier) {
    groups.push({ key: k, title: `${b.year}年${b.month + 1}月`, entries: b.entries });
  }

  return groups;
}

/** 统计今日已写字数（含已发布与草稿，不含隐藏/已删除）与目标达成进度 */
export function computeDailyGoalProgress(entries: Entry[], dailyWords: number, now = Date.now()): GoalProgress {
  const target = Math.max(1, Math.round(dailyWords || 0));
  let written = 0;
  for (const e of entries) {
    if (e.deletedAt || e.hidden) continue;
    if (!isSameDay(e.createdAt, now)) continue;
    written += wordCount(e.title) + wordCount(e.body);
  }
  const percent = Math.min(100, Math.round((written / target) * 100));
  return {
    written,
    target,
    percent,
    achieved: written >= target,
  };
}

export interface TodaySummary {
  /** 今天已发布的篇数 */
  count: number;
  /** 今天已写字数（含草稿） */
  words: number;
  /** 当前连续记录天数（今天还没写但昨天写了，仍计入） */
  streak: number;
  /** 今天是否已经发布过日记 */
  wroteToday: boolean;
}

/** 首页「今日」卡片用的轻量汇总：今日篇数、字数与连续记录天数（与统计页口径一致） */
export function computeTodaySummary(entries: Entry[], now = Date.now()): TodaySummary {
  const days = new Set<string>();
  let count = 0;
  let words = 0;
  for (const e of entries) {
    if (e.deletedAt || e.hidden) continue;
    const today = isSameDay(e.createdAt, now);
    if (today && !e.hidden) words += wordCount(e.title) + wordCount(e.body);
    if (e.status !== 'published') continue;
    days.add(dayKey(e.createdAt));
    if (today && !e.hidden) count += 1;
  }

  let streak = 0;
  const cursor = new Date(startOfDay(now));
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { count, words, streak, wroteToday: count > 0 };
}
