import { useCallback } from 'react';
import type { View } from 'react-native';

/**
 * 新手导览的「目标登记处」。
 * 页面把真实的控件登记进来，导览浮层量出它们此刻在屏幕上的真实位置再打光，
 * 这样无论机型、字号、安全区怎么变，聚光灯都对得准。
 */

export interface TourRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Measurable = Pick<View, 'measureInWindow'>;

const nodes = new Map<string, Measurable>();
const handlers = new Map<string, () => void>();

/** 把一个真实控件登记为导览目标：<View ref={useTourTarget('home.fab')} collapsable={false} /> */
export function useTourTarget(key: string) {
  return useCallback(
    (node: View | null) => {
      if (!node) return;
      nodes.set(key, node);
      return () => {
        if (nodes.get(key) === node) nodes.delete(key);
      };
    },
    [key],
  );
}

function measureNode(node: Measurable): Promise<TourRect | null> {
  return new Promise(resolve => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(null);
      }
    }, 240);
    try {
      node.measureInWindow((x, y, w, h) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(Number.isFinite(x) && Number.isFinite(y) && w > 0 && h > 0 ? { x, y, w, h } : null);
      });
    } catch {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve(null);
      }
    }
  });
}

/** 量出一组目标的并集矩形（窗口坐标）；任何一个量不到都返回 null */
export async function measureTourTargets(keys: string[]): Promise<TourRect | null> {
  let rect: TourRect | null = null;
  for (const key of keys) {
    const node = nodes.get(key);
    if (!node) return null;
    const r = await measureNode(node);
    if (!r) return null;
    rect = rect ? unionRect(rect, r) : r;
  }
  return rect;
}

export function measureView(node: Measurable | null): Promise<TourRect | null> {
  return node ? measureNode(node) : Promise.resolve(null);
}

export function unionRect(a: TourRect, b: TourRect): TourRect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** 页面登记给导览调用的动作（例如「列表回到顶部」） */
export function setTourHandler(name: string, fn: (() => void) | null) {
  if (fn) handlers.set(name, fn);
  else handlers.delete(name);
}

export function runTourHandler(name: string) {
  const fn = handlers.get(name);
  if (!fn) return false;
  fn();
  return true;
}
