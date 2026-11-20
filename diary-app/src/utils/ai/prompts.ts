import type { Entry, Person, Tag } from '../../store/types';
import { MOODS, moodMeta, relationLabel } from '../../data/constants';
import { WEEK_CN, pad2 } from '../date';
import { plainText } from '../text';
import type { ChatMessage } from './client';
import { clipText } from './privacy';
import { HOTLINE } from './safety';

/**
 * 「记得」的提示词。
 * 原则写在最前面，所有任务共用：日记是用户自己的，AI 只追问、整理、回应，不代写。
 */
export const PERSONA = [
  '你是「记得」，日记应用「记得日记」里的写作陪伴者。',
  '你的原则：',
  '1. 日记是用户自己的。你不替他写，也不改写他的话。',
  '2. 只依据用户给你的内容。不编造事实、人名、时间或细节；没有依据就不说。',
  '3. 语气像一位认真读过这篇日记的朋友：具体、克制、平视。不说教，不灌鸡汤，不夸大，不做心理诊断，不用「加油」「相信你」这类空话。',
  '4. 使用简体中文，称呼对方为「你」。不使用表情符号和感叹号。',
].join('\n');

export interface EntryContext {
  tags: Tag[];
  people: Person[];
}

function fmtWhen(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${WEEK_CN[d.getDay()]} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmtDay(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 把一篇日记写成给模型看的文字。只包含文字信息：不含照片、视频、录音和地点坐标 */
export function describeEntry(entry: Pick<Entry, 'title' | 'body' | 'createdAt' | 'mood' | 'tags' | 'people'>, ctx: EntryContext, maxBody?: number): string {
  const mood = moodMeta(entry.mood);
  const tagNames = entry.tags.map(id => ctx.tags.find(t => t.id === id)?.name).filter(Boolean);
  const people = entry.people
    .map(id => ctx.people.find(p => p.id === id))
    .filter((p): p is Person => !!p)
    .map(p => `${p.name}（${relationLabel(p.relation)}）`);
  const lines = [`时间：${fmtWhen(entry.createdAt)}`];
  if (mood) lines.push(`心情：${mood.label}`);
  if (tagNames.length) lines.push(`标签：${tagNames.join('、')}`);
  if (people.length) lines.push(`身边人：${people.join('、')}`);
  if (entry.title.trim()) lines.push(`标题：${entry.title.trim()}`);
  const body = clipText(plainText(entry.body), maxBody);
  lines.push('正文：', body || '（还没有写正文）');
  return lines.join('\n');
}

/* ---------------- 追问 ---------------- */

export function buildFollowUpMessages(entry: Pick<Entry, 'title' | 'body' | 'createdAt' | 'mood' | 'tags' | 'people'>, ctx: EntryContext, avoid: string[] = []): ChatMessage[] {
  const hasBody = !!plainText(entry.body).trim() || !!entry.title.trim();
  const task = hasBody
    ? [
        '任务：读完下面这篇还没写完的日记，提出 3 个能帮他继续往下写的问题。',
        '要求：',
        '- 每个问题都贴着原文里的一个具体细节（一个人、一句话、一个动作、一个场景）。',
        '- 一个问题只问一件事，不超过 30 个字。',
        '- 三个问题的方向要不同：一个问当时的感受，一个问没写出来的细节或画面，一个问这件事对他意味着什么。',
        '- 不问原文已经回答过的事，不给建议，不评价对错。',
      ]
    : [
        '任务：用户打开了一页空白的日记，还不知道写什么。结合时间和心情，提出 3 个容易下笔的问题。',
        '要求：',
        '- 具体、好回答，不要宏大的问题。一个问题不超过 30 个字。',
        '- 三个问题的方向要不同：今天发生的一件小事、此刻的感受、最近一直在想的事。',
      ];
  if (avoid.length) task.push(`- 不要和这些问题重复：${avoid.join('；')}`);
  task.push('只输出 JSON，不要任何其他文字：{"questions":["问题一","问题二","问题三"]}');
  return [
    { role: 'system', content: `${PERSONA}\n\n${task.join('\n')}` },
    { role: 'user', content: describeEntry(entry, ctx) },
  ];
}

/* ---------------- 整理（标题 / 心情 / 标签 / 身边人） ---------------- */

export function buildOrganizeMessages(entry: Pick<Entry, 'title' | 'body' | 'createdAt' | 'mood' | 'tags' | 'people'>, ctx: EntryContext): ChatMessage[] {
  const moodList = MOODS.map(m => `${m.key}（${m.label}）`).join('、');
  const tagList = ctx.tags.map(t => t.name).join('、');
  const known = ctx.people.map(p => `${p.name}（${relationLabel(p.relation)}）`).join('、');
  const task = [
    '任务：为下面这篇日记提出整理建议，用户会自己决定用不用。',
    '输出一个 JSON 对象，字段如下：',
    '- titles：3 个标题。每个不超过 12 个字，用原文里的词，朴素具体，不用书名号和标点结尾。',
    `- mood：整篇日记最主要的心情，只能是这几个值之一：${moodList}。拿不准就给 null。`,
    `- tags：最多 3 个标签，只能从这些里选：${tagList}。都不合适就给空数组。`,
    '- people：原文里出现的、和用户有关系的具体的人，最多 5 个。每项为 {"name":"原文里的称呼","relation":"family|partner|friend|colleague|other"}。',
    '  name 必须是原文里出现过的字；泛指的人群（同学们、大家、同事们）和用户自己不算。',
    known ? `  用户已经记录的身边人：${known}。原文提到他们时，name 用这里的名字。` : '',
    '只输出 JSON，不要任何其他文字。',
  ].filter(Boolean);
  return [
    { role: 'system', content: `${PERSONA}\n\n${task.join('\n')}` },
    { role: 'user', content: describeEntry({ ...entry, mood: undefined, tags: [], people: [] }, ctx) },
  ];
}

/* ---------------- 理顺口述 ---------------- */

export function buildTidyMessages(body: string): ChatMessage[] {
  const task = [
    '任务：下面是用户口述或随手记下的日记正文。把它理顺，方便以后阅读。',
    '只允许做这些事：补标点、分段、去掉口头语（嗯、然后、那个、就是说）和明显的重复、改正错别字。',
    '必须遵守：',
    '- 保留用户原来的用词、语气和每一件事，不添加原文没有的内容、感受或修辞，不总结，不删减事实。',
    '- 保留原有的排版标记，原样放在行首：# 、- 、1. 、> 、- [ ] 、- [x] ，以及 **粗体**、*斜体*、__下划线__。',
    '只输出整理后的正文，不要解释，不要加引号或代码块。',
  ];
  return [
    { role: 'system', content: `${PERSONA}\n\n${task.join('\n')}` },
    { role: 'user', content: clipText(body) },
  ];
}

/* ---------------- 回信 ---------------- */

export interface MemorySnippet {
  at: number;
  title: string;
  excerpt: string;
}

export function buildReplyMessages(
  entry: Pick<Entry, 'title' | 'body' | 'createdAt' | 'mood' | 'tags' | 'people'>,
  ctx: EntryContext,
  opts: { memories?: MemorySnippet[]; crisis?: boolean } = {},
): ChatMessage[] {
  const task = [
    '任务：用户刚写完下面这篇日记。给他回一封很短的信。',
    '要求：',
    '- 2 到 4 句话，总共 60 到 140 个字，写成一段，不分点，不加称呼和落款。',
    '- 第一句回应原文里的一个具体细节，让他知道这篇日记被认真读过。不要复述全文。',
    '- 可以说出你读到的感受，但不要替他下结论，不要给建议清单。',
    '- 结尾可以留一个很轻的问题，也可以不问。',
  ];
  if (opts.memories?.length) {
    task.push(
      '- 下面附了他以前写过的几段日记。如果其中有和今天直接相关的事，可以自然地提一句，并说清是哪一天写的；没有关联就完全不要提，更不要编造。',
    );
  }
  if (opts.crisis) {
    task.push(
      `- 这篇日记里有伤害自己或不想活下去的表达。请认真、平静地回应：先表达你在意他此刻的感受，不评判、不说教、不轻描淡写；然后建议他现在就联系一位信任的人，并告诉他可以拨打 ${HOTLINE.number}（${HOTLINE.name}）。不要做诊断，不要讨论方法，不要用问题结尾。这种情况下字数可以到 180 字。`,
    );
  }
  const parts = [`【今天的日记】\n${describeEntry(entry, ctx)}`];
  if (opts.memories?.length) {
    parts.push(
      `【他以前写过的】\n${opts.memories.map(m => `- ${fmtDay(m.at)}${m.title ? `《${m.title}》` : ''}：${m.excerpt}`).join('\n')}`,
    );
  }
  return [
    { role: 'system', content: `${PERSONA}\n\n${task.join('\n')}` },
    { role: 'user', content: parts.join('\n\n') },
  ];
}

/* ---------------- 周 / 月回顾 ---------------- */

export function buildReviewMessages(label: string, digest: string): ChatMessage[] {
  const moodHint = MOODS.map(m => m.label).join('、');
  const task = [
    `任务：下面是用户${label}写的全部日记摘录。帮他回看这段时间。`,
    '输出一个 JSON 对象，字段如下：',
    '- summary：一段话，80 到 140 个字。说清这段时间他主要在经历什么、在意什么，要提到具体的事，不要泛泛而谈。',
    '- themes：2 到 4 个反复出现的主题，每个不超过 8 个字。',
    `- moodLine：一句话描述这段时间心情的走向，不超过 40 个字。可以参考日记上标注的心情（${moodHint}）。`,
    '- quote：从日记正文里原样摘出的一句话（8 到 40 个字），必须一字不差，选最能代表这段时间的那句。',
    '- question：留给他下一段时间想一想的一个问题，不超过 30 个字，要和这段时间写到的事有关。',
    '只输出 JSON，不要任何其他文字。',
  ];
  return [
    { role: 'system', content: `${PERSONA}\n\n${task.join('\n')}` },
    { role: 'user', content: digest },
  ];
}
