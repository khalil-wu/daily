import { memo, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';

import { motion, useReducedMotion } from '@/src/motion';
import { colors, radius } from '@/src/theme';

type SkeletonProps = {
  width?: number | `${number}%` | 'auto';
  height?: number | `${number}%` | 'auto';
  borderRadius?: number;
  style?: ViewStyle;
};

/**
 * SkeletonBone — 单个骨架占位块，带 shimmer 脉冲动画。
 * 遵循 UI/UX Pro Max §3 progressive-loading：>300ms 操作用骨架而非 spinner。
 */
function SkeletonBoneImpl({ width = '100%', height = 16, borderRadius = radius.input, style }: SkeletonProps) {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(0.35);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.6,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: motion.useNativeDriver,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: motion.useNativeDriver,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reducedMotion]);

  return (
    <Animated.View
      style={[
        { width: width as ViewStyle['width'], height: height as ViewStyle['height'], borderRadius, backgroundColor: colors.bgWash },
        { opacity },
        style,
      ]}
    />
  );
}

export const SkeletonBone = memo(SkeletonBoneImpl);

/**
 * HomeSkeleton — 首页骨架屏，模拟首页布局结构。
 */
export function HomeSkeleton() {
  return (
    <View style={styles.container}>
      {/* 标题行 */}
      <View style={styles.headerRow}>
        <SkeletonBone width={200} height={28} borderRadius={radius.button} />
        <SkeletonBone width={44} height={44} borderRadius={radius.circle} />
      </View>

      {/* Hero 卡片 */}
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <SkeletonBone width={160} height={14} />
          <SkeletonBone width={44} height={44} borderRadius={radius.circle} />
        </View>
        <SkeletonBone width="100%" height={300} borderRadius={radius.card} />
      </View>

      {/* 统计行 */}
      <View style={styles.metricRow}>
        <SkeletonBone width={120} height={68} borderRadius={radius.card} />
        <SkeletonBone width={120} height={68} borderRadius={radius.card} />
        <SkeletonBone width={120} height={68} borderRadius={radius.card} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroCard: {
    gap: 12,
    padding: 16,
    borderRadius: radius.card + 4,
    borderWidth: 3,
    borderColor: colors.stroke,
    backgroundColor: colors.surfaceMint,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
});
