/**
 * 写作提示库 — 灵感激发系统
 * 按类型分类：回忆触发、感官细节、情感深度、日常生活、创意联想
 */

export type PromptCategory = 'memory' | 'sensory' | 'emotion' | 'daily' | 'creative';

export type WritingPrompt = {
  id: string;
  category: PromptCategory;
  text: string;
};

export const writingPrompts: WritingPrompt[] = [
  // 回忆触发
  { id: 'm1', category: 'memory', text: '今天最想记住的一件小事是什么？' },
  { id: 'm2', category: 'memory', text: '上一次笑得很开心，是因为什么？' },
  { id: 'm3', category: 'memory', text: '最近有没有什么让你想起从前？' },
  { id: 'm4', category: 'memory', text: '如果给今天起个标题，会是什么？' },
  { id: 'm5', category: 'memory', text: '今天有什么是你不想忘记的？' },

  // 感官细节
  { id: 's1', category: 'sensory', text: '此刻窗外是什么样的？' },
  { id: 's2', category: 'sensory', text: '今天闻到过什么特别的味道吗？' },
  { id: 's3', category: 'sensory', text: '闭上眼睛，听到什么声音？' },
  { id: 's4', category: 'sensory', text: '今天的天气给你什么感觉？' },
  { id: 's5', category: 'sensory', text: '今天吃的什么，味道怎么样？' },

  // 情感深度
  { id: 'e1', category: 'emotion', text: '现在的心情，像什么天气？' },
  { id: 'e2', category: 'emotion', text: '今天有什么让你感动了？' },
  { id: 'e3', category: 'emotion', text: '有没有什么想说但没说出口的话？' },
  { id: 'e4', category: 'emotion', text: '今天最平静的时刻是什么时候？' },
  { id: 'e5', category: 'emotion', text: '此刻最想对谁说什么？' },

  // 日常生活
  { id: 'd1', category: 'daily', text: '今天遇到什么有趣的人了吗？' },
  { id: 'd2', category: 'daily', text: '今天有什么小意外？' },
  { id: 'd3', category: 'daily', text: '通勤路上发生了什么？' },
  { id: 'd4', category: 'daily', text: '今天有什么做得不错的事？' },
  { id: 'd5', category: 'daily', text: '今天最慢的一段时光在做什么？' },

  // 创意联想
  { id: 'c1', category: 'creative', text: '如果今天是部电影，开场镜头是什么？' },
  { id: 'c2', category: 'creative', text: '今天的你会是什么颜色？' },
  { id: 'c3', category: 'creative', text: '如果给明天写一句话，你想写什么？' },
  { id: 'c4', category: 'creative', text: '用三个词形容今天。' },
  { id: 'c5', category: 'creative', text: '今天的你像哪首歌？' },
];

const categoryLabels: Record<PromptCategory, string> = {
  memory: '回忆',
  sensory: '感官',
  emotion: '情感',
  daily: '日常',
  creative: '联想',
};

export function getPromptCategoryLabel(category: PromptCategory): string {
  return categoryLabels[category];
}

/**
 * 根据当前时间选择一个适合的提示。
 * 早上偏日常/感官，下午偏创意，晚上偏回忆/情感。
 */
export function pickContextualPrompt(now: Date = new Date()): WritingPrompt {
  const hour = now.getHours();
  let pool: WritingPrompt[];

  if (hour < 11) {
    pool = writingPrompts.filter((p) => p.category === 'daily' || p.category === 'sensory');
  } else if (hour < 17) {
    pool = writingPrompts.filter((p) => p.category === 'creative' || p.category === 'daily');
  } else {
    pool = writingPrompts.filter((p) => p.category === 'memory' || p.category === 'emotion');
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * 随机获取一个不同类型的提示（用于换一条）。
 */
export function pickRandomPrompt(excludeId?: string): WritingPrompt {
  const pool = excludeId ? writingPrompts.filter((p) => p.id !== excludeId) : writingPrompts;
  return pool[Math.floor(Math.random() * pool.length)];
}
