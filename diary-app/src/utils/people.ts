import type { Entry, MoodKey, Person, RelationKey } from '../store/types';
import { RELATIONS } from '../data/constants';
import { daysBetween } from './date';
import { plainText } from './text';

/** 一个人在日记里可能出现的所有叫法，长的在前（先匹配「老妈」再匹配「妈」） */
export function personNames(p: Pick<Person, 'name' | 'aliases'>): string[] {
  return Array.from(new Set([p.name, ...p.aliases].map(n => n.trim()).filter(Boolean))).sort((a, b) => b.length - a.length);
}

/**
 * 在一段文字里找出提到的身边人，按第一次出现的位置排序。
 * 全程在本机完成，不需要联网。
 */
export function matchPeopleInText(text: string, people: Person[]): string[] {
  const body = plainText(text || '');
  if (!body || !people.length) return [];
  const hits: { id: string; at: number }[] = [];
  for (const p of people) {
    let first = -1;
    for (const name of personNames(p)) {
      const at = body.indexOf(name);
      if (at !== -1 && (first === -1 || at < first)) first = at;
    }
    if (first !== -1) hits.push({ id: p.id, at: first });
  }
  return hits.sort((a, b) => a.at - b.at).map(h => h.id);
}

/** 常见的称呼：文中出现、但还没建档时，提示「要不要记下这个人」 */
const KINSHIP: { name: string; words: string[]; relation: RelationKey }[] = [
  { name: '妈妈', words: ['妈妈', '老妈', '母亲', '我妈'], relation: 'family' },
  { name: '爸爸', words: ['爸爸', '老爸', '父亲', '我爸'], relation: 'family' },
  { name: '奶奶', words: ['奶奶'], relation: 'family' },
  { name: '爷爷', words: ['爷爷'], relation: 'family' },
  { name: '外婆', words: ['外婆', '姥姥'], relation: 'family' },
  { name: '外公', words: ['外公', '姥爷'], relation: 'family' },
  { name: '姐姐', words: ['姐姐', '我姐'], relation: 'family' },
  { name: '哥哥', words: ['哥哥', '我哥'], relation: 'family' },
  { name: '弟弟', words: ['弟弟', '我弟'], relation: 'family' },
  { name: '妹妹', words: ['妹妹', '我妹'], relation: 'family' },
  { name: '儿子', words: ['儿子'], relation: 'family' },
  { name: '女儿', words: ['女儿', '闺女'], relation: 'family' },
  { name: '老公', words: ['老公', '丈夫'], relation: 'partner' },
  { name: '老婆', words: ['老婆', '妻子'], relation: 'partner' },
  { name: '男朋友', words: ['男朋友', '男友'], relation: 'partner' },
  { name: '女朋友', words: ['女朋友', '女友'], relation: 'partner' },
  { name: '闺蜜', words: ['闺蜜'], relation: 'friend' },
  { name: '室友', words: ['室友', '舍友'], relation: 'friend' },
  { name: '老板', words: ['老板', '领导'], relation: 'colleague' },
];

/** 文中出现了常见称呼、而身边人里还没有对应的人：给出新建建议（纯本机） */
export function detectNewPeople(text: string, people: Person[]): { name: string; relation: RelationKey }[] {
  const body = plainText(text || '');
  if (!body) return [];
  const known = new Set(people.flatMap(p => personNames(p)));
  const out: { name: string; relation: RelationKey; at: number }[] = [];
  for (const k of KINSHIP) {
    if (k.words.some(w => known.has(w)) || known.has(k.name)) continue;
    let first = -1;
    for (const w of k.words) {
      const at = body.indexOf(w);
      if (at !== -1 && (first === -1 || at < first)) first = at;
    }
    if (first !== -1) out.push({ name: k.name, relation: k.relation, at: first });
  }
  return out.sort((a, b) => a.at - b.at).map(({ name, relation }) => ({ name, relation }));
}

/** 能出现在「身边人」页面里的日记：已发布、没删除、没隐藏 */
export function visibleEntries(entries: Entry[]): Entry[] {
  return entries.filter(e => !e.deletedAt && !e.hidden && e.status === 'published');
}

export function entriesWithPerson(entries: Entry[], personId: string): Entry[] {
  return visibleEntries(entries)
    .filter(e => e.people.includes(personId))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export interface PersonSummary {
  person: Person;
  count: number;
  firstAt?: number;
  lastAt?: number;
  /** 距离上一次写到 TA 过去了多少天 */
  daysSince?: number;
  /** 和 TA 有关的日记里出现最多的心情 */
  topMood?: MoodKey;
}

export function summarizePerson(entries: Entry[], person: Person, now = Date.now()): PersonSummary {
  const list = entriesWithPerson(entries, person.id);
  if (!list.length) return { person, count: 0 };
  const moods = new Map<MoodKey, number>();
  for (const e of list) if (e.mood) moods.set(e.mood, (moods.get(e.mood) ?? 0) + 1);
  const topMood = Array.from(moods.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  const lastAt = list[0].createdAt;
  return {
    person,
    count: list.length,
    firstAt: list[list.length - 1].createdAt,
    lastAt,
    daysSince: Math.max(0, daysBetween(lastAt, now)),
    topMood,
  };
}

export function summarizePeople(entries: Entry[], people: Person[], now = Date.now()): PersonSummary[] {
  return people.map(p => summarizePerson(entries, p, now));
}

/** 按关系分组；组内写得多的在前，其次按最近出现 */
export function groupPeopleByRelation(list: PersonSummary[]): { relation: RelationKey; label: string; list: PersonSummary[] }[] {
  return RELATIONS.map(r => ({
    relation: r.key,
    label: r.label,
    list: list
      .filter(s => s.person.relation === r.key)
      .sort((a, b) => b.count - a.count || (b.lastAt ?? 0) - (a.lastAt ?? 0) || a.person.createdAt - b.person.createdAt),
  })).filter(g => g.list.length > 0);
}

/** 生日写成 MM-DD；不合法返回 null */
export function normalizeBirthday(input: string): string | null {
  const m = /^\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?\s*$/.exec(input);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1) return null;
  const max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (day > max) return null;
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 距离下一次生日还有几天（今天生日返回 0）；没有生日返回 null */
export function daysUntilBirthday(birthday: string | undefined, now = Date.now()): number | null {
  if (!birthday || !/^\d{2}-\d{2}$/.test(birthday)) return null;
  const [month, day] = birthday.split('-').map(Number);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const pick = (year: number) => {
    // 2 月 29 日生日在平年按 2 月 28 日算
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const d = month === 2 && day === 29 && !leap ? 28 : day;
    return new Date(year, month - 1, d).getTime();
  };
  let target = pick(today.getFullYear());
  if (target < today.getTime()) target = pick(today.getFullYear() + 1);
  return Math.round((target - today.getTime()) / 86400000);
}
