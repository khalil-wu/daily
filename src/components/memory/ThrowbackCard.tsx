import { router } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { type MemorySummary, type PersonSummary } from '@/src/data/mock';
import { parseMemoryDate } from '@/src/date/parseMemoryDate';
import { motion, selectionFeedback, useReducedMotion } from '@/src/motion';
import { colors, radius, shadows, spacing, strokeWidth, typography } from '@/src/theme';

type Props = {
  memories: MemorySummary[];
  people: PersonSummary[];
};

/**
 * 那年今日 — 展示往年同月同日的记忆。
 * 日漫风格：墨线描边卡片 + 网点叠层 + 入场交错动画。
 */
export const ThrowbackCard = memo(function ThrowbackCard({ memories, people }: Props) {
  const reducedMotion = useReducedMotion();
  const fadeAnim = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const slideAnim = useRef(new Animated.Value(reducedMotion ? 0 : 12)).current;

  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();
  const todayYear = today.getFullYear();

  const throwbackMemories = useMemo(() => {
    return memories
      .map((memory) => {
        const parsed = parseMemoryDate(memory);
        if (!parsed) return null;
        if (parsed.month !== todayMonth || parsed.day !== todayDay) return null;
        if (parsed.year >= todayYear) return null;
        return { memory, parsed };
      })
      .filter((item): item is { memory: MemorySummary; parsed: { year: number; month: number; day: number } } => item !== null)
      .sort((a, b) => b.parsed.year - a.parsed.year)
      .slice(0, 3);
  }, [memories, todayMonth, todayDay, todayYear]);

  useEffect(() => {
    if (reducedMotion) return;
    const animation = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: motion.duration.base,
        delay: 100,
        useNativeDriver: motion.useNativeDriver,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: motion.duration.base,
        delay: 100,
        useNativeDriver: motion.useNativeDriver,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [fadeAnim, slideAnim, reducedMotion]);

  if (throwbackMemories.length === 0) return null;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Sparkles size={16} color={colors.accent} strokeWidth={2} />
        </View>
        <Text style={styles.headerTitle}>那年今日</Text>
      </View>

      {throwbackMemories.map(({ memory, parsed }, index) => {
        const yearsAgo = todayYear - parsed.year;
        const person = people.find((p) => memory.personIds.includes(p.id) || p.id === memory.personId);
        const authorName = person?.name ?? '我';

        return (
          <Pressable
            key={memory.id}
            accessibilityRole="button"
            accessibilityLabel={`${yearsAgo}年前的今天，${authorName}的记忆：${memory.excerpt}`}
            onPress={() => {
              void selectionFeedback();
              router.push(`/memory/${memory.id}`);
            }}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
          >
            <View style={styles.yearBadge}>
              <Text style={styles.yearBadgeText}>{yearsAgo}</Text>
              <Text style={styles.yearBadgeLabel}>年前</Text>
            </View>
            <View style={styles.itemBody}>
              <Text style={styles.itemExcerpt} numberOfLines={2}>{memory.excerpt}</Text>
              <Text style={styles.itemMeta} numberOfLines={1}>
                {authorName} · {parsed.year}年{parsed.month}月{parsed.day}日
                {memory.mood ? ` · ${memory.mood}` : ''}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  headerIcon: {
    width: 32,
    height: 32,
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
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.card,
    borderWidth: strokeWidth.card,
    borderColor: colors.stroke,
    backgroundColor: colors.bgSecondary,
    padding: spacing.lg,
    ...shadows.card,
  },
  itemPressed: {
    backgroundColor: colors.bgElevated,
    transform: [{ scale: 0.98 }],
  },
  yearBadge: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    backgroundColor: colors.surfaceMint,
    paddingVertical: spacing.xs,
  },
  yearBadgeText: {
    color: colors.accent,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.titleLg,
    fontWeight: '700',
    lineHeight: typography.titleLg,
    includeFontPadding: false,
  },
  yearBadgeLabel: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.micro,
    includeFontPadding: false,
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  itemExcerpt: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.reading,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    includeFontPadding: false,
  },
  itemMeta: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    includeFontPadding: false,
  },
});
