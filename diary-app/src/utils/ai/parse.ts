import type { Entry, MoodKey, Person, RelationKey, Tag } from '../../store/types';
import { MOODS, RELATIONS } from '../../data/constants';
import { personNames } from '../people';
import { plainText } from '../text';

/**
 * 模型返回的内容一律当作「不可信的文字」处理：
 * 这里负责从中取出需要的部分，并丢掉不合规、对不上原文的内容。
 */

/** 从一段文字里取出第一个 JSON 对象（容忍代码块包裹和前后多余的话） */
export function extractJson(text: string): unknown | null {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

const asString = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function stripWrapping(s: string): string {
  return s
    .trim()
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim()
    .replace(/^[“"「『]+|[”"」』]+$/g, '')
    .trim();
}

/* ---------------- 追问 ---------------- */

export function parseQuestions(raw: string, max = 3): string[] {
  const json = extractJson(raw) as { questions?: unknown } | null;
  let list = asList(json?.questions).map(asString).filter(Boolean);
  if (!list.length) {
    // 没按 JSON 给：按行取
    list = raw
      .split(/\n+/)
      .map(l => l.replace(/^\s*(?:[-*•·]|\d+[.、)）])\s*/, '').trim())
      .filter(l => /[?？]$/.test(l));
  }
  const out: string[] = [];
  for (const item of list) {
    let q = stripWrapping(item).replace(/\s+/g, ' ');
    q = q.replace(/[?]$/, '？');
    if (!/？$/.test(q)) q = `${q.replace(/[。.!！]+$/, '')}？`;
    if (q.length < 5 || q.length > 60) continue;
    if (out.includes(q)) continue;
    out.push(q);
    if (out.length >= max) break;
  }
  return out;
}

/* ---------------- 整理 ---------------- */

export interface OrganizeResult {
  titles: string[];
  mood?: MoodKey;
  tagIds: string[];
  /** 原文提到、且已经在身边人里的人 */
  peopleIds: string[];
  /** 原文提到、但还没记录的人 */
  newPeople: { name: string; relation: RelationKey }[];
}

export function parseOrganize(raw: string, ctx: { tags: Tag[]; people: Person[]; body: string }): OrganizeResult | null {
  const json = extractJson(raw) as Record<string, unknown> | null;
  if (!json || typeof json !== 'object') return null;

  const titles: string[] = [];
  for (const v of asList(json.titles)) {
    const title = stripWrapping(asString(v)).replace(/^《|》$/g, '').replace(/[。.，,；;：:！!？?、]+$/, '').replace(/\s+/g, ' ');
    if (!title || title.length > 20 || titles.includes(title)) continue;
    titles.push(title);
    if (titles.length >= 3) break;
  }

  const moodRaw = asString(json.mood).toLowerCase();
  const mood = MOODS.find(m => m.key === moodRaw || m.label === asString(json.mood))?.key;

  const tagIds: string[] = [];
  for (const v of asList(json.tags)) {
    const name = asString(v).replace(/^#/, '');
    const tag = ctx.tags.find(t => t.name === name || t.id === name);
    if (tag && !tagIds.includes(tag.id)) tagIds.push(tag.id);
    if (tagIds.length >= 3) break;
  }

  // 人名必须在原文里真的出现过：防止模型凭空造人
  const body = plainText(ctx.body);
  const peopleIds: string[] = [];
  const newPeople: { name: string; relation: RelationKey }[] = [];
  for (const v of asList(json.people)) {
    const item = (v && typeof v === 'object' ? v : { name: v }) as { name?: unknown; relation?: unknown };
    const name = asString(item.name).slice(0, 12);
    if (!name) continue;
    const existing = ctx.people.find(p => personNames(p).includes(name));
    if (existing) {
      if (personNames(existing).some(n => body.includes(n)) && !peopleIds.includes(existing.id)) peopleIds.push(existing.id);
      continue;
    }
    if (!body.includes(name) || newPeople.some(p => p.name === name)) continue;
    const relation = RELATIONS.find(r => r.key === asString(item.relation) || r.label === asString(item.relation))?.key ?? 'other';
    newPeople.push({ name, relation });
  }

  const result: OrganizeResult = { titles, mood, tagIds, peopleIds: peopleIds.slice(0, 5), newPeople: newPeople.slice(0, 5) };
  const empty = !titles.length && !mood && !tagIds.length && !result.peopleIds.length && !result.newPeople.length;
  return empty ? null : result;
}

/* ---------------- 理顺口述 ---------------- */

/**
 * 判断「理顺后的正文」能不能用。
 * 只做整理不该让篇幅大变：变短太多说明被删改了，变长太多说明被添了内容，两种都拒收。
 */
export function acceptTidied(original: string, tidied: string): string | null {
  const next = stripWrapping(tidied);
  const before = original.replace(/\s+/g, '').length;
  const after = next.replace(/\s+/g, '').length;
  if (!next || !before) return null;
  const ratio = after / before;
  if (ratio < 0.55 || ratio > 1.3) return null;
  if (next.trim() === original.trim()) return null;
  return next;
}

/* ---------------- 回信 ---------------- */

export function parseReply(raw: string): string | null {
  const text = stripWrapping(raw)
    .replace(/\n{2,}/g, '\n')
    .trim();
  if (text.length < 8) return null;
  return text.length > 400 ? `${text.slice(0, 399)}…` : text;
}

/* ---------------- 周 / 月回顾 ---------------- */

export interface ReviewResult {
  summary: string;
  themes: string[];
  moodLine: string;
  quote?: { text: string; entryId: string };
  question: string;
}

const squash = (s: string) => s.replace(/\s+/g, '');

export function parseReview(raw: string, entries: Pick<Entry, 'id' | 'body' | 'title'>[]): ReviewResult | null {
  const json = extractJson(raw) as Record<string, unknown> | null;
  if (!json || typeof json !== 'object') return null;
  const summary = stripWrapping(asString(json.summary));
  if (summary.length < 10) return null;

  const themes: string[] = [];
  for (const v of asList(json.themes)) {
    const theme = stripWrapping(asString(v)).replace(/[。.，,；;]+$/, '');
    if (theme && theme.length <= 14 && !themes.includes(theme)) themes.push(theme);
    if (themes.length >= 4) break;
  }

  // 摘句必须能在某篇日记的原文里原样找到，否则宁可不要
  let quote: ReviewResult['quote'];
  const quoteText = stripWrapping(asString(json.quote));
  if (quoteText.length >= 4) {
    const needle = squash(quoteText).replace(/[。.！!？?…]+$/, '');
    const hit = entries.find(e => squash(plainText(e.body)).includes(needle) || squash(e.title).includes(needle));
    if (hit && needle) quote = { text: quoteText, entryId: hit.id };
  }

  let question = stripWrapping(asString(json.question));
  if (question && !/[?？]$/.test(question)) question = `${question.replace(/[。.!！]+$/, '')}？`;

  return {
    summary: summary.slice(0, 320),
    themes,
    moodLine: stripWrapping(asString(json.moodLine)).slice(0, 80),
    quote,
    question: question.slice(0, 60),
  };
}
