import React from 'react';
import { Pressable, StyleSheet, View, type TextStyle } from 'react-native';
import { Text } from './text';
import { Check } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { parseBlocks } from '../utils/richtext';
import { haptic } from './ui';

/** 高亮搜索关键词 */
export function HighlightText({ text, query, style, numberOfLines }: { text: string; query?: string; style?: TextStyle; numberOfLines?: number }) {
  const { c } = useTheme();
  const q = query?.trim();
  if (!q) return <Text numberOfLines={numberOfLines} style={style}>{text}</Text>;
  const lower = text.toLowerCase();
  const qLower = q.toLowerCase();
  const parts: { str: string; hit: boolean }[] = [];
  let idx = 0;
  while (idx < text.length) {
    const pos = lower.indexOf(qLower, idx);
    if (pos === -1) {
      parts.push({ str: text.slice(idx), hit: false });
      break;
    }
    if (pos > idx) parts.push({ str: text.slice(idx, pos), hit: false });
    parts.push({ str: text.slice(pos, pos + q.length), hit: true });
    idx = pos + q.length;
  }
  return (
    <Text numberOfLines={numberOfLines} style={style}>
      {parts.map((p, i) =>
        p.hit ? (
          <Text key={i} style={{ fontFamily: style?.fontFamily, backgroundColor: c.primarySoft, color: c.primaryDark, fontWeight: '600' }}>
            {p.str}
          </Text>
        ) : (
          <React.Fragment key={i}>{p.str}</React.Fragment>
        ),
      )}
    </Text>
  );
}

/** 渲染行内 **粗体**、*斜体*、__下划线__ */
function renderInline(line: string, baseStyle: TextStyle, accentColor: string) {
  const tokens: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let k = 0;
  while ((match = regex.exec(line)) !== null) {
    if (match.index > last) tokens.push(line.slice(last, match.index));
    if (match[2] !== undefined) {
      tokens.push(<Text key={k++} style={[baseStyle, { fontWeight: '700' }]}>{match[2]}</Text>);
    } else if (match[3] !== undefined) {
      tokens.push(<Text key={k++} style={[baseStyle, { textDecorationLine: 'underline', textDecorationColor: accentColor }]}>{match[3]}</Text>);
    } else if (match[4] !== undefined) {
      tokens.push(<Text key={k++} style={[baseStyle, { fontStyle: 'italic' }]}>{match[4]}</Text>);
    }
    last = regex.lastIndex;
  }
  if (last < line.length) tokens.push(line.slice(last));
  return tokens;
}

/** 轻量富文本正文渲染器（支持标题/引用/待办清单/无序与有序列表/分割线/行内样式） */
export function RichBody({
  body,
  serif = true,
  onToggleTodo,
}: {
  body: string;
  serif?: boolean;
  onToggleTodo?: (lineIndex: number) => void;
}) {
  const { c, t, fs, lineHeight, dark, r } = useTheme();
  const baseStyle: TextStyle = serif
    ? t.bodySerif
    : { fontSize: fs(15), color: c.text, lineHeight: fs(15) * lineHeight };
  const headingStyle = serif ? { ...t.readingTitle, fontSize: fs(19), lineHeight: fs(19) * 1.5 } : t.h2;
  const blocks = React.useMemo(() => parseBlocks(body), [body]);

  return (
    <View style={{ gap: 10 }}>
      {blocks.map((block, i) => {
        if (block.type === 'blank') {
          return <View key={block.lineIndex} style={{ height: 8 }} />;
        }

        if (block.type === 'divider') {
          return (
            <View key={block.lineIndex} style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <View style={{ width: 42, height: StyleSheet.hairlineWidth, backgroundColor: c.divider }} />
              <Text style={{ fontSize: 12, color: c.textMuted }}>·</Text>
              <View style={{ width: 42, height: StyleSheet.hairlineWidth, backgroundColor: c.divider }} />
            </View>
          );
        }

        if (block.type === 'heading') {
          return (
            <Text key={block.lineIndex} style={[headingStyle, { marginTop: i > 0 ? 10 : 0, marginBottom: 2, color: c.text }]}>
              {renderInline(block.text, headingStyle, c.primary)}
            </Text>
          );
        }

        if (block.type === 'quote') {
          const qStyle: TextStyle = { ...baseStyle, color: c.textSub, fontStyle: 'italic' };
          return (
            <View
              key={block.lineIndex}
              style={{
                borderLeftWidth: 3,
                borderLeftColor: c.primary,
                backgroundColor: dark ? c.cardAlt : c.primaryFaint,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderTopRightRadius: r(10),
                borderBottomRightRadius: r(10),
                marginVertical: 2,
              }}
            >
              <Text style={qStyle}>{renderInline(block.text, qStyle, c.primary)}</Text>
            </View>
          );
        }

        if (block.type === 'todo') {
          const todoStyle: TextStyle = block.checked
            ? { ...baseStyle, color: c.textMuted, textDecorationLine: 'line-through' }
            : baseStyle;
          return (
            <Pressable
              key={block.lineIndex}
              disabled={!onToggleTodo}
              onPress={() => {
                haptic('light');
                onToggleTodo?.(block.lineIndex);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'flex-start',
                paddingLeft: 2,
                paddingVertical: 2,
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  marginRight: 9,
                  marginTop: Math.max(3, ((Number(baseStyle.lineHeight) || 24) - 18) / 2),
                  borderWidth: 1.5,
                  borderColor: block.checked ? c.primary : c.textMuted,
                  backgroundColor: block.checked ? c.primary : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {block.checked && <Check size={12} color={c.textOnPrimary} strokeWidth={3} />}
              </View>
              <Text style={[todoStyle, { flex: 1 }]}>
                {renderInline(block.text, todoStyle, c.primary)}
              </Text>
            </Pressable>
          );
        }

        if (block.type === 'ul') {
          return (
            <View key={block.lineIndex} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 4 }}>
              <Text style={[baseStyle, { color: c.primary, marginRight: 8 }]}>•</Text>
              <Text style={[baseStyle, { flex: 1 }]}>{renderInline(block.text, baseStyle, c.primary)}</Text>
            </View>
          );
        }

        if (block.type === 'ol') {
          return (
            <View key={block.lineIndex} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 4 }}>
              <Text style={[baseStyle, { color: c.primaryDark, marginRight: 8, minWidth: 18 }]}>{block.index}.</Text>
              <Text style={[baseStyle, { flex: 1 }]}>{renderInline(block.text, baseStyle, c.primary)}</Text>
            </View>
          );
        }

        return (
          <Text key={block.lineIndex} style={baseStyle}>
            {renderInline(block.text, baseStyle, c.primary)}
          </Text>
        );
      })}
    </View>
  );
}
