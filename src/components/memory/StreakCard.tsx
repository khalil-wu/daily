import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { type MemorySummary } from '@/src/data/mock';
import { parseMemoryDate } from '@/src/date/parseMemoryDate';
import { motion, useReducedMotion } from '@/src/motion';
import { colors, radius, shadows, spacing, strokeWidth, typography } from '@/src/theme';

type Props = {
  memories: MemorySummary[];
};

type StreakStats = {
  currentStreak: number;
  longestStreak: number;
  totalDays: number;
  thisMonthCount: number;
};

/**
 * 计算连续记录天数和写作统计。
 */
function computeStats(memories: MemorySummary[]): StreakStats {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 把所有记忆日期转换为 Date 去重
  const dateSet = new Set<string>();
  for (const memory of memories) {
    const parsed = parseMemoryDate(memory);
    if (!parsed) continue;
    const dateStr = `${parsed.year}-${parsed.month}-${parsed.day}`;
    dateSet.add(dateStr);
  }

  const dateKeys = Array.from(dateSet).sort();
  const dates = dateKeys.map((key) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  });

  // 总记录天数
  const totalDays = dates.length;

  // 本月记录数
  const thisMonthCount = dates.filter(
    (date) => date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth(),
  ).length;

  // 计算连续天数（从今天或昨天往前推）
  let currentStreak = 0;
  const checkDate = new Date(today);
  // 如果今天没有记录，从昨天开始算（保持streak不中断）
  const todayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  if (!dateSet.has(todayKey)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const key = `${checkDate.getFullYear()}-${checkDate.getMonth() + 1}-${checkDate.getDate()}`;
    if (dateSet.has(key)) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // 计算最长连续天数
  let longestStreak = 0;
  let tempStreak = 0;
  let prevDate: Date | null = null;
  for (const date of dates) {
    if (prevDate) {
      const diff = Math.round((date.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diff === 1) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
    } else {
      tempStreak = 1;
    }
    longestStreak = Math.max(longestStreak, tempStreak);
    prevDate = date;
  }

  return { currentStreak, longestStreak, totalDays, thisMonthCount };
}

/**
 * 连续记录 + 统计卡片 — 展示写作连续天数、本月条数、总天数。
 * 使用 count-up 动画展示数字。
 */
export const StreakCard = memo(function StreakCard({ memories }: Props) {
  const reducedMotion = useReducedMotion();
  const stats = useMemo(() => computeStats(memories), [memories]);

  // count-up 动画
  const streakAnim = useRef(new Animated.Value(reducedMotion ? stats.currentStreak : 0)).current;
  const monthAnim = useRef(new Animated.Value(reducedMotion ? stats.thisMonthCount : 0)).current;
  const totalAnim = useRef(new Animated.Value(reducedMotion ? stats.totalDays : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      streakAnim.setValue(stats.currentStreak);
      monthAnim.setValue(stats.thisMonthCount);
      totalAnim.setValue(stats.totalDays);
      return;
    }

    const config = {
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
      delay: 100,
    };

    Animated.parallel([
      Animated.timing(streakAnim, { ...config, toValue: stats.currentStreak }),
      Animated.timing(monthAnim, { ...config, toValue: stats.thisMonthCount }),
      Animated.timing(totalAnim, { ...config, toValue: stats.totalDays }),
    ]).start();
  }, [stats, streakAnim, monthAnim, totalAnim, reducedMotion]);

  return (
    <View style={styles.container}>
      <View style={styles.streakHero}>
        <Animated.Text style={styles.streakNumber}>
          {streakAnim.interpolate({
            inputRange: [0, 999],
            outputRange: ['0', '999'],
          })}
        </Animated.Text>
        <Text style={styles.streakLabel}>天连续</Text>
        {stats.currentStreak > 0 ? (
          <Text style={styles.streakSubtext}>继续保持 ✦</Text>
        ) : (
          <Text style={styles.streakSubtext}>今天写下第一条吧</Text>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Animated.Text style={styles.statNumber}>
            {monthAnim.interpolate({
              inputRange: [0, 999],
              outputRange: ['0', '999'],
            })}
          </Animated.Text>
          <Text style={styles.statLabel}>本月</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Animated.Text style={styles.statNumber}>
            {totalAnim.interpolate({
              inputRange: [0, 9999],
              outputRange: ['0', '9999'],
            })}
          </Animated.Text>
          <Text style={styles.statLabel}>总天数</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.longestStreak}</Text>
          <Text style={styles.statLabel}>最长连续</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: radius.card,
    borderWidth: strokeWidth.card,
    borderColor: colors.stroke,
    backgroundColor: colors.bgSecondary,
    overflow: 'hidden',
    ...shadows.card,
  },
  streakHero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: colors.surfaceMint,
    gap: 2,
  },
  streakNumber: {
    color: colors.accent,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.metricLg,
    fontWeight: '700',
    lineHeight: typography.metricLg,
    includeFontPadding: false,
  },
  streakLabel: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    fontWeight: '600',
    includeFontPadding: false,
  },
  streakSubtext: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.micro,
    includeFontPadding: false,
  },
  statsRow: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
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
});
