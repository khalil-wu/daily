import { memo, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { motion, useReducedMotion } from '@/src/motion';
import { colors } from '@/src/theme';

type Props = {
  refreshing: boolean;
  progress: Animated.Value;
};

/**
 * InkDropRefresh — 墨水滴落下拉刷新指示器。
 * 日漫风格：下拉时墨滴逐渐凝聚，刷新时墨滴旋转脉动。
 */
function InkDropRefreshImpl({ refreshing, progress }: Props) {
  const reducedMotion = useReducedMotion();
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (!refreshing || reducedMotion) return;
    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: motion.useNativeDriver,
      }),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: motion.useNativeDriver,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: motion.useNativeDriver,
        }),
      ]),
    );
    spinLoop.start();
    pulseLoop.start();
    return () => {
      spinLoop.stop();
      pulseLoop.stop();
    };
  }, [refreshing, spinAnim, pulseAnim, reducedMotion]);

  const rotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const inkColor = colors.stroke;
  const accentColor = colors.accent;

  return (
    <View style={styles.container}>
      <Animated.View
        style={{
          transform: [{ scale: refreshing ? pulseAnim : 1 }, { rotate: refreshing ? rotation : '0deg' }],
        }}
      >
        <Svg width={36} height={36} viewBox="0 0 36 36">
          {/* 墨滴形状 */}
          <Path
            d="M18 4 C18 4, 8 16, 8 23 C8 28.5 12.5 33 18 33 C23.5 33 28 28.5 28 23 C28 16, 18 4, 18 4 Z"
            fill={refreshing ? accentColor : inkColor}
            fillOpacity={0.12}
            stroke={refreshing ? accentColor : inkColor}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          {/* 高光圆点 */}
          <Circle
            cx={14}
            cy={20}
            r={3}
            fill={refreshing ? accentColor : inkColor}
            fillOpacity={0.5}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

export const InkDropRefresh = memo(InkDropRefreshImpl);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
  },
});
