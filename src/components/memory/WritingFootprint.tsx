import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import type { MemorySummary, PersonSummary } from '@/src/data/mock';
import { parseMemoryDate } from '@/src/date/parseMemoryDate';
import { resolveMood } from '@/src/i18n/copy';
import { useReducedMotion } from '@/src/motion';
import { useMoodStore } from '@/src/stores/useMoodStore';
import { colors, radius, shadows, spacing, strokeWidth, typography } from '@/src/theme';

type Props = {
  memories: MemorySummary[];
  people: PersonSummary[];
};

type FootprintStats = {
  totalMemories: number;
  totalChars: number;
  longestStreak: number;
  thisMonthCount: number;
  topPeople: { name: string; count: number }[];
};

function computeFootprint(memories: MemorySummary[], people: PersonSummary[]): FootprintStats {
  const totalMemories = memories.length;
  const totalChars = memories.reduce((sum, m) => sum + (m.content?.replace(/\s/g, '').length ?? m.excerpt.length), 0);

  // longest streak
  const dateSet = new Set<string>();
  for (const m of memories) {
    const parsed = parseMemoryDate(m);
    if (!parsed) continue;
    dateSet.add(`${parsed.year}-${parsed.month}-${parsed.day}`);
  }
  const dates = Array.from(dateSet).sort().map((key) => {
    const [y, mo, d] = key.split('-').map(Number);
    return new Date(y, mo - 1, d);
  });
  let longestStreak = 0;
  let tempStreak = 0;
  let prevDate: Date | null = null;
  for (const date of dates) {
    if (prevDate) {
      const diff = Math.round((date.getTime() - prevDate.getTime()) / 86400000);
      tempStreak = diff === 1 ? tempStreak + 1 : 1;
    } else {
      tempStreak = 1;
    }
    longestStreak = Math.max(longestStreak, tempStreak);
    prevDate = date;
  }

  const now = new Date();
  const thisMonthCount = dates.filter(
    (d) => d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(),
  ).length;

  // top moods
  const moodCounts = new Map<string, number>();
  for (const m of memories) {
    if (m.mood) moodCounts.set(m.mood, (moodCounts.get(m.mood) ?? 0) + 1);
  }
  const topMoods = Array.from(moodCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // top people
  const personCounts = new Map<string, number>();
  for (const m of memories) {
    for (const pid of m.personIds) {
      personCounts.set(pid, (personCounts.get(pid) ?? 0) + 1);
    }
  }
  const topPeople = Array.from(personCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([pid, count]) => ({
      name: people.find((p) => p.id === pid)?.name ?? '未知',
      count,
    }));

  return { totalMemories, totalChars, longestStreak, thisMonthCount, topPeople };
}

function useCountUpAnim(target: number, reducedMotion: boolean, delay = 0) {
  const anim = useRef(new Animated.Value(reducedMotion ? target : 0)).current;
  useEffect(() => {
    if (reducedMotion) {
      anim.setValue(target);
      return;
    }
    const timer = setTimeout(() => {
      Animated.timing(anim, {
        toValue: target,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
        delay,
      }).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [target, anim, reducedMotion, delay]);
  return anim;
}

export const WritingFootprint = memo(function WritingFootprint({ memories, people }: Props) {
  const reducedMotion = useReducedMotion();
  const moodRegistry = useMoodStore((state) => state.moods);
  const stats = useMemo(() => computeFootprint(memories, people), [memories, people]);

  const memoryAnim = useCountUpAnim(stats.totalMemories, reducedMotion);
  const charAnim = useCountUpAnim(stats.totalChars, reducedMotion, 100);
  const streakAnim = useCountUpAnim(stats.longestStreak, reducedMotion, 200);

  const topMoods = useMemo(() => {
    const moodCounts = new Map<string, number>();
    for (const m of memories) {
      if (m.mood) moodCounts.set(m.mood, (moodCounts.get(m.mood) ?? 0) + 1);
    }
    return Array.from(moodCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, count]) => {
        const mood = resolveMood(id, moodRegistry);
        return { label: mood?.label ?? id, emoji: mood?.emoji ?? '⭐', count };
      });
  }, [memories, moodRegistry]);

  if (memories.length === 0) return null;

  const maxMoodCount = topMoods.length > 0 ? topMoods[0].count : 1;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>写作足迹</Text>

      <View style={styles.statsGrid}>
        <View style={styles.statCell}>
          <Animated.Text style={styles.statNumber}>
            {memoryAnim.interpolate({ inputRange: [0, 99999], outputRange: ['0', '99999'] })}
          </Animated.Text>
          <Text style={styles.statLabel}>段记忆</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}>
          <Animated.Text style={styles.statNumber}>
            {charAnim.interpolate({ inputRange: [0, 999999], outputRange: ['0', '999999'] })}
          </Animated.Text>
          <Text style={styles.statLabel}>个字</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}>
          <Animated.Text style={styles.statNumber}>
            {streakAnim.interpolate({ inputRange: [0, 9999], outputRange: ['0', '9999'] })}
          </Animated.Text>
          <Text style={styles.statLabel}>最长连续</Text>
        </View>
      </View>

      {topMoods.length > 0 ? (
        <View style={styles.subSection}>
          <Text style={styles.subTitle}>最常心情</Text>
          <View style={styles.moodBars}>
            {topMoods.map((mood) => (
              <View key={mood.label} style={styles.moodBarRow}>
                <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                <Text style={styles.moodLabel}>{mood.label}</Text>
                <View style={styles.moodBarTrack}>
                  <View
                    style={[
                      styles.moodBarFill,
                      { width: `${(mood.count / maxMoodCount) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.moodCount}>{mood.count}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {stats.topPeople.length > 0 ? (
        <View style={styles.subSection}>
          <Text style={styles.subTitle}>最常记录</Text>
          <View style={styles.personChips}>
            {stats.topPeople.map((person, index) => (
              <View key={index} style={styles.personChip}>
                <Text style={styles.personRank}>#{index + 1}</Text>
                <Text style={styles.personName}>{person.name}</Text>
                <Text style={styles.personCount}>{person.count}次</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    borderRadius: radius.card,
    borderWidth: strokeWidth.card,
    borderColor: colors.stroke,
    backgroundColor: colors.bgSecondary,
    padding: spacing.xl,
    ...shadows.card,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: '600',
    includeFontPadding: false,
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.divider,
  },
  statNumber: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.titleLg,
    fontWeight: '700',
    lineHeight: typography.titleLg,
    includeFontPadding: false,
  },
  statLabel: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.micro,
    includeFontPadding: false,
  },
  subSection: {
    gap: spacing.sm,
  },
  subTitle: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    fontWeight: '600',
    includeFontPadding: false,
  },
  moodBars: {
    gap: spacing.xs,
  },
  moodBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  moodEmoji: {
    fontSize: 16,
    includeFontPadding: false,
  },
  moodLabel: {
    width: 48,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    includeFontPadding: false,
  },
  moodBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bgWash,
    overflow: 'hidden',
  },
  moodBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  moodCount: {
    width: 28,
    textAlign: 'right',
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.micro,
    includeFontPadding: false,
  },
  personChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  personChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.button,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    backgroundColor: colors.bgWash,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  personRank: {
    color: colors.accent,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.micro,
    fontWeight: '700',
    includeFontPadding: false,
  },
  personName: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    fontWeight: '600',
    includeFontPadding: false,
  },
  personCount: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.micro,
    includeFontPadding: false,
  },
});
