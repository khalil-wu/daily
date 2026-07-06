import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

import { motion } from './tokens';
import { useReducedMotion } from './useReducedMotion';

/**
 * useCountUp — 数字从 0 递增到目标值的动画 Hook。
 * 遵循 UI/UX Pro Max §7 Animation 规范：
 * - duration 300–600ms（数据动画）
 * - ease-out 缓动（进入式）
 * - 支持 prefers-reduced-motion（直接显示终值）
 */
export function useCountUp(target: number, duration = 500) {
  const reducedMotion = useReducedMotion();
  const animatedValue = useRef(new Animated.Value(reducedMotion ? target : 0)).current;
  const displayValue = useRef(reducedMotion ? target : 0);

  useEffect(() => {
    if (reducedMotion) {
      animatedValue.setValue(target);
      displayValue.current = target;
      return;
    }

    const listener = animatedValue.addListener(({ value }) => {
      displayValue.current = Math.round(value);
    });

    Animated.timing(animatedValue, {
      toValue: target,
      duration: Math.max(motion.duration.base, duration),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
      delay: 80,
    }).start();

    return () => animatedValue.removeListener(listener);
  }, [target, duration, reducedMotion, animatedValue]);

  return {
    animatedValue,
    getDisplayValue: () => displayValue.current,
  };
}
