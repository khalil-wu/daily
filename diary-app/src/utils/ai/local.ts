import type { MoodKey, Tag } from '../../store/types';
import { plainText } from '../text';

/**
 * 不联网也能给的建议：全部在本机用简单规则算出来。
 * 没开启「记得」时用它们；开启后它们先出现，模型的结果回来再补充。
 */

/** 用正文第一句话做标题 */
export function localTitle(body: string, max = 14): string | null {
  const first = plainText(body)
    .split(/\n+/)
    .map(l => l.trim())
    .find(Boolean);
  if (!first) return null;
  let s = first.split(/[。！？!?；;]/)[0].trim();
  if (s.length > max) {
    const clause = s.split(/[，,、：:]/)[0].trim();
    s = clause.length >= 4 && clause.length <= max ? clause : s.slice(0, max);
  }
  s = s.replace(/[，,、：:\s]+$/, '');
  return s.length >= 2 ? s : null;
}

const TAG_WORDS: Record<string, string[]> = {
  study: ['学习', '复习', '考试', '上课', '作业', '课程', '背单词', '论文', '图书馆'],
  work: ['工作', '加班', '项目', '开会', '上线', '同事', '老板', '客户', '汇报', '面试', '公司'],
  life: ['做饭', '打扫', '逛街', '超市', '散步', '周末', '菜市场', '收拾'],
  travel: ['旅行', '旅游', '出发', '机场', '高铁', '酒店', '景区', '爬山', '海边', '民宿'],
  emotion: ['难过', '开心', '焦虑', '想哭', '情绪', '心情', '委屈', '崩溃'],
  growth: ['成长', '反思', '复盘', '目标', '坚持', '改变', '习惯', '学会了'],
  reading: ['读完', '读了', '看书', '阅读', '这本书', '《'],
  sport: ['跑步', '健身', '瑜伽', '游泳', '打球', '骑车', '锻炼', '运动'],
  health: ['医院', '医生', '感冒', '体检', '失眠', '吃药', '生病', '头疼', '血压'],
  finance: ['工资', '存钱', '基金', '理财', '账单', '省钱', '房租', '花了'],
};

/** 按关键词给出最多 3 个标签建议（自定义标签按名字出现与否判断） */
export function localTags(text: string, tags: Tag[], exclude: string[] = []): string[] {
  const body = plainText(text);
  if (!body) return [];
  const scored: { id: string; hits: number }[] = [];
  for (const tag of tags) {
    if (exclude.includes(tag.id)) continue;
    const words = TAG_WORDS[tag.id] ?? [];
    let hits = words.filter(w => body.includes(w)).length;
    if (tag.name.length >= 2 && body.includes(tag.name)) hits += 2;
    if (hits > 0) scored.push({ id: tag.id, hits });
  }
  return scored
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 3)
    .map(s => s.id);
}

const MOOD_WORDS: Record<MoodKey, string[]> = {
  happy: ['开心', '高兴', '快乐', '好玩', '笑', '太棒', '幸福', '惊喜', '满足', '兴奋'],
  calm: ['平静', '安静', '放松', '舒服', '惬意', '安稳', '从容', '踏实'],
  grateful: ['感谢', '感恩', '谢谢', '幸运', '珍惜', '温暖', '感动'],
  tired: ['好累', '很累', '太累', '累了', '疲惫', '好困', '熬夜', '没力气', '撑不住'],
  down: ['难过', '伤心', '想哭', '失落', '沮丧', '低落', '孤独', '委屈', '崩溃', '哭了'],
  anxious: ['焦虑', '紧张', '担心', '害怕', '不安', '压力', '心慌', '烦躁', '失眠'],
};

/** 从用词猜心情。只有一种心情明显领先时才给建议，拿不准就不猜 */
export function localMood(text: string): MoodKey | undefined {
  const body = plainText(text);
  if (!body) return undefined;
  const scores = (Object.keys(MOOD_WORDS) as MoodKey[])
    .map(key => ({ key, hits: MOOD_WORDS[key].reduce((n, w) => n + (body.split(w).length - 1), 0) }))
    .sort((a, b) => b.hits - a.hits);
  if (scores[0].hits === 0 || scores[0].hits === scores[1].hits) return undefined;
  return scores[0].key;
}

const STARTERS: { when: 'morning' | 'day' | 'night' | 'any'; q: string }[] = [
  { when: 'morning', q: '今天醒来第一个念头是什么？' },
  { when: 'morning', q: '今天最想做完的一件事是什么？' },
  { when: 'day', q: '到现在为止，今天哪一刻最让你想记下来？' },
  { when: 'day', q: '今天和谁说过的话还留在心里？' },
  { when: 'night', q: '今天哪一刻让你松了一口气？' },
  { when: 'night', q: '今天有什么事是你没说出口的？' },
  { when: 'night', q: '如果给今天起个名字，会是什么？' },
  { when: 'any', q: '最近一直在想的那件事，现在想到哪了？' },
  { when: 'any', q: '今天吃到、看到或听到了什么，想留下来？' },
  { when: 'any', q: '此刻身体是什么感觉？' },
];

const DEEPEN = [
  '这件事里，哪个瞬间你记得最清楚？',
  '当时你心里最先冒出来的念头是什么？',
  '有什么是你当时想说、但没有说的？',
  '这件事让你想起了以前的什么？',
  '如果再来一次，你想换一种做法吗？',
  '写到这里，你现在是什么感觉？',
  '这件事里，有谁是你想感谢或想多说一句的？',
];

/**
 * 不联网时的提问：空白页给「好下笔」的问题，写了内容之后给「往深处问」的通用问题。
 * seed 用来「换一批」。
 */
export function localQuestions(opts: { hasBody: boolean; hour: number; seed?: number }): string[] {
  const seed = Math.abs(Math.floor(opts.seed ?? 0));
  const take = (pool: string[]) => [0, 1, 2].map(i => pool[(seed * 3 + i) % pool.length]);
  if (opts.hasBody) return take(DEEPEN);
  const when = opts.hour < 11 ? 'morning' : opts.hour < 18 ? 'day' : 'night';
  const pool = [...STARTERS.filter(s => s.when === when), ...STARTERS.filter(s => s.when === 'any')].map(s => s.q);
  return take(pool);
}
