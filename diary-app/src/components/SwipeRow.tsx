import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from './text';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { clamp } from '../utils/text';
import { haptic } from './ui';
import { ND, SPRING, prefersReducedMotion, useReducedMotion } from './motion';

export interface SwipeAction {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  onPress: () => void;
}

export interface SwipeRowHandle {
  /** 轻轻滑开再合上，用来提示「这里可以左滑」 */
  peek: () => void;
  close: () => void;
}

interface SwipeRowProps {
  actions: SwipeAction[];
  disabled?: boolean;
  radius?: number;
  actionWidth?: number;
  style?: StyleProp<ViewStyle>;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

/** 同一时间只允许一行处于展开状态 */
let openRow: { close: () => void } | null = null;

/** 收起当前展开的行（列表滚动、切换页面时调用） */
export function closeOpenSwipeRow() {
  openRow?.close();
}

/** 跨平台左滑操作容器（基于 RN Animated + PanResponder，Web/iOS/Android 均稳定可用） */
export const SwipeRow = forwardRef<SwipeRowHandle, SwipeRowProps>(function SwipeRow(
  { actions, disabled = false, radius = 16, actionWidth = 56, style, onOpenChange, children },
  ref,
) {
  const { fs } = useTheme();
  const reduced = useReducedMotion();
  const maxReveal = actions.length * actionWidth;
  const translateX = useRef(new Animated.Value(0)).current;
  const offsetRef = useRef(0);
  const [open, setOpen] = useState(false);

  // 手势回调只创建一次，可变的值都走 ref
  const live = useRef({ disabled, maxReveal, count: actions.length, onOpenChange });
  live.current = { disabled, maxReveal, count: actions.length, onOpenChange };
  const self = useRef<{ close: () => void }>({ close: () => undefined });

  const api = useMemo(() => {
    const snapTo = (toValue: number) => {
      const wasOpen = offsetRef.current !== 0;
      const willOpen = toValue !== 0;
      offsetRef.current = toValue;
      if (prefersReducedMotion()) translateX.setValue(toValue);
      else Animated.spring(translateX, { toValue, useNativeDriver: ND, ...SPRING.slide }).start();
      if (willOpen) {
        if (openRow && openRow !== self.current) openRow.close();
        openRow = self.current;
      } else if (openRow === self.current) {
        openRow = null;
      }
      if (wasOpen !== willOpen) {
        setOpen(willOpen);
        live.current.onOpenChange?.(willOpen);
      }
    };
    return {
      snapTo,
      close: () => snapTo(0),
      peek: () => {
        if (offsetRef.current !== 0 || prefersReducedMotion() || live.current.disabled) return;
        const hint = -Math.min(live.current.maxReveal, 72);
        Animated.sequence([
          Animated.spring(translateX, { toValue: hint, useNativeDriver: ND, ...SPRING.slide }),
          Animated.delay(420),
          Animated.spring(translateX, { toValue: 0, useNativeDriver: ND, ...SPRING.slide }),
        ]).start();
      },
    };
  }, [translateX]);
  self.current.close = api.close;

  useImperativeHandle(ref, () => ({ peek: api.peek, close: api.close }), [api]);

  useEffect(
    () => () => {
      if (openRow === self.current) openRow = null;
      translateX.stopAnimation();
    },
    [translateX],
  );

  useEffect(() => {
    if (reduced) translateX.setValue(offsetRef.current);
    if (disabled) api.close();
  }, [disabled, reduced, api, translateX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          !live.current.disabled &&
          live.current.count > 0 &&
          Math.abs(g.dx) > 10 &&
          Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
        onPanResponderTerminationRequest: () => true,
        onPanResponderMove: (_, g) => {
          const max = live.current.maxReveal;
          const raw = offsetRef.current + g.dx;
          // 超出范围后带阻尼，手感更像原生列表
          const over = raw < -max ? -max + (raw + max) * 0.28 : raw > 0 ? raw * 0.2 : raw;
          translateX.setValue(clamp(over, -max - 36, 14));
        },
        onPanResponderRelease: (_, g) => {
          const max = live.current.maxReveal;
          const projected = offsetRef.current + g.dx;
          const shouldOpen = g.vx < -0.35 || projected < -Math.min(48, max * 0.42);
          if (shouldOpen && g.dx <= 20) {
            if (offsetRef.current === 0) haptic('light');
            api.snapTo(-max);
          } else {
            api.snapTo(0);
          }
        },
        onPanResponderTerminate: () => {
          const max = live.current.maxReveal;
          api.snapTo(offsetRef.current < -max * 0.5 ? -max : 0);
        },
      }),
    [api, translateX],
  );

  return (
    <View style={[{ position: 'relative' }, style]}>
      {/* 右侧操作区：合上时完全透明，避免从卡片圆角边缘透出颜色 */}
      {actions.length > 0 && (
        <Animated.View
          accessibilityElementsHidden={!open}
          aria-hidden={!open}
          importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
          pointerEvents={open ? 'auto' : 'none'}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 0,
            width: maxReveal + radius,
            flexDirection: 'row',
            borderTopRightRadius: radius,
            borderBottomRightRadius: radius,
            overflow: 'hidden',
            opacity: translateX.interpolate({ inputRange: [-14, -2], outputRange: [1, 0], extrapolate: 'clamp' }),
          }}
        >
          {actions.map((act, idx) => (
            <Pressable
              key={act.key}
              accessibilityLabel={act.label}
              accessibilityRole="button"
              tabIndex={open ? 0 : -1}
              onPress={() => {
                haptic('light');
                api.close();
                act.onPress();
              }}
              style={({ pressed }) => ({
                width: actionWidth + (idx === 0 ? radius : 0),
                paddingLeft: idx === 0 ? radius : 0,
                height: '100%',
                backgroundColor: act.color,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <act.icon size={17} color="#fff" strokeWidth={1.9} />
              <Text style={{ fontSize: fs(10.5), color: '#fff', fontWeight: '600' }} numberOfLines={1}>
                {act.label}
              </Text>
            </Pressable>
          ))}
        </Animated.View>
      )}

      {/* 前景卡片 */}
      <Animated.View {...panResponder.panHandlers} style={{ transform: [{ translateX }] }}>
        {children}
        {/* 展开时点击卡片 = 收起，而不是误入详情页 */}
        {open && <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={api.close} accessibilityLabel="收起操作" />}
      </Animated.View>
    </View>
  );
});
