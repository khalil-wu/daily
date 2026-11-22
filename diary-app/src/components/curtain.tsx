import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';
import { ND, useReducedMotion } from './motion';

/**
 * 纸幕：跨路由的连续过渡层。翻开书、书页铺满后，纸幕以同一张纸色盖住整个应用，
 * 路由切换发生在纸幕之下，目的页就绪后纸幕淡出——用户看到的是「纸变成了页面」，没有硬切。
 */
export const PAPER = '#F7F4EC';

let visible = false;
let color = PAPER;
let failsafe: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function showCurtain(next: string = PAPER) {
  color = next;
  visible = true;
  clearTimeout(failsafe);
  // 目的页没有按时揭幕时自动放行，绝不把用户挡在纸后
  failsafe = setTimeout(hideCurtain, 1500);
  emit();
}

export function hideCurtain() {
  if (!visible) return;
  visible = false;
  clearTimeout(failsafe);
  emit();
}

export function PaperCurtain() {
  const on = useSyncExternalStore(subscribe, () => visible, () => false);
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = React.useState(false);

  useEffect(() => {
    opacity.stopAnimation();
    if (on) {
      setMounted(true);
      opacity.setValue(1);
      return;
    }
    const anim = Animated.timing(opacity, { toValue: 0, duration: reduced ? 120 : 260, easing: Easing.out(Easing.cubic), useNativeDriver: ND });
    anim.start(({ finished }) => finished && setMounted(false));
    return () => anim.stop();
  }, [on, opacity, reduced]);

  if (!mounted) return null;
  return (
    <Animated.View
      pointerEvents={on ? 'auto' : 'none'}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : {})}
      style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity, zIndex: 999 }]}
    />
  );
}

/**
 * 页面入场：web 没有原生转场，进入新页面是硬切；这里给内容一个很短的位移 + 淡入。
 * 原生端已有系统转场，不重复叠加。
 */
export function ScreenEnter({ kind = 'page', children }: { kind?: 'page' | 'rise' | 'fade'; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const skip = Platform.OS !== 'web' || reduced;
  const v = useRef(new Animated.Value(skip ? 1 : 0)).current;
  useEffect(() => {
    if (skip) return;
    const anim = Animated.timing(v, { toValue: 1, duration: kind === 'fade' ? 180 : 260, easing: Easing.out(Easing.cubic), useNativeDriver: ND });
    anim.start();
    return () => anim.stop();
  }, [v, skip, kind]);
  if (skip) return <>{children}</>;
  const shift = v.interpolate({ inputRange: [0, 1], outputRange: [kind === 'fade' ? 0 : kind === 'rise' ? 22 : 30, 0] });
  return (
    <Animated.View style={{ flex: 1, opacity: v, transform: [kind === 'rise' ? { translateY: shift } : { translateX: shift }] }}>
      {children}
    </Animated.View>
  );
}
