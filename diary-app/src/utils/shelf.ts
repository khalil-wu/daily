import type { Notebook } from '../store/types';

/** 书架顺序：有 order 的按 order，旧数据（无 order）沿用数组原顺序；相同再按创建时间，稳定排序 */
export function sortNotebooks(notebooks: Notebook[]): Notebook[] {
  return notebooks
    .map((n, i) => ({ n, i }))
    .sort((a, b) => (a.n.order ?? a.i) - (b.n.order ?? b.i) || a.n.createdAt - b.n.createdAt || a.i - b.i)
    .map(x => x.n);
}

/** 把 id 从 from 位挪到 to 位 */
export function moveId<T>(ids: T[], from: number, to: number): T[] {
  'worklet';
  if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) return ids.slice();
  const next = ids.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

export interface ShelfGeo {
  tileW: number;
  tileH: number;
  cols: number;
  width: number;
  total: number;
  gap: number;
  rowStride: number;
}

/** 第 slot 个格子（0 起，含「全部日记」与末尾新建格）左上角在书架容器内的位置，每行居中 */
export function slotPosition(slot: number, g: ShelfGeo): { x: number; y: number } {
  'worklet';
  const row = Math.floor(slot / g.cols);
  const col = slot - row * g.cols;
  const inRow = Math.min(g.cols, g.total - row * g.cols);
  const rowW = inRow * g.tileW + (inRow - 1) * g.gap;
  return { x: (g.width - rowW) / 2 + col * (g.tileW + g.gap), y: row * g.rowStride };
}

/** 离给定中心点最近的可拖动格子（first..last，含端点） */
export function nearestSlot(cx: number, cy: number, first: number, last: number, g: ShelfGeo): number {
  'worklet';
  let best = first;
  let bestD = Infinity;
  for (let s = first; s <= last; s++) {
    const p = slotPosition(s, g);
    const dx = p.x + g.tileW / 2 - cx;
    const dy = p.y + g.tileH / 2 - cy;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}
