import type { Entry } from '../../store/types';

/** 单篇日记发给模型的正文上限（字符）。超出时保留开头和结尾 */
export const MAX_BODY_CHARS = 4000;

/** 一篇日记能不能发给 AI：隐藏日记、回收站里的日记永远不发 */
export function canSendEntry(entry: Pick<Entry, 'hidden' | 'deletedAt'>): boolean {
  return !entry.hidden && !entry.deletedAt;
}

/** 可以作为「以前写过的事」提供给 AI 的日记：已发布、没隐藏、没删除 */
export function sendableEntries(entries: Entry[]): Entry[] {
  return entries.filter(e => e.status === 'published' && canSendEntry(e));
}

/** 过长的正文只保留开头和结尾，中间用省略标记代替 */
export function clipText(text: string, max = MAX_BODY_CHARS): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const head = Math.floor(max * 0.62);
  const tail = max - head;
  return `${t.slice(0, head)}\n……（中间省略）……\n${t.slice(t.length - tail)}`;
}
