import type { Entry, MoodKey, WeatherKey } from '../store/types';
import { MOODS, MOOD_ORDER, moodMeta, weatherMeta } from '../data/constants';
import { dayKey, daysBetween, startOfDay } from './date';
import { wordCount } from './text';

export interface MoodStat {
  key: MoodKey;
  label: string;
  color: string;
  count: number;
  percent: number;
}

export interface TrendPoint {
  date: number;
  label: string;
  score: number | null; // 1~5
  count: number;
}

export interface HeatmapCell {
  date: number;
  key: string;
  count: number;
  words: number;
  level: 0 | 1 | 2 | 3 | 4;
  mood?: MoodKey;
  future?: boolean;
}

export interface TagMoodCorrelation {
  tagId: string;
  count: number;
  avgScore: number;
  positivePercent: number;
  dominantMood: MoodKey;
}

export interface WeatherMoodCorrelation {
  weather: WeatherKey;
  label: string;
  count: number;
  avgScore: number;
  positivePercent: number;
}

export interface TimeSlotStat {
  key: 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';
  label: string;
  range: string;
  count: number;
  percent: number;
}

export interface LengthBucket {
  label: string;
  desc: string;
  count: number;
  percent: number;
}

export interface DiaryStats {
  totalEntries: number;
  totalWords: number;
  avgWords: number;
  totalPhotos: number;
  totalAudios: number;
  totalVideos: number;
  recordDays: number;
  currentStreak: number;
  longestStreak: number;
  weekChecked: boolean[]; // 周一..周日
  moodStats: MoodStat[];
  moodTotal: number;
  moodScore: number; // 0~100 情绪能量指数
  positiveRate: number; // 0~100 正向情绪占比
  dominantMood?: MoodKey;
  trend30: TrendPoint[];
  heatmap84: HeatmapCell[]; // 近 12 周（84 天）
  tagMoods: TagMoodCorrelation[];
  weatherMoods: WeatherMoodCorrelation[];
  timeSlots: TimeSlotStat[];
  writerPersona: { title: string; desc: string };
  lengthBuckets: LengthBucket[];
  placeCounts: { name: string; count: number }[];
  monthlyCounts: { label: string; count: number }[];
  tagCounts: { id: string; count: number }[];
}

const POSITIVE_MOODS = new Set<MoodKey>(['happy', 'calm', 'grateful', 'excited']);

function wordsToLevel(words: number, count: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  if (words >= 280) return 4;
  if (words >= 150) return 3;
  if (words >= 60) return 2;
  return 1;
}

