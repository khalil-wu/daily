import React from 'react';
import { Pressable, StyleSheet, View, type TextStyle } from 'react-native';
import { Text } from './text';
import { Check } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { luminance } from '../theme/palette';
import { SERIF } from '../theme/tokens';
import { parseBlocks, parseInline } from '../utils/richtext';
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

/** 渲染行内标记（~~删除线~~、==高亮== 等同语法见 parseInline） */
function renderInline(line: string, baseStyle: TextStyle, accentColor: string, dark = false) {
  const tokens = parseInline(line);
  const nodes: React.ReactNode[] = [];
  let plain = '';
  let k = 0;
  for (const tok of tokens) {
    if (!tok.mark) {
      plain += tok.text;
      continue;
    }
    if (plain) { nodes.push(plain); plain = ''; }
    const style: TextStyle =
      tok.mark === 'bold' ? { fontWeight: '700' }
      : tok.mark === 'underline' ? { textDecorationLine: 'underline', textDecorationColor: accentColor }
      : tok.mark === 'italic' ? { fontStyle: 'italic' }
      : tok.mark === 'strike' ? { textDecorationLine: 'line-through' }
      : { backgroundColor: dark ? 'rgba(255,214,102,0.28)' : '#FFF0B3' };
    nodes.push(<Text key={k++} style={[baseStyle, style]}>{tok.text}</Text>);
  }
  if (plain) nodes.push(plain);
  return nodes;
}

/** 轻量富文本正文渲染器（支持标题/引用/待办清单/无序与有序列表/分割线/行内样式） */
export function RichBody({
  body,
  serif = true,
  onToggleTodo,
  colors,
}: {
  body: string;
  serif?: boolean;
  onToggleTodo?: (lineIndex: number) => void;
  /** 覆盖文字配色（如信纸底上固定的文字色） */
  colors?: { text?: string; sub?: string; muted?: string };
}) {
  const { c, t, fs, lineHeight, dark } = useTheme();
  const tc = colors?.text ?? c.text;
  const tsc = colors?.sub ?? c.textSub;
  const tmc = colors?.muted ?? c.textMuted;
  const onDarkPaper = colors?.text === '#EEF1FA';
  const baseStyle: TextStyle = serif
    ? { ...t.bodySerif, color: tc }
    : { fontSize: fs(15), color: tc, lineHeight: fs(15) * lineHeight };
  const headingStyle = serif ? { ...t.readingTitle, fontSize: fs(19), lineHeight: fs(19) * 1.5 } : t.h2;
  const blocks = React.useMemo(() => parseBlocks(body), [body]);

  return (
    <View style={{ gap: 10 }}>
      {blocks.map((block, i) => {
        if (block.type === 'blank') {
          return <View key={block.lineIndex} style={{ height: 8 }} />;
        }

        if (block.type === 'divider') {
          const ruleCol = colors?.muted ? `${colors.muted}55` : c.divider;
          return (
            <View key={block.lineIndex} style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <View style={{ width: 42, height: StyleSheet.hairlineWidth, backgroundColor: ruleCol }} />
              <Text style={{ fontSize: 12, color: tmc }}>·</Text>
              <View style={{ width: 42, height: StyleSheet.hairlineWidth, backgroundColor: ruleCol }} />
            </View>
          );
        }

        if (block.type === 'heading') {
          return (
            <Text key={block.lineIndex} style={[headingStyle, { marginTop: i > 0 ? 10 : 0, marginBottom: 2, color: tc }]}>
              {renderInline(block.text, headingStyle, c.primary, dark || onDarkPaper)}
            </Text>
          );
        }

        if (block.type === 'quote') {
          const qStyle: TextStyle = { ...baseStyle, color: tsc, fontStyle: 'italic' };
          const markColor = onDarkPaper && luminance(c.primary) < 0.28 ? tsc : c.primary;
          return (
            <View
              key={block.lineIndex}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                paddingLeft: 4,
                paddingRight: 4,
                paddingVertical: 3,
                marginVertical: 2,
              }}
            >
              <Text
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                aria-hidden
                style={{
                  fontFamily: SERIF,
                  fontSize: fs(28),
                  lineHeight: fs(28),
                  color: markColor,
                  opacity: 0.65,
                  width: 20,
                  marginRight: 4,
                  marginTop: -2,
                }}
              >
                “
              </Text>
              <Text style={[qStyle, { flex: 1 }]}>
                {renderInline(block.text, qStyle, markColor, dark || onDarkPaper)}
              </Text>
            </View>
          );
        }

        if (block.type === 'todo') {
          const todoStyle: TextStyle = block.checked
            ? { ...baseStyle, color: tmc, textDecorationLine: 'line-through' }
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
                  borderColor: block.checked ? c.primary : tmc,
                  backgroundColor: block.checked ? c.primary : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {block.checked && <Check size={12} color={c.textOnPrimary} strokeWidth={3} />}
              </View>
              <Text style={[todoStyle, { flex: 1 }]}>
                {renderInline(block.text, todoStyle, c.primary, dark)}
              </Text>
            </Pressable>
          );
        }

        if (block.type === 'ul') {
          return (
            <View key={block.lineIndex} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 4 }}>
              <Text style={[baseStyle, { color: c.primary, marginRight: 8 }]}>•</Text>
              <Text style={[baseStyle, { flex: 1 }]}>{renderInline(block.text, baseStyle, c.primary, dark)}</Text>
            </View>
          );
        }

        if (block.type === 'ol') {
          return (
            <View key={block.lineIndex} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 4 }}>
              <Text style={[baseStyle, { color: c.primaryDark, marginRight: 8, minWidth: 18 }]}>{block.index}.</Text>
              <Text style={[baseStyle, { flex: 1 }]}>{renderInline(block.text, baseStyle, c.primary, dark)}</Text>
            </View>
          );
        }

        return (
          <Text key={block.lineIndex} style={baseStyle}>
            {renderInline(block.text, baseStyle, c.primary, dark)}
          </Text>
        );
      })}
    </View>
  );
}
