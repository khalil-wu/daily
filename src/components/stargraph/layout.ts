import { PersonSummary } from '@/src/data/mock';

export type NodeLayout = {
  person: PersonSummary;
  x: number;
  y: number;
  size: number;
};

export type StarMapLayout = {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  centerSize: number;
  nodes: NodeLayout[];
};

const NETWORK_SLOTS = [
  { x: 0.25, y: 0.30 },
  { x: 0.74, y: 0.28 },
  { x: 0.18, y: 0.66 },
  { x: 0.82, y: 0.64 },
  { x: 0.50, y: 0.14 },
  { x: 0.50, y: 0.82 },
  { x: 0.08, y: 0.46 },
  { x: 0.92, y: 0.44 },
  { x: 0.64, y: 0.52 },
];

const MIN_SIZE = 50;
const MAX_SIZE = 64;

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// 以 personId 为种子的确定性偏移，保证同一人物位置稳定
function jitter(id: string, range: number): { dx: number; dy: number } {
  const h = hashCode(id);
  return {
    dx: ((h % 100) / 100 - 0.5) * 2 * range,
    dy: (((h >> 7) % 100) / 100 - 0.5) * 2 * range,
  };
}

export function computeLayout(people: PersonSummary[], width: number, height: number): StarMapLayout {
  const centerX = width / 2;
  const centerY = height * 0.52;

  const maxCount = Math.max(...people.map((p) => p.memoryCount), 1);

  const nodes: NodeLayout[] = people.slice(0, 9).map((person, index) => {
    const slot = NETWORK_SLOTS[index % NETWORK_SLOTS.length];
    const { dx, dy } = jitter(person.id, 8);
    const size = MIN_SIZE + (person.memoryCount / maxCount) * (MAX_SIZE - MIN_SIZE);

    const x = slot.x * width + dx;
    const y = slot.y * height + dy;

    return { person, x, y, size: Math.round(size) };
  });

  // 简单碰撞外推：两节点过近时沿径向推开后者
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const minDist = (a.size + b.size) / 2 + 28;
      if (dist < minDist && dist > 0) {
        const push = (minDist - dist) / dist;
        b.x += (b.x - a.x) * push;
        b.y += (b.y - a.y) * push;
      }
    }
  }

  // 边界钳制，保证头像和名字不出画布
  const pad = 8;
  for (const node of nodes) {
    const half = node.size / 2;
    node.x = Math.min(Math.max(node.x, half + pad), width - half - pad);
    node.y = Math.min(Math.max(node.y, half + pad + 12), height - half - pad - 26);
  }

  return { width, height, centerX, centerY, centerSize: 78, nodes };
}

