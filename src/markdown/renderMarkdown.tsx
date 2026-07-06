import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { alpha, colors, radius, spacing, typography } from '@/src/theme';

type Segment = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
};

function parseInline(text: string): Segment[] {
  const segments: Segment[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) segments.push({ text: text.slice(cursor, match.index) });
    const token = match[0];
    if (token.startsWith('**')) {
      segments.push({ text: token.slice(2, -2), bold: true });
    } else if (token.startsWith('*')) {
      segments.push({ text: token.slice(1, -1), italic: true });
    } else {
      segments.push({ text: token.slice(1, -1), code: true });
    }
    cursor = match.index + token.length;
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments.length > 0 ? segments : [{ text }];
}

function InlineText({ text, style }: { text: string; style?: object }) {
  return (
    <Text style={[styles.paragraph, style]}>
      {parseInline(text).map((segment, index) => (
        <Text
          key={`${segment.text}-${index}`}
          style={[
            segment.bold && styles.bold,
            segment.italic && styles.italic,
            segment.code && styles.inlineCode,
          ]}
        >
          {segment.text}
        </Text>
      ))}
    </Text>
  );
}

export function WritingPreview({ value, emptyText = '效果会显示在这里。' }: { value: string; emptyText?: string }) {
  const lines = value.split(/\r?\n/);
  const nodes: ReactElement[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    const current = listItems;
    listItems = [];
    nodes.push(
      <View key={`list-${nodes.length}`} style={styles.listBlock}>
        {current.map((item, index) => (
          <View key={`${item}-${index}`} style={styles.listRow}>
            <Text style={styles.bullet}>•</Text>
            <InlineText text={item} style={styles.listText} />
          </View>
        ))}
      </View>,
    );
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushList();
      nodes.push(<View key={`space-${nodes.length}`} style={styles.space} />);
      continue;
    }
    if (/^(---+|───+)$/.test(line.trim())) {
      flushList();
      nodes.push(<View key={`rule-${nodes.length}`} style={styles.rule} />);
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      nodes.push(<InlineText key={`h2-${nodes.length}`} text={line.slice(3)} style={styles.h2} />);
      continue;
    }
    if (line.startsWith('# ')) {
      flushList();
      nodes.push(<InlineText key={`h1-${nodes.length}`} text={line.slice(2)} style={styles.h1} />);
      continue;
    }
    if (line.startsWith('> ')) {
      flushList();
      nodes.push(
        <View key={`quote-${nodes.length}`} style={styles.quote}>
          <InlineText text={line.slice(2)} style={styles.quoteText} />
        </View>,
      );
      continue;
    }
    if (/^- \[[ xX]\] /.test(line)) {
      flushList();
      const checked = /^- \[[xX]\]/.test(line);
      nodes.push(
        <View key={`todo-${nodes.length}`} style={styles.todoRow}>
          <View style={[styles.checkbox, checked && styles.checkboxChecked]} />
          <InlineText text={line.replace(/^- \[[ xX]\] /, '')} style={checked ? styles.doneText : undefined} />
        </View>,
      );
      continue;
    }
    if (line.startsWith('- ')) {
      listItems.push(line.slice(2));
      continue;
    }
    flushList();
    nodes.push(<InlineText key={`p-${nodes.length}`} text={line} />);
  }

  flushList();

  return (
    <View style={styles.preview}>
      {value.trim() ? nodes : <Text style={styles.empty}>{emptyText}</Text>}
    </View>
  );
}


const styles = StyleSheet.create({
  preview: {
    gap: spacing.sm,
  },
  paragraph: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.reading,
    fontSize: typography.postBody,
    lineHeight: typography.lineHeights.postBody,
    includeFontPadding: false,
  },
  h1: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.display,
    lineHeight: typography.lineHeights.display,
    fontWeight: '700',
  },
  h2: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.titleLg,
    lineHeight: typography.lineHeights.titleLg,
    fontWeight: '700',
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  inlineCode: {
    color: colors.accentDim,
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.body,
    backgroundColor: colors.bgWash,
  },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    backgroundColor: colors.bgWash,
    borderRadius: radius.input,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  quoteText: {
    color: colors.textSecondary,
  },
  listBlock: {
    gap: spacing.xs,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bullet: {
    color: colors.accent,
    fontSize: typography.postBody,
    lineHeight: typography.lineHeights.postBody,
  },
  listText: {
    flex: 1,
  },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  checkbox: {
    width: 18,
    height: 18,
    marginTop: 7,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.bgPaper,
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  doneText: {
    color: colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: alpha.accent22,
    marginVertical: spacing.sm,
  },
  space: {
    height: spacing.xs,
  },
  empty: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    includeFontPadding: false,
  },
});
