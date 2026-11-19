import type { Entry, MoodKey } from '../store/types';
import { MOODS, MOOD_ORDER, moodMeta } from '../data/constants';
import { daysInMonth, pad2 } from './date';
import { wordCount } from './text';
import { extractKeywords, type KeywordCount } from './keywords';
import type { MoodStat } from './stats';

export interface YearPixel {
  dateKey: string;
  month: number; // 1 ~ 12
  day: number; // 1 ~ 31
  count: number;
  mood?: MoodKey;
  words: number;
}

export interface AnnualReport {
  year: number;
  totalEntries: number;
  totalWords: number;
  recordDays: number;
  longestStreak: number;
  busiestMonth: { month: number; count: number } | null;
  monthlyCounts: { label: string; count: number }[];
  moodStats: MoodStat[];
  dominantMood?: MoodKey;
  avgMoodScore: number;
  topTags: { id: string; count: number }[];
  topPlaces: { name: string; count: number }[];
  totalPhotos: number;
  totalVideos: number;
  firstEntry?: Entry;
  longestEntry?: Entry;
  latestNightEntry?: Entry;
  pixels: YearPixel[];
  keywords: KeywordCount[];
  writerPersona: { title: string; desc: string };
}

const PERSONAS = [
  { title: '晨间记录者', desc: '喜欢在清晨醒来后记录灵感，用文字开启温柔的一天' },
  { title: '上午思考者', desc: '擅长在精力充沛的上午梳理思绪与生活脉络' },
  { title: '午后漫游者', desc: '偏爱在午后停歇片刻，收藏日光与当下的心情' },
  { title: '夜晚沉淀者', desc: '习惯在忙碌结束后安顿思绪，把一天的故事好好收拢' },
  { title: '深夜独白者', desc: '在万籁俱寂的夜色里与自己对话，写下最真诚的剖白' },
];

function slotIndexOfHour(h: number): number {
  if (h >= 5 && h < 9) return 0;
  if (h >= 9 && h < 12) return 1;
  if (h >= 12 && h < 18) return 2;
  if (h >= 18 && h < 23) return 3;
  return 4;
}

/** 获取所有包含已发布日记的年份（降序） */
export function getAvailableYears(entries: Entry[]): number[] {
  const set = new Set<number>();
  for (const e of entries) {
    if (e.deletedAt || e.hidden || e.status !== 'published') continue;
    set.add(new Date(e.createdAt).getFullYear());
  }
  return Array.from(set).sort((a, b) => b - a);
}

