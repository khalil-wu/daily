export type RichBlock =
  | { type: 'blank'; lineIndex: number }
  | { type: 'divider'; lineIndex: number }
  | { type: 'heading'; lineIndex: number; text: string }
  | { type: 'quote'; lineIndex: number; text: string }
  | { type: 'todo'; lineIndex: number; checked: boolean; text: string }
  | { type: 'ul'; lineIndex: number; text: string }
  | { type: 'ol'; lineIndex: number; index: string; text: string }
  | { type: 'paragraph'; lineIndex: number; text: string };

/** 将轻量 Markdown 正文解析为结构化块列表（纯函数） */
export function parseBlocks(body: string): RichBlock[] {
  if (!body) return [];
  const lines = body.split(/\r?\n/);
  const blocks: RichBlock[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const raw = lines[lineIndex];
    const trimmed = raw.trim();

    if (!trimmed) {
      blocks.push({ type: 'blank', lineIndex });
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      blocks.push({ type: 'divider', lineIndex });
      continue;
    }

    if (raw.startsWith('# ')) {
      blocks.push({ type: 'heading', lineIndex, text: raw.slice(2).trimEnd() });
      continue;
    }

    const quoteMatch = raw.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      blocks.push({ type: 'quote', lineIndex, text: quoteMatch[1].trimEnd() });
      continue;
    }

    const todoMatch = raw.match(/^-\s+\[([ xX])\]\s*(.*)$/);
    if (todoMatch) {
      blocks.push({
        type: 'todo',
        lineIndex,
        checked: todoMatch[1].toLowerCase() === 'x',
        text: todoMatch[2].trimEnd(),
      });
      continue;
    }

    if (raw.startsWith('- ')) {
      blocks.push({ type: 'ul', lineIndex, text: raw.slice(2).trimEnd() });
      continue;
    }

    const olMatch = raw.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      blocks.push({
        type: 'ol',
        lineIndex,
        index: olMatch[1],
        text: olMatch[2].trimEnd(),
      });
      continue;
    }

    blocks.push({ type: 'paragraph', lineIndex, text: raw.trimEnd() });
  }

  return blocks;
}

/** 精确切换指定行号的待办事项勾选状态（[ ] <-> [x]），不改动其他行 */
export function toggleTodoAtLine(body: string, lineIndex: number): string {
  const lines = body.split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) return body;
  const line = lines[lineIndex];
  const m = line.match(/^(\s*-\s+\[)([ xX])(\]\s*.*)$/);
  if (!m) return body;
  const nextMark = m[2].toLowerCase() === 'x' ? ' ' : 'x';
  lines[lineIndex] = `${m[1]}${nextMark}${m[3]}`;
  return lines.join('\n');
}

export interface ListContinuation {
  text: string;
  /** 处理后光标应该所在的位置 */
  cursor: number;
}

/**
 * 回车自动接续列表。
 * 比较输入前后的正文：如果这次变化恰好是「在某行末尾或中间敲了一个回车」，
 * 且该行是待办 / 无序 / 有序 / 引用，则：
 *  - 行内有内容 → 新行自动带上同样的前缀（有序列表序号 +1，待办恢复为未勾选）
 *  - 行内只有前缀（空项）→ 去掉前缀，结束列表
 * 其它情况返回 null，交给输入框按原样处理。
 * caret 是输入前的光标位置（可选），用于在连续空行附近准确定位这次回车。
 */
export function continueListOnEnter(prev: string, next: string, caret?: number): ListContinuation | null {
  if (next.length !== prev.length + 1) return null;

  // 优先用输入前的光标位置定位回车；没有光标信息时退回到逐字比较
  let i = -1;
  if (
    caret != null &&
    caret >= 0 &&
    caret <= prev.length &&
    next[caret] === '\n' &&
    next.slice(0, caret) === prev.slice(0, caret) &&
    next.slice(caret + 1) === prev.slice(caret)
  ) {
    i = caret;
  } else {
    i = 0;
    while (i < prev.length && prev[i] === next[i]) i++;
    if (next[i] !== '\n' || next.slice(i + 1) !== prev.slice(i)) return null;
  }
  if (i === 0) return null;

  const lineStart = prev.lastIndexOf('\n', i - 1) + 1;
  const line = prev.slice(lineStart, i);

  let prefix = '';
  let nextPrefix = '';
  const todo = line.match(/^-\s+\[[ xX]\]\s?/);
  const ol = line.match(/^(\d+)\.\s+/);
  if (todo) {
    prefix = todo[0];
    nextPrefix = '- [ ] ';
  } else if (line.startsWith('- ')) {
    prefix = '- ';
    nextPrefix = '- ';
  } else if (ol) {
    prefix = ol[0];
    nextPrefix = `${Number(ol[1]) + 1}. `;
  } else if (line.startsWith('> ')) {
    prefix = '> ';
    nextPrefix = '> ';
  } else {
    return null;
  }

  if (line.slice(prefix.length).trim() === '') {
    // 空项上回车：结束列表，只留下一个空行
    return { text: prev.slice(0, lineStart) + prev.slice(i), cursor: lineStart };
  }
  return {
    text: `${prev.slice(0, i)}\n${nextPrefix}${prev.slice(i)}`,
    cursor: i + 1 + nextPrefix.length,
  };
}

export type InlineMark = 'bold' | 'italic' | 'underline' | 'strike' | 'highlight';
export interface InlineToken {
  text: string;
  mark?: InlineMark;
}

const INLINE_RE = /(\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|~~(.+?)~~|==(.+?)==)/g;

/** 解析行内标记：**粗体** *斜体* __下划线__ ~~删除线~~ ==高亮== */
export function parseInline(line: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((match = INLINE_RE.exec(line)) !== null) {
    if (match.index > last) tokens.push({ text: line.slice(last, match.index) });
    const mark: InlineMark = match[2] !== undefined ? 'bold'
      : match[3] !== undefined ? 'underline'
      : match[4] !== undefined ? 'italic'
      : match[5] !== undefined ? 'strike'
      : 'highlight';
    tokens.push({ text: match[2] ?? match[3] ?? match[4] ?? match[5] ?? match[6] ?? '', mark });
    last = INLINE_RE.lastIndex;
  }
  if (last < line.length) tokens.push({ text: line.slice(last) });
  return tokens;
}