export function computeStats(entries: Entry[], daysFilter?: number, now = Date.now()): DiaryStats {
  const published = entries.filter(e => !e.deletedAt && e.status === 'published');
  const todayStart = startOfDay(now);

  // 所有记录的日期集合（去重）
  const dayMap = new Map<string, Entry[]>();
  for (const e of published) {
    const k = dayKey(e.createdAt);
    const arr = dayMap.get(k) ?? [];
    arr.push(e);
    dayMap.set(k, arr);
  }
  const uniqueDays = Array.from(dayMap.keys()).sort();

  // 当前连续记录天数（如果今天没写但昨天写了，依然计入当前连续）
  let currentStreak = 0;
  let cursor = new Date(todayStart);
  if (!dayMap.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (dayMap.has(dayKey(cursor))) {
    currentStreak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  // 历史最长连续记录天数
  let longestStreak = 0;
  let run = 0;
  let prevDayTs: number | null = null;
  for (const k of uniqueDays) {
    const [y, m, d] = k.split('-').map(Number);
    const ts = new Date(y, m - 1, d).getTime();
    if (prevDayTs !== null && daysBetween(prevDayTs, ts) === 1) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longestStreak) longestStreak = run;
    prevDayTs = ts;
  }

  // 本周打卡情况（周一=0 ~ 周日=6）
  const dNow = new Date(todayStart);
  const dow = (dNow.getDay() + 6) % 7; // 周一为 0
  const weekStart = new Date(dNow);
  weekStart.setDate(dNow.getDate() - dow);
  const weekChecked: boolean[] = [];
  for (let i = 0; i < 7; i++) {
    const c = new Date(weekStart);
    c.setDate(weekStart.getDate() + i);
    weekChecked.push(dayMap.has(dayKey(c)));
  }

  // 范围过滤（近7天 / 近30天 / 全部）
  const scoped = daysFilter
    ? published.filter(e => e.createdAt >= todayStart - (daysFilter - 1) * 86400000)
    : published;

  let totalWords = 0;
  let totalPhotos = 0;
  let totalAudios = 0;
  let totalVideos = 0;
  const tagMap = new Map<string, number>();

  for (const e of published) {
    totalWords += wordCount(e.title) + wordCount(e.body);
    totalPhotos += e.photos.length;
    totalAudios += e.audios.length;
    totalVideos += e.videos.length;
    for (const tid of e.tags) tagMap.set(tid, (tagMap.get(tid) ?? 0) + 1);
  }

  // 心情分布
  const moodCounts = new Map<MoodKey, number>();
  let moodTotal = 0;
  for (const e of scoped) {
    if (e.mood) {
      moodCounts.set(e.mood, (moodCounts.get(e.mood) ?? 0) + 1);
      moodTotal += 1;
    }
  }

  const moodStats: MoodStat[] = MOOD_ORDER.map(key => {
    const meta = MOODS.find(m => m.key === key)!;
    const count = moodCounts.get(key) ?? 0;
    return {
      key,
      label: meta.label,
      color: meta.color,
      count,
      percent: moodTotal > 0 ? Math.round((count / moodTotal) * 100) : 0,
    };
  }).filter(x => x.count > 0);

  // 近30天情绪趋势（每7天或关键点打标签）
  const trend30: TrendPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const dt = new Date(todayStart);
    dt.setDate(dt.getDate() - i);
    const k = dayKey(dt);
    const list = (dayMap.get(k) ?? []).filter(e => e.mood);
    let score: number | null = null;
    if (list.length > 0) {
      const sum = list.reduce((acc, item) => acc + (moodMeta(item.mood)?.score ?? 3), 0);
      score = Math.round((sum / list.length) * 10) / 10;
    }
    trend30.push({
      date: dt.getTime(),
      label: `${dt.getMonth() + 1}/${dt.getDate()}`,
      score,
      count: (dayMap.get(k) ?? []).length,
    });
  }

  // 最近6个月写作文数
  const monthlyCounts: { label: string; count: number }[] = [];
  const cur = new Date(todayStart);
  for (let i = 5; i >= 0; i--) {
    const mDate = new Date(cur.getFullYear(), cur.getMonth() - i, 1);
    const y = mDate.getFullYear();
    const m = mDate.getMonth();
    const count = published.filter(e => {
      const ed = new Date(e.createdAt);
      return ed.getFullYear() === y && ed.getMonth() === m;
    }).length;
    monthlyCounts.push({ label: `${m + 1}月`, count });
  }

  const tagCounts = Array.from(tagMap.entries())
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count);

  // 情绪能量指数 & 正向情绪占比
  let moodScoreSum = 0;
  let positiveCount = 0;
  for (const e of scoped) {
    if (!e.mood) continue;
    moodScoreSum += moodMeta(e.mood)?.score ?? 3;
    if (POSITIVE_MOODS.has(e.mood)) positiveCount += 1;
  }
  const moodScore = moodTotal > 0 ? Math.round((moodScoreSum / (moodTotal * 5)) * 100) : 0;
  const positiveRate = moodTotal > 0 ? Math.round((positiveCount / moodTotal) * 100) : 0;
  const dominantMood = [...moodStats].sort((a, b) => b.count - a.count)[0]?.key;

  // 近 12 周（84 天）对齐周一~周日的热力 & 心情像素矩阵
  const heatmap84: HeatmapCell[] = [];
  const gridStart = new Date(weekStart);
  gridStart.setDate(weekStart.getDate() - 11 * 7);
  for (let i = 0; i < 84; i++) {
    const dt = new Date(gridStart);
    dt.setDate(gridStart.getDate() + i);
    const ts = dt.getTime();
    const k = dayKey(dt);
    const list = dayMap.get(k) ?? [];
    const dayWords = list.reduce((s, e) => s + wordCount(e.title) + wordCount(e.body), 0);
    const dayMood = list.find(e => e.mood)?.mood;
    heatmap84.push({
      date: ts,
      key: k,
      count: list.length,
      words: dayWords,
      level: wordsToLevel(dayWords, list.length),
      mood: dayMood,
      future: ts > todayStart,
    });
  }

  // 标签 × 情绪关联（参考 Daylio 活动相关性）
  const tagMoodAcc = new Map<string, { scores: number[]; pos: number; moods: Map<MoodKey, number> }>();
  for (const e of scoped) {
    if (!e.mood || e.tags.length === 0) continue;
    const sc = moodMeta(e.mood)?.score ?? 3;
    const isPos = POSITIVE_MOODS.has(e.mood) ? 1 : 0;
    for (const tid of e.tags) {
      const box = tagMoodAcc.get(tid) ?? { scores: [] as number[], pos: 0, moods: new Map<MoodKey, number>() };
      box.scores.push(sc);
      box.pos += isPos;
      box.moods.set(e.mood, (box.moods.get(e.mood) ?? 0) + 1);
      tagMoodAcc.set(tid, box);
    }
  }
  const tagMoods: TagMoodCorrelation[] = Array.from(tagMoodAcc.entries())
    .map(([tagId, box]) => {
      const avg = box.scores.reduce((a, b) => a + b, 0) / box.scores.length;
      const dom = Array.from(box.moods.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'calm';
      return {
        tagId,
        count: box.scores.length,
        avgScore: Math.round(avg * 10) / 10,
        positivePercent: Math.round((box.pos / box.scores.length) * 100),
        dominantMood: dom,
      };
    })
    .sort((a, b) => b.avgScore - a.avgScore || b.count - a.count);

  // 天气 × 情绪关联
  const weatherAcc = new Map<WeatherKey, { scores: number[]; pos: number }>();
  for (const e of scoped) {
    if (!e.weather || !e.mood) continue;
    const sc = moodMeta(e.mood)?.score ?? 3;
    const box = weatherAcc.get(e.weather) ?? { scores: [] as number[], pos: 0 };
    box.scores.push(sc);
    box.pos += POSITIVE_MOODS.has(e.mood) ? 1 : 0;
    weatherAcc.set(e.weather, box);
  }
  const weatherMoods: WeatherMoodCorrelation[] = Array.from(weatherAcc.entries())
    .map(([weather, box]) => ({
      weather,
      label: weatherMeta(weather)?.label ?? weather,
      count: box.scores.length,
      avgScore: Math.round((box.scores.reduce((a, b) => a + b, 0) / box.scores.length) * 10) / 10,
      positivePercent: Math.round((box.pos / box.scores.length) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  // 写作时段偏好分布
  const slotMeta: { key: TimeSlotStat['key']; label: string; range: string; match: (h: number) => boolean; persona: string; desc: string }[] = [
    { key: 'dawn', label: '清晨', range: '05–09', match: h => h >= 5 && h < 9, persona: '晨光记录者', desc: '喜欢在安静的清晨梳理想法，开启清爽的一天' },
    { key: 'morning', label: '上午', range: '09–12', match: h => h >= 9 && h < 12, persona: '高效观察家', desc: '习惯在上午保持清醒记录日常与灵感片段' },
    { key: 'afternoon', label: '午后', range: '12–18', match: h => h >= 12 && h < 18, persona: '午后漫步者', desc: '总能在午后慢下来的缝隙里捕捉生活温柔的瞬间' },
    { key: 'evening', label: '夜晚', range: '18–23', match: h => h >= 18 && h < 23, persona: '夜晚沉淀者', desc: '习惯在忙碌结束后安顿思绪，把一天的故事好好收拢' },
    { key: 'night', label: '深夜', range: '23–05', match: h => h >= 23 || h < 5, persona: '深夜思享者', desc: '偏爱在夜深人静时写下最真实、坦诚的内心独白' },
  ];
  const slotCounts = new Map<TimeSlotStat['key'], number>();
  for (const e of published) {
    const h = new Date(e.createdAt).getHours();
    const s = slotMeta.find(x => x.match(h))!;
    slotCounts.set(s.key, (slotCounts.get(s.key) ?? 0) + 1);
  }
  const timeSlots: TimeSlotStat[] = slotMeta.map(s => {
    const cnt = slotCounts.get(s.key) ?? 0;
    return {
      key: s.key,
      label: s.label,
      range: s.range,
      count: cnt,
      percent: published.length ? Math.round((cnt / published.length) * 100) : 0,
    };
  });
  const topSlotKey = [...timeSlots].sort((a, b) => b.count - a.count)[0]?.key;
  const topSlotMeta = slotMeta.find(s => s.key === topSlotKey);
  const writerPersona =
    published.length === 0
      ? { title: '静待落笔', desc: '写下几篇日记后，这里会勾勒出你独特的记录习惯' }
      : { title: topSlotMeta?.persona ?? '生活记录家', desc: topSlotMeta?.desc ?? '坚持用文字安放日常的片刻思考' };

  // 篇幅长度分布
  let shortCnt = 0;
  let midCnt = 0;
  let longCnt = 0;
  for (const e of published) {
    const w = wordCount(e.title) + wordCount(e.body);
    if (w < 80) shortCnt += 1;
    else if (w < 200) midCnt += 1;
    else longCnt += 1;
  }
  const denom = Math.max(1, published.length);
  const lengthBuckets: LengthBucket[] = [
    { label: '短篇随笔', desc: '<80 字', count: shortCnt, percent: published.length ? Math.round((shortCnt / denom) * 100) : 0 },
    { label: '日常记录', desc: '80–200 字', count: midCnt, percent: published.length ? Math.round((midCnt / denom) * 100) : 0 },
    { label: '深度长文', desc: '200+ 字', count: longCnt, percent: published.length ? Math.round((longCnt / denom) * 100) : 0 },
  ];

  // 足迹地点统计
  const placeMap = new Map<string, number>();
  for (const e of published) {
    const n = e.place?.name?.trim();
    if (n) placeMap.set(n, (placeMap.get(n) ?? 0) + 1);
  }
  const placeCounts = Array.from(placeMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalEntries: published.length,
    totalWords,
    avgWords: published.length ? Math.round(totalWords / published.length) : 0,
    totalPhotos,
    totalAudios,
    totalVideos,
    recordDays: uniqueDays.length,
    currentStreak,
    longestStreak,
    weekChecked,
    moodStats,
    moodTotal,
    moodScore,
    positiveRate,
    dominantMood,
    trend30,
    heatmap84,
    tagMoods,
    weatherMoods,
    timeSlots,
    writerPersona,
    lengthBuckets,
    placeCounts,
    monthlyCounts,
    tagCounts,
  };
}

export interface Milestone {
  id: string;
  title: string;
  desc: string;
  achieved: boolean;
  progress?: string;
  date?: number;
}

export function computeMilestones(entries: Entry[], stats: DiaryStats): Milestone[] {
  const published = entries.filter(e => !e.deletedAt && e.status === 'published').sort((a, b) => a.createdAt - b.createdAt);
  const first = published[0];
  return [
    {
      id: 'first',
      title: '写下第一篇日记',
      desc: '开启记录生活与自我对话的旅程',
      achieved: published.length >= 1,
      date: first?.createdAt,
      progress: `${Math.min(published.length, 1)} / 1`,
    },
    {
      id: 'streak7',
      title: '连续记录 7 天',
      desc: '让记录慢慢成为每天的小习惯',
      achieved: stats.longestStreak >= 7,
      progress: `${Math.min(stats.longestStreak, 7)} / 7 天`,
    },
    {
      id: 'entries10',
      title: '完成 10 篇生活记录',
      desc: '把散落的片段串成温暖的时光线',
      achieved: published.length >= 10,
      progress: `${Math.min(published.length, 10)} / 10 篇`,
    },
    {
      id: 'words5k',
      title: '累计写满 2,000 字',
      desc: '每一个认真落笔的文字都算数',
      achieved: stats.totalWords >= 2000,
      progress: `${Math.min(stats.totalWords, 2000)} / 2,000 字`,
    },
    {
      id: 'photos10',
      title: '留住 10 个光影瞬间',
      desc: '用照片和文字一起定格风景',
      achieved: stats.totalPhotos >= 10,
      progress: `${Math.min(stats.totalPhotos, 10)} / 10 张`,
    },
    {
      id: 'streak30',
      title: '连续记录 30 天',
      desc: '一个月不间断的自我陪伴',
      achieved: stats.longestStreak >= 30,
      progress: `${Math.min(stats.longestStreak, 30)} / 30 天`,
    },
  ];
}

/** 回顾 · 那年今日 / 记忆胶囊 */
export type ThrowbackRange = 'all' | 'past-year' | 'earlier';
export function findThrowbacks(entries: Entry[], now = Date.now(), options: { range?: ThrowbackRange; excludedTags?: string[] } = {}): { label: string; entry: Entry }[] {
  const boundary = new Date(now);
  boundary.setFullYear(boundary.getFullYear() - 1);
  const excluded = new Set(options.excludedTags);
  const published = entries.filter(e => !e.deletedAt && !e.hidden && e.status === 'published' && e.createdAt <= now
    && !e.tags.some(id => excluded.has(id))
    && (options.range !== 'past-year' || e.createdAt >= boundary.getTime())
    && (options.range !== 'earlier' || e.createdAt < boundary.getTime()));
  const d = new Date(now);
  const results: { label: string; entry: Entry }[] = [];
  const used = new Set<string>();

  for (const e of published) {
    if (results.length >= 4) break;
    const ed = new Date(e.createdAt);
    const diffDays = daysBetween(e.createdAt, now);
    if (ed.getFullYear() < d.getFullYear() && ed.getMonth() === d.getMonth() && ed.getDate() === d.getDate()) {
      results.push({ label: `${d.getFullYear() - ed.getFullYear()} 年前的今天`, entry: e });
      used.add(e.id);
    } else if (diffDays >= 28 && diffDays <= 33 && results.length < 4 && !used.has(e.id)) {
      results.push({ label: '大约一个月前', entry: e });
      used.add(e.id);
    }
  }
  // 补充更早的记忆作为记忆胶囊
  const older = published.filter(e => !used.has(e.id) && daysBetween(e.createdAt, now) >= 14);
  for (const e of older.slice(0, Math.max(0, 3 - results.length))) {
    results.push({ label: `${daysBetween(e.createdAt, now)} 天前的瞬间`, entry: e });
  }
  return results;
}

/* ---------------- 本月心情罐：豆子的确定性堆叠 ---------------- */

export interface BeanLayout {
  id: string;
  x: number;
  y: number;
  rotate: number;
  w: number;
  h: number;
}

function beanHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * 把 N 颗心情豆从罐底向上堆：每行尽量塞满，奇数行错开半颗，
 * 抖动/旋转由条目 id 决定（同一篇日记位置永远一致）。
 * 豆子放不下时整体缩小，保证全部留在罐内。
 */
export function layoutBeans(ids: string[], jarW: number, jarH: number, beanW = 26, beanH = 17): BeanLayout[] {
  const pad = 3;
  const gap = 2;
  let w = beanW;
  let h = beanH;
  const colsAt = (bw: number) => Math.max(1, Math.floor((jarW - pad * 2 + gap) / (bw + gap)));
  const rowsAt = (bh: number) => Math.max(1, Math.floor((jarH - pad * 2 + gap) / (bh + gap)));
  // 放不下就按 90% 缩小，直到容下或到最小尺寸
  while (w > 7 && colsAt(w) * rowsAt(h) < ids.length) {
    w *= 0.9;
    h *= 0.9;
  }
  const cols = colsAt(w);
  return ids.map((id, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const hash = beanHash(id);
    const jx = ((hash % 5) - 2); // ±2px
    const jy = (((hash >> 2) % 5) - 2);
    const rowShift = row % 2 === 1 ? (w + gap) / 2 : 0;
    const x = pad + col * (w + gap) + rowShift + jx;
    const y = jarH - pad - h - row * (h + gap) + jy;
    return {
      id,
      x: Math.min(Math.max(x, pad), jarW - pad - w),
      y: Math.min(Math.max(y, pad), jarH - pad - h),
      rotate: ((hash >> 4) % 50) - 25,
      w,
      h,
    };
  });
}