/** 生成指定年份的完整年度报告数据（单遍聚合，适配数千篇大数据量） */
export function computeAnnualReport(entries: Entry[], year: number): AnnualReport {
  const monthCounts = new Array<number>(12).fill(0);
  const slotCounts = new Array<number>(5).fill(0);
  const moodCounts = new Map<MoodKey, number>();
  const tagMap = new Map<string, number>();
  const placeMap = new Map<string, number>();
  const dayAgg = new Map<string, { count: number; words: number; moodFreq: Map<MoodKey, number> }>();

  let totalEntries = 0;
  let totalWords = 0;
  let totalPhotos = 0;
  let totalVideos = 0;
  let moodTotal = 0;
  let moodScoreSum = 0;

  let firstEntry: Entry | undefined;
  let longestEntry: Entry | undefined;
  let longestWords = -1;
  let latestNightEntry: Entry | undefined;
  let latestNightScore = -1;

  const texts: string[] = [];

  for (const e of entries) {
    if (e.deletedAt || e.hidden || e.status !== 'published') continue;
    const d = new Date(e.createdAt);
    if (d.getFullYear() !== year) continue;

    totalEntries += 1;
    const m = d.getMonth();
    const day = d.getDate();
    monthCounts[m] += 1;

    const w = wordCount(e.title) + wordCount(e.body);
    totalWords += w;
    totalPhotos += e.photos.length;
    totalVideos += e.videos.length;
    texts.push(`${e.title} ${e.body}`);

    if (!firstEntry || e.createdAt < firstEntry.createdAt) {
      firstEntry = e;
    }
    if (w > longestWords) {
      longestWords = w;
      longestEntry = e;
    }

    const hour = d.getHours();
    const minute = d.getMinutes();
    slotCounts[slotIndexOfHour(hour)] += 1;

    const nightMinute = (hour < 5 ? hour + 24 : hour) * 60 + minute;
    if (nightMinute > latestNightScore) {
      latestNightScore = nightMinute;
      latestNightEntry = e;
    }

    if (e.mood) {
      moodCounts.set(e.mood, (moodCounts.get(e.mood) ?? 0) + 1);
      moodTotal += 1;
      moodScoreSum += moodMeta(e.mood)?.score ?? 3;
    }

    for (const tid of e.tags) {
      tagMap.set(tid, (tagMap.get(tid) ?? 0) + 1);
    }

    const placeName = e.place?.name?.trim();
    if (placeName) {
      placeMap.set(placeName, (placeMap.get(placeName) ?? 0) + 1);
    }

    const dk = `${year}-${pad2(m + 1)}-${pad2(day)}`;
    let bucket = dayAgg.get(dk);
    if (!bucket) {
      bucket = { count: 0, words: 0, moodFreq: new Map() };
      dayAgg.set(dk, bucket);
    }
    bucket.count += 1;
    bucket.words += w;
    if (e.mood) {
      bucket.moodFreq.set(e.mood, (bucket.moodFreq.get(e.mood) ?? 0) + 1);
    }
  }

  const pixels: YearPixel[] = [];
  let longestStreak = 0;
  let currentRun = 0;
  let recordDays = 0;

  for (let m = 0; m < 12; m++) {
    const totalDays = daysInMonth(year, m);
    for (let day = 1; day <= totalDays; day++) {
      const dateKey = `${year}-${pad2(m + 1)}-${pad2(day)}`;
      const agg = dayAgg.get(dateKey);
      if (agg && agg.count > 0) {
        recordDays += 1;
        currentRun += 1;
        if (currentRun > longestStreak) longestStreak = currentRun;

        let domMood: MoodKey | undefined;
        let maxF = 0;
        agg.moodFreq.forEach((f, mk) => {
          if (f > maxF) {
            maxF = f;
            domMood = mk;
          }
        });
        pixels.push({ dateKey, month: m + 1, day, count: agg.count, mood: domMood, words: agg.words });
      } else {
        currentRun = 0;
        pixels.push({ dateKey, month: m + 1, day, count: 0, words: 0 });
      }
    }
  }

  let busiestMonth: { month: number; count: number } | null = null;
  for (let m = 0; m < 12; m++) {
    if (monthCounts[m] > 0 && (!busiestMonth || monthCounts[m] > busiestMonth.count)) {
      busiestMonth = { month: m + 1, count: monthCounts[m] };
    }
  }

  const monthlyCounts = monthCounts.map((count, idx) => ({
    label: `${idx + 1}`,
    count,
  }));

  const moodStats: MoodStat[] = MOOD_ORDER.map(key => {
    const meta = MOODS.find(x => x.key === key)!;
    const count = moodCounts.get(key) ?? 0;
    return {
      key,
      label: meta.label,
      color: meta.color,
      count,
      percent: moodTotal > 0 ? Math.round((count / moodTotal) * 100) : 0,
    };
  }).filter(x => x.count > 0);

  let dominantMood: MoodKey | undefined;
  let maxMoodCnt = 0;
  for (const ms of moodStats) {
    if (ms.count > maxMoodCnt) {
      maxMoodCnt = ms.count;
      dominantMood = ms.key;
    }
  }

  const avgMoodScore = moodTotal > 0 ? Math.round((moodScoreSum / moodTotal) * 10) / 10 : 0;

  const topTags = Array.from(tagMap.entries())
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const topPlaces = Array.from(placeMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  let topSlotIdx = 3;
  let maxSlotCnt = 0;
  for (let i = 0; i < slotCounts.length; i++) {
    if (slotCounts[i] > maxSlotCnt) {
      maxSlotCnt = slotCounts[i];
      topSlotIdx = i;
    }
  }
  const writerPersona =
    totalEntries === 0
      ? { title: '静待落笔', desc: '写下今年的第一篇日记，开启属于你的时光年鉴' }
      : PERSONAS[topSlotIdx];

  const keywords = extractKeywords(texts, 30);

  return {
    year,
    totalEntries,
    totalWords,
    recordDays,
    longestStreak,
    busiestMonth,
    monthlyCounts,
    moodStats,
    dominantMood,
    avgMoodScore,
    topTags,
    topPlaces,
    totalPhotos,
    totalVideos,
    firstEntry,
    longestEntry,
    latestNightEntry,
    pixels,
    keywords,
    writerPersona,
  };
}
