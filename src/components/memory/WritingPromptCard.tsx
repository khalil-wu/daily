import { router } from 'expo-router';
import { Lightbulb, RefreshCw } from 'lucide-react-native';
import { memo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { getPromptCategoryLabel, pickRandomPrompt, type WritingPrompt } from '@/src/data/writingPrompts';
import { motion, selectionFeedback, useReducedMotion } from '@/src/motion';
import { colors, radius, shadows, spacing, strokeWidth, typography } from '@/src/theme';

type Props = {
  initialPrompt?: WritingPrompt;
};

/**
 * 写作提示卡片 — 展示灵感触发提示，可换一条，点击进入编辑。
 * 日漫风格：墨线面板 + 网点叠层 + 轻入场动画。
 */
export const WritingPromptCard = memo(function WritingPromptCard({ initialPrompt }: Props) {
  const reducedMotion = useReducedMotion();
  const [prompt, setPrompt] = useState<WritingPrompt | null>(initialPrompt ?? null);
  const [fadeAnim] = useState(() => new Animated.Value(1));

  const refresh = () => {
    void selectionFeedback();
    const next = pickRandomPrompt(prompt?.id);
    setPrompt(next);

    if (reducedMotion) return;
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: motion.duration.base,
      useNativeDriver: motion.useNativeDriver,
    }).start();
  };

  if (!prompt) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Lightbulb size={15} color={colors.accent} strokeWidth={2} />
          </View>
          <Text style={styles.headerTitle}>写点什么</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="换一个写作提示"
          onPress={refresh}
          hitSlop={8}
          style={({ pressed }) => [styles.refreshButton, pressed && styles.refreshButtonPressed]}
        >
          <RefreshCw size={15} color={colors.textSecondary} strokeWidth={2} />
          <Text style={styles.refreshText}>换一条</Text>
        </Pressable>
      </View>

      <Animated.View style={{ opacity: fadeAnim }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`用这个提示写日记：${prompt.text}`}
          onPress={() => {
            void selectionFeedback();
            router.push({ pathname: '/memory/create', params: { prompt: prompt.text } });
          }}
          style={({ pressed }) => [styles.promptBody, pressed && styles.promptBodyPressed]}
        >
          <Text style={styles.promptText}>{prompt.text}</Text>
          <View style={styles.promptFooter}>
            <View style={styles.categoryTag}>
              <Text style={styles.categoryText}>{getPromptCategoryLabel(prompt.category)}</Text>
            </View>
            <Text style={styles.ctaText}>写下来 →</Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMint,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '600',
    includeFontPadding: false,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    backgroundColor: colors.bgSecondary,
  },
  refreshButtonPressed: {
    backgroundColor: colors.bgWash,
  },
  refreshText: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    fontWeight: '500',
    includeFontPadding: false,
  },
  promptBody: {
    borderRadius: radius.card,
    borderWidth: strokeWidth.card,
    borderColor: colors.stroke,
    backgroundColor: colors.surfaceWarm,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadows.card,
  },
  promptBodyPressed: {
    backgroundColor: colors.bgElevated,
    transform: [{ scale: 0.98 }],
  },
  promptText: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.reading,
    fontSize: typography.postBody,
    lineHeight: typography.lineHeights.postBody,
    fontWeight: '500',
    includeFontPadding: false,
  },
  promptFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryTag: {
    borderRadius: radius.pill,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    backgroundColor: colors.bgSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  categoryText: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.micro,
    fontWeight: '600',
    includeFontPadding: false,
  },
  ctaText: {
    color: colors.accent,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    fontWeight: '700',
    includeFontPadding: false,
  },
});
