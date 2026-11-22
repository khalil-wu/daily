export function uid(prefix = 'e') {
  try {
    const c = (globalThis as any).crypto;
    if (c?.randomUUID) {
      return `${prefix}_${String(c.randomUUID()).replace(/-/g, '').slice(0, 16)}`;
    }
  } catch {}
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export async function sha256(text: string): Promise<string> {
  const input = `jide-diary::${text}`;
  try {
    const subtle = (globalThis as any).crypto?.subtle;
    if (subtle && typeof TextEncoder !== 'undefined') {
      const buf = await subtle.digest('SHA-256', new TextEncoder().encode(input));
      return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {}
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Crypto = require('expo-crypto');
    return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
  } catch {
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return `fnv_${(h >>> 0).toString(16).padStart(8, '0')}`;
  }
}

/** 去掉轻量富文本标记，得到纯文本 */
export function plainText(body: string) {
  return body
    .replace(/^(-{3,}|\*{3,})\s*$/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/==(.+?)==/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^#\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^-\s+\[[ xX]\]\s*/gm, '')
    .replace(/^-\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '');
}

export function excerpt(body: string, max = 60) {
  const t = plainText(body).replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** 字数（中文按字，英文按词） */
// 统计、热力图、年度报告会对同一篇正文反复计数：按原文缓存结果（有上限，满了整体清空）
const WC_CACHE = new Map<string, number>();
const WC_MAX = 6000;

export function wordCount(text: string) {
  if (!text) return 0;
  const hit = WC_CACHE.get(text);
  if (hit !== undefined) return hit;
  const t = plainText(text);
  const cjk = (t.match(/[\u4e00-\u9fa5\u3040-\u30ff]/g) || []).length;
  const words = (t.replace(/[\u4e00-\u9fa5\u3040-\u30ff]/g, ' ').match(/[A-Za-z0-9]+/g) || []).length;
  if (WC_CACHE.size >= WC_MAX) WC_CACHE.clear();
  WC_CACHE.set(text, cjk + words);
  return cjk + words;
}

export function fmtNumber(n: number) {
  return n.toLocaleString('en-US');
}

export function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export function isPhone(s: string) {
  return /^1\d{10}$/.test(s.trim());
}

export function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}
