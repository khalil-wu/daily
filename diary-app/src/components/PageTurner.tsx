import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, { Easing, interpolate, runOnJS, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from './motion';
import type { Entry } from '../store/types';

export type PageRole = 'prev' | 'cur' | 'next';
export interface PageTurnerHandle {
  turn: (dir: 'prev' | 'next') => void;
}

interface Props {
  prev?: Entry;
  cur: Entry;
  next?: Entry;
  renderPage: (entry: Entry, role: PageRole) => React.ReactNode;
  onCommit: (dir: 'prev' | 'next') => void;
  /** 一次翻页手势结束（无论是否翻过去），用来吞掉紧随其后的点击 */
  onDragged?: () => void;
}

const TURN_MS = 420;

/**
 * 一页一页翻：当前页绕左缘刚性翻起，露出下面（更早的）一页；向右翻则是上一页从左边盖回来。
 * 三页常驻（上一页 / 当前页 / 下一页），手势与动画全部走共享值，不触发 React 重渲染。
 */
export const PageTurner = forwardRef<PageTurnerHandle, Props>(function PageTurner({ prev, cur, next, renderPage, onCommit, onDragged }, ref) {
  const reduced = useReducedMotion();
  const width = useSharedValue(0);
  const prog = useSharedValue(0); // -1 → 向后翻（下一篇，更早）；+1 → 向前翻（上一篇，更新）
  const hasPrev = useSharedValue(!!prev);
  const hasNext = useSharedValue(!!next);
  const finishing = useSharedValue(0);
  const activated = useSharedValue(0);

  useEffect(() => {
    hasPrev.value = !!prev;
    hasNext.value = !!next;
  }, [prev, next, hasPrev, hasNext]);

  useLayoutEffect(() => {
    prog.value = 0;
    finishing.value = 0;
  }, [cur.id, prog, finishing]);

  const commit = useCallback((dir: 'prev' | 'next') => onCommit(dir), [onCommit]);
  const duration = reduced ? 150 : TURN_MS;

  const animateTo = useCallback(
    (dir: 'prev' | 'next', ms: number) => {
      finishing.value = 1;
      prog.value = withTiming(dir === 'next' ? -1 : 1, { duration: ms, easing: Easing.inOut(Easing.cubic) }, done => {
        if (done) runOnJS(commit)(dir);
      });
    },
    [commit, finishing, prog],
  );

  useImperativeHandle(
    ref,
    () => ({
      turn: dir => {
        if (finishing.value || (dir === 'next' ? !next : !prev)) return;
        animateTo(dir, duration);
      },
    }),
    [animateTo, duration, finishing, next, prev],
  );

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-20, 20])
        .failOffsetY([-12, 12])
        .onStart(() => {
          'worklet';
          activated.value = 1;
        })
        .onUpdate(e => {
          'worklet';
          if (finishing.value || width.value <= 0) return;
          const lo = hasNext.value ? -1 : 0;
          const hi = hasPrev.value ? 1 : 0;
          prog.value = Math.max(lo, Math.min(hi, e.translationX / width.value));
        })
        .onFinalize(() => {
          'worklet';
          if (!activated.value) return;
          activated.value = 0;
          if (onDragged) runOnJS(onDragged)();
        })
        .onEnd(e => {
          'worklet';
          if (finishing.value) return;
          const p = prog.value;
          const forwardFast = p < 0 && e.velocityX < -500;
          const backwardFast = p > 0 && e.velocityX > 500;
          if (p !== 0 && (Math.abs(p) > 0.35 || forwardFast || backwardFast)) {
            finishing.value = 1;
            const dir = p < 0 ? 'next' : 'prev';
            prog.value = withTiming(p < 0 ? -1 : 1, { duration: reduced ? 120 : 120 + 300 * (1 - Math.abs(p)), easing: Easing.out(Easing.cubic) }, done => {
              if (done) runOnJS(commit)(dir);
            });
          } else {
            prog.value = withTiming(0, { duration: reduced ? 120 : 240, easing: Easing.out(Easing.cubic) });
          }
        }),
    [activated, commit, finishing, hasNext, hasPrev, onDragged, prog, reduced, width],
  );

  return (
    <GestureDetector gesture={pan} touchAction="pan-y">
      <View style={{ flex: 1, overflow: 'hidden' }} onLayout={e => { width.value = e.nativeEvent.layout.width; }}>
        {next && (
          <PageLayer key={next.id} role="next" prog={prog} width={width} reduced={reduced}>
            {renderPage(next, 'next')}
          </PageLayer>
        )}
        <PageLayer key={cur.id} role="cur" prog={prog} width={width} reduced={reduced}>
          {renderPage(cur, 'cur')}
        </PageLayer>
        {prev && (
          <PageLayer key={prev.id} role="prev" prog={prog} width={width} reduced={reduced}>
            {renderPage(prev, 'prev')}
          </PageLayer>
        )}
      </View>
    </GestureDetector>
  );
});

