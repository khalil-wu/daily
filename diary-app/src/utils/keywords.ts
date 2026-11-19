import { plainText } from './text';

export interface KeywordCount {
  word: string;
  count: number;
}

const STOPWORDS = new Set([
  '的', '了', '是', '我', '在', '和', '也', '就', '都', '而', '及', '与', '着', '或',
  '一个', '没有', '我们', '你们', '他们', '她们', '它们', '自己', '这个', '那个',
  '这些', '那些', '今天', '昨天', '明天', '上午', '下午', '晚上', '早上', '中午',
  '但是', '因为', '所以', '如果', '虽然', '还是', '可以', '已经', '觉得', '感觉',
  '时候', '东西', '什么', '怎么', '怎样', '这样', '那样', '非常', '比较', '真的',
  '其实', '然后', '不过', '只是', '一直', '一下', '一些', '一点', '很多', '开始',
  '之后', '之前', '现在', '当时', '还有', '或者', '以及', '而且', '为了', '关于',
  '对于', '通过', '进行', '成为', '应该', '需要', '可能', '知道', '看到', '听到',
  '想到', '出来', '起来', '下去', '回来', '过来', '过去', '这里', '那里', '哪里',
  '为什么', '怎么样', '一样', '一起', '一定', '总是', '常常', '每天', '最近', '突然',
  '好像', '似乎', '大家', '别人', '最后', '终于', '本来', '原来', '于是', '接着',
  '继续', '慢慢', '渐渐', '有点', '有些', '特别', '实在', '完全', '几乎', '大概',
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'are', 'was', 'were',
]);

function isPureDigits(w: string) {
  return /^\d+$/.test(w);
}

/**
 * 提取多篇日记的高频关键词（纯函数）。
 * 优先使用 Intl.Segmenter('zh', { granularity: 'word' })，不可用或禁用时回退为中文二元组 + 英文词统计。
 */
export function extractKeywords(
  texts: string[],
  topN = 30,
  opts?: { disableSegmenter?: boolean },
): KeywordCount[] {
  if (!texts.length || topN <= 0) return [];

  const counts = new Map<string, number>();
  const addWord = (raw: string) => {
    const w = raw.trim().toLowerCase();
    if (w.length < 2) return;
    if (isPureDigits(w)) return;
    if (STOPWORDS.has(w)) return;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  };

  const canSegment =
    !opts?.disableSegmenter &&
    typeof Intl !== 'undefined' &&
    typeof (Intl as any).Segmenter === 'function';

  if (canSegment) {
    const segmenter = new (Intl as any).Segmenter('zh', { granularity: 'word' });
    for (const rawText of texts) {
      if (!rawText) continue;
      const clean = plainText(rawText);
      for (const seg of segmenter.segment(clean)) {
        if (!seg.isWordLike) continue;
        const w = String(seg.segment).trim();
        if (!w || w.length < 2) continue;
        if (/^[A-Za-z]+$/.test(w) && w.length < 3) continue;
        addWord(w);
      }
    }
  } else {
    for (const rawText of texts) {
      if (!rawText) continue;
      const clean = plainText(rawText);
      const cjkRuns = clean.match(/[\u4e00-\u9fa5]{2,}/g);
      if (cjkRuns) {
        for (const run of cjkRuns) {
          for (let i = 0; i < run.length - 1; i++) {
            addWord(run.slice(i, i + 2));
          }
        }
      }
      const enWords = clean.match(/[A-Za-z]{3,}/g);
      if (enWords) {
        for (const ew of enWords) addWord(ew);
      }
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([word, count]) => ({ word, count }));
}