function PageLayer({ role, prog, width, reduced, children }: { role: PageRole; prog: SharedValue<number>; width: SharedValue<number>; reduced: boolean; children: React.ReactNode }) {
  const { c } = useTheme();
  // 角色放进共享值：翻页提交时同一层会从「下一页」变成「当前页」，
  // 角色与进度必须在同一帧生效，否则旧页会闪回一帧
  const roleSV = useSharedValue(role);
  useLayoutEffect(() => {
    roleSV.value = role;
  }, [role, roleSV]);
  const angle = useDerivedValue(() => {
    const p = prog.value;
    if (roleSV.value === 'cur') return p < 0 ? p * 180 : 0;
    if (roleSV.value === 'prev') return p > 0 ? -180 + p * 180 : -180;
    return 0;
  });

  const layerStyle = useAnimatedStyle(() => {
    const p = prog.value;
    if (reduced) {
      return { opacity: roleSV.value === 'cur' ? 1 - Math.abs(p) : roleSV.value === 'next' ? Math.max(0, -p) : Math.max(0, p) };
    }
    if (roleSV.value === 'next') return { opacity: 1, transform: [{ perspective: 1400 }, { translateX: 0 }, { rotateY: '0deg' }, { translateX: 0 }] };
    const a = angle.value;
    const w = width.value;
    return {
      opacity: a < -172 ? 0 : 1,
      transform: [{ perspective: 1400 }, { translateX: -w / 2 }, { rotateY: `${a}deg` }, { translateX: w / 2 }],
    };
  });
  const faceStyle = useAnimatedStyle(() => ({ opacity: reduced || roleSV.value === 'next' || angle.value > -90 ? 1 : 0 }));
  const backStyle = useAnimatedStyle(() => ({ opacity: !reduced && roleSV.value !== 'next' && angle.value <= -90 ? 1 : 0 }));
  const turnShade = useAnimatedStyle(() => ({ opacity: reduced || roleSV.value === 'next' ? 0 : interpolate(Math.abs(angle.value), [0, 90, 180], [0, 0.25, 0]) }));
  const castShadow = useAnimatedStyle(() => {
    const p = prog.value;
    const amount = roleSV.value === 'next' ? Math.max(0, -p) : roleSV.value === 'cur' ? Math.max(0, p) : 0;
    return { opacity: reduced ? 0 : interpolate(amount, [0, 0.5, 1], [0, 0.6, 0]) };
  });

  const active = role === 'cur';
  const hidden = Platform.OS === 'web' ? ({ 'aria-hidden': !active, inert: !active } as any) : {};
  return (
    <Reanimated.View
      pointerEvents={active ? 'auto' : 'none'}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      {...hidden}
      style={[StyleSheet.absoluteFill, { backgroundColor: c.bg }, layerStyle]}
    >
      <Reanimated.View style={[StyleSheet.absoluteFill, faceStyle]}>{children}</Reanimated.View>
      <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#F3EFE6' }, backStyle]} />
      <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, turnShade]}>
        <LinearGradient colors={['rgba(0,0,0,0.9)', 'rgba(0,0,0,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Reanimated.View>
      <Reanimated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '45%' }, castShadow]}>
        <LinearGradient colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Reanimated.View>
    </Reanimated.View>
  );
}
