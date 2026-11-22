import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Animated, Easing, KeyboardAvoidingView, LayoutAnimation, Modal, PanResponder, Platform, Pressable, type ModalProps, type PressableProps, type StyleProp, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { Text } from './text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';

/**
 * 动效基础层：全应用共用同一套弹簧参数与进出场节奏。
 * 只负责「怎么动」，不引入新的视觉样式 —— 颜色、圆角、阴影全部沿用设计稿 token。
 */

/** Web 端没有原生驱动，统一在这里判断 */
export const ND = Platform.OS !== 'web';

export const SPRING = {
  /** 按下：快、无回弹 */
  press: { speed: 48, bounciness: 0 },
  /** 松开：略带回弹 */
  release: { speed: 20, bounciness: 8 },
  /** 底部面板升起 */
  sheet: { damping: 28, stiffness: 300, mass: 0.9 },
  /** 弹窗、气泡弹出 */
  pop: { damping: 20, stiffness: 280, mass: 0.8 },
  /** 指示条、滑块滑动 */
  slide: { damping: 24, stiffness: 260, mass: 0.8 },
} as const;

/* ---------------- 减弱动态效果 ---------------- */

const motionQuery = Platform.OS === 'web' && typeof window !== 'undefined'
  ? window.matchMedia?.('(prefers-reduced-motion: reduce)') : undefined;
let reduceMotion = motionQuery?.matches ?? false;
const motionListeners = new Set<() => void>();
function updateMotion(value: boolean) {
  if (reduceMotion === value) return;
  reduceMotion = value;
  motionListeners.forEach(listener => listener());
}
function subscribeMotion(listener: () => void) {
  motionListeners.add(listener);
  // A single platform subscription is shared by every animated component.
  let remove: (() => void) | undefined;
  if (motionListeners.size === 1) {
    if (motionQuery) {
      const changed = (event: MediaQueryListEvent) => updateMotion(event.matches);
      motionQuery.addEventListener('change', changed);
      updateMotion(motionQuery.matches);
      remove = () => motionQuery.removeEventListener('change', changed);
    } else {
      let active = true;
      void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) updateMotion(value); }).catch(() => undefined);
      const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', updateMotion);
      remove = () => { active = false; subscription.remove(); };
    }
    unsubscribePlatformMotion = remove;
  }
  return () => {
    motionListeners.delete(listener);
    if (motionListeners.size === 0) {
      unsubscribePlatformMotion?.();
      unsubscribePlatformMotion = undefined;
    }
  };
}
let unsubscribePlatformMotion: (() => void) | undefined;

export function useReducedMotion() {
  return useSyncExternalStore(subscribeMotion, prefersReducedMotion, () => false);
}

/** 系统开启「减弱动态效果」时，位移类动画改为直接到位 */
export function prefersReducedMotion() {
  return reduceMotion;
}

/* ---------------- 列表增删 ---------------- */

/**
 * 在改动列表数据「之前」调用：下一次布局变化（删除、恢复、取消收藏）里，
 * 被删的行淡出、下面的行顺势补位，而不是一闪就没了。Web 上是空操作。
 */
export function animateNextLayout() {
  if (!ND || reduceMotion) return;
  LayoutAnimation.configureNext({
    duration: 260,
    create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    update: { type: LayoutAnimation.Types.spring, springDamping: 0.86 },
    delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  });
}

/* ---------------- 按压反馈 ---------------- */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  /** 按下时缩放到的比例 */
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/** 带弹簧缩放的可按压容器：替代「按下瞬间变透明」的生硬反馈 */
export function PressableScale({ scaleTo = 0.97, style, onPressIn, onPressOut, children, ...rest }: PressableScaleProps) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced || rest.disabled) v.setValue(0);
    return () => v.stopAnimation();
  }, [reduced, rest.disabled, v]);
  const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
  const { transform, ...restStyle } = flat;
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, scaleTo] });
  const run = (to: number) => {
    if (reduced) return;
    Animated.spring(v, { toValue: to, useNativeDriver: ND, ...(to ? SPRING.press : SPRING.release) }).start();
  };
  return (
    <AnimatedPressable
      accessibilityRole="button"
      aria-disabled={rest.disabled || rest.accessibilityState?.disabled}
      aria-busy={rest.accessibilityState?.busy}
      aria-expanded={rest.accessibilityState?.expanded}
      aria-selected={rest.accessibilityState?.selected}
      aria-checked={rest.accessibilityState?.checked}
      {...rest}
      onPressIn={e => {
        run(1);
        onPressIn?.(e);
      }}
      onPressOut={e => {
        run(0);
        onPressOut?.(e);
      }}
      style={[restStyle, { transform: [...((Array.isArray(transform) ? transform : []) as any[]), { scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

/* ---------------- 果冻反馈 ---------------- */

/**
 * 选中时的果冻挤压回弹：scaleX 1→1.18→0.94→1 / scaleY 1→0.82→1.06→1。
 * `active` 由 false → true 时播放一次；减弱动效下静止。
 */
export function Jelly({ active, style, children }: { active: boolean; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const sx = useRef(new Animated.Value(1)).current;
  const sy = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active || reduced) {
      sx.setValue(1);
      sy.setValue(1);
      return;
    }
    sx.stopAnimation();
    sy.stopAnimation();
    const pair = (x: number, y: number, d: number) =>
      Animated.parallel([
        Animated.timing(sx, { toValue: x, duration: d, easing: Easing.inOut(Easing.cubic), useNativeDriver: ND }),
        Animated.timing(sy, { toValue: y, duration: d, easing: Easing.inOut(Easing.cubic), useNativeDriver: ND }),
      ]);
    const anim = Animated.sequence([pair(1.18, 0.82, 110), pair(0.94, 1.06, 120), pair(1, 1, 150)]);
    anim.start();
    return () => anim.stop();
  }, [active, reduced, sx, sy]);
  return <Animated.View style={[style, { transform: [{ scaleX: sx }, { scaleY: sy }] }]}>{children}</Animated.View>;
}

/* ---------------- 纸团删除 / 展开恢复 ---------------- */

/**
 * 行的纸团折叠动画：active 变 true 后 forward（默认）揉成纸团再回调删除，
 * reverse 时从纸团展开再回调恢复。超时兜底保证动作不丢。
 */
export function CrumpleRow({ active, reverse = false, onDone, style, children }: { active: boolean; reverse?: boolean; onDone: () => void; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(reverse ? 1 : 0)).current;
  const called = useRef(false);
  const fired = () => {
    if (called.current) return;
    called.current = true;
    onDone();
  };
  useEffect(() => {
    if (!active) return;
    if (reduced) {
      fired();
      return;
    }
    const timer = setTimeout(fired, 400);
    const anim = Animated.timing(v, {
      toValue: reverse ? 0 : 1,
      duration: reverse ? 220 : 240,
      easing: reverse ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: ND,
    });
    anim.start(({ finished }) => {
      if (finished) {
        clearTimeout(timer);
        fired();
      }
    });
    return () => {
      clearTimeout(timer);
      anim.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduced]);
  const sx = v.interpolate({ inputRange: [0, 1], outputRange: [1, reverse ? 0.6 : 0.35] });
  const sy = v.interpolate({ inputRange: [0, 1], outputRange: [1, reverse ? 0.6 : 0.3] });
  const rot = v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', reverse ? '-8deg' : '-18deg'] });
  const opacity = reverse ? 1 : v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.85, 0] });
  return <Animated.View style={[style, { opacity, transform: [{ scaleX: sx }, { scaleY: sy }, { rotate: rot }] }]}>{children}</Animated.View>;
}

/* ---------------- 入场 ---------------- */

/** 淡入 + 轻微上浮的入场动画 */
export function FadeIn({
  delay = 0,
  dy = 12,
  duration = 360,
  scaleFrom,
  style,
  children,
}: {
  delay?: number;
  dy?: number;
  duration?: number;
  scaleFrom?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const a = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { a.setValue(1); return; }
    const animation = Animated.timing(a, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: ND,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [a, delay, duration, reduced]);
  const transform: any[] = [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : dy, 0] }) }];
  if (scaleFrom != null) transform.push({ scale: a.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 1 : scaleFrom, 1] }) });
  return <Animated.View style={[style, { opacity: a, transform }]}>{children}</Animated.View>;
}

/* ---------------- 进出场状态机 ---------------- */

/**
 * 让「可见性」带上退场动画：visible 变为 false 后仍保持挂载，直到退场结束。
 * 返回 mounted（是否渲染）与 a（0→1 的进度值）。
 */
function usePresence(visible: boolean, enter: 'sheet' | 'pop') {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const a = useRef(new Animated.Value(reduced && visible ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      a.setValue(visible ? 1 : 0);
      setMounted(visible);
      return;
    }
    let animation: Animated.CompositeAnimation;
    if (visible) {
      setMounted(true);
      animation = Animated.spring(a, { toValue: 1, useNativeDriver: ND, ...SPRING[enter] });
      animation.start();
    } else {
      animation = Animated.timing(a, {
        toValue: 0,
        duration: 190,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: ND,
      });
      animation.start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    return () => animation.stop();
  }, [visible, a, enter, reduced]);

  return { mounted, a };
}

// Modals can overlap while an outgoing surface finishes its animation. Reconcile
// their background isolation together so one closing modal cannot unlock another.
const webModals: HTMLElement[] = [];
const webModalBackground = new Map<HTMLElement, { inert: boolean; hidden: string | null }>();
function reconcileModalBackground() {
  webModalBackground.forEach((prior, element) => {
    element.inert = prior.inert;
    if (prior.hidden === null) element.removeAttribute('aria-hidden');
    else element.setAttribute('aria-hidden', prior.hidden);
  });
  const top = webModals[webModals.length - 1];
  if (!top) { webModalBackground.clear(); return; }
  Array.from(document.body.children).forEach(element => {
    if (!(element instanceof HTMLElement) || element === top) return;
    if (!webModalBackground.has(element)) webModalBackground.set(element, { inert: element.inert, hidden: element.getAttribute('aria-hidden') });
    element.inert = true;
    element.setAttribute('aria-hidden', 'true');
  });
}

/** React Native Web supplies the named dialog, focus trap and Escape handling. */
export function AccessibleModal({ label, children, visible, onShow, ...props }: ModalProps & { label: string }) {
  const contentRef = useRef<View>(null);
  const restoreRef = useRef<(() => void) | null>(null);
  const frameRef = useRef<number | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const wasVisible = useRef(false);
  // Capture before children mount: an autoFocus field can move focus during commit.
  if (visible && !wasVisible.current && Platform.OS === 'web' && typeof document !== 'undefined') {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  wasVisible.current = !!visible;

  const restore = useCallback(() => {
    if (Platform.OS !== 'web') return;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    restoreRef.current?.();
    restoreRef.current = null;
    const previous = previousFocus.current;
    previousFocus.current = null;
    // RN Web's focus trap has unmounted before this frame runs.
    if (previous) requestAnimationFrame(() => { if (previous.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true }); });
  }, []);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    return restore;
  }, [visible, restore]);

  const show: NonNullable<ModalProps['onShow']> = event => {
    onShow?.(event);
    if (Platform.OS !== 'web') return;
    frameRef.current = requestAnimationFrame(() => {
      const content = contentRef.current as unknown as HTMLElement | null;
      if (!content) return;
      let portal = content;
      while (portal.parentElement && portal.parentElement !== document.body) portal = portal.parentElement;
      if (webModals.includes(portal)) return;
      webModals.push(portal);
      const focused = document.activeElement;
      const target = content.querySelector<HTMLElement>('[autofocus],input:not([disabled]),textarea:not([disabled]),[role="heading"],[role="button"],button,[tabindex="0"]');
      if (target && (!(focused instanceof Node) || !content.contains(focused))) {
        if (target.getAttribute('role') === 'heading') target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
      reconcileModalBackground();
      restoreRef.current = () => {
        const index = webModals.indexOf(portal);
        if (index >= 0) webModals.splice(index, 1);
        reconcileModalBackground();
      };
    });
  };

  return (
    <Modal {...props} visible={visible} accessibilityLabel={label} onShow={show} animationType={Platform.OS === 'web' ? 'none' : props.animationType}>
      <View ref={contentRef} style={{ flex: 1 }} accessibilityViewIsModal>{children}</View>
    </Modal>
  );
}

/* ---------------- 底部面板 ---------------- */

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  accessibilityLabel?: string;
  /** 标题右侧的自定义内容（默认是关闭按钮） */
  right?: React.ReactNode;
  children: React.ReactNode;
  /** 面板最大高度占屏幕比例 */
  maxHeight?: number;
  /** 面板内是否有输入框（iOS 上随键盘抬起） */
  keyboard?: boolean;
  /** 面板底色，默认页面底色 */
  bg?: string;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * 底部面板：遮罩淡入、面板弹簧升起，顶部把手可下拉关闭。
 * 取代 Modal 自带的 slide（遮罩会跟着面板一起滑上来）。
 */
export function BottomSheet({ visible, onClose, title, accessibilityLabel, right, children, maxHeight = 0.86, keyboard, bg, contentStyle }: BottomSheetProps) {
  const { c, t, r } = useTheme();
  const insets = useSafeAreaInsets();
  const { mounted, a } = usePresence(visible, 'sheet');
  const drag = useRef(new Animated.Value(0)).current;
  // 量到真实高度之前先按整屏高度算，保证面板第一帧一定在屏幕外
  const winH = useWindowDimensions().height;
  const [sheetH, setSheetH] = useState(winH);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (visible) drag.setValue(0);
  }, [visible, drag]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (g.dy > 96 || g.vy > 0.9) {
            closeRef.current();
          } else {
            if (prefersReducedMotion()) { drag.setValue(0); return; }
            Animated.spring(drag, { toValue: 0, useNativeDriver: ND, ...SPRING.sheet }).start();
          }
        },
        onPanResponderTerminate: () => {
          if (prefersReducedMotion()) { drag.setValue(0); return; }
          Animated.spring(drag, { toValue: 0, useNativeDriver: ND, ...SPRING.sheet }).start();
        },
      }),
    [drag],
  );

  if (!mounted) return null;

  const translateY = Animated.add(a.interpolate({ inputRange: [0, 1], outputRange: [sheetH + 32, 0] }), drag);
  const body = (
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay, opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessible={false} focusable={false} tabIndex={-1} />
      </Animated.View>
      <Animated.View
        onAccessibilityEscape={onClose}
        onLayout={e => setSheetH(e.nativeEvent.layout.height)}
        style={{
          width: '100%',
          maxWidth: 520,
          alignSelf: 'center',
          maxHeight: `${Math.round(maxHeight * 100)}%`,
          backgroundColor: bg ?? c.bg,
          borderTopLeftRadius: r(24),
          borderTopRightRadius: r(24),
          paddingBottom: Math.max(insets.bottom, 12) + 10,
          transform: [{ translateY }],
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: -6 },
          elevation: 12,
        }}
      >
        <View {...pan.panHandlers} style={{ paddingTop: 8, paddingBottom: title ? 6 : 10 }}>
          <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: c.border }} />
          {!!title && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 14 }}>
              <Text accessibilityRole="header" style={[t.h2, { flex: 1, marginRight: 12 }]}>{title}</Text>
              {right ?? (
                <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="关闭" style={{ width: 44, height: 44, margin: -10, alignItems: 'center', justifyContent: 'center' }}>
                  <X size={20} color={c.textSub} />
                </Pressable>
              )}
            </View>
          )}
        </View>
        <View style={[{ flexShrink: 1, paddingHorizontal: 22, paddingTop: 8 }, contentStyle]}>{children}</View>
      </Animated.View>
    </View>
  );

  return (
    <AccessibleModal label={accessibilityLabel ?? title ?? "操作面板"} visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {keyboard ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </AccessibleModal>
  );
}

/* ---------------- 居中弹窗 ---------------- */

/** 居中弹窗：遮罩淡入、卡片带弹簧轻微放大出现 */
export function PopDialog({
  visible,
  onClose,
  children,
  maxWidth = 380,
  inset = 20,
  accessibilityLabel = "确认操作",
  style,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
  accessibilityLabel?: string;
  /** 弹窗距屏幕边缘的留白 */
  inset?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, r } = useTheme();
  const { mounted, a } = usePresence(visible, 'pop');
  if (!mounted) return null;
  return (
    <AccessibleModal label={accessibilityLabel} visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: inset }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay, opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessible={false} focusable={false} tabIndex={-1} />
        </Animated.View>
        <Animated.View
          onAccessibilityEscape={onClose}
          style={[
            {
              width: '100%',
              maxWidth,
              maxHeight: '100%',
              flexShrink: 1,
              backgroundColor: c.card,
              borderRadius: r(20),
              padding: 22,
              opacity: a.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
              transform: [
                { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
                { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
              ],
              shadowColor: '#000',
              shadowOpacity: 0.16,
              shadowRadius: 28,
              shadowOffset: { width: 0, height: 12 },
              elevation: 10,
            },
            style,
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </AccessibleModal>
  );
}

/* ---------------- 数字滚动 ---------------- */

/**
 * 数字滚动：值变化时从旧值滚到新值（约 0.7s 缓出），首次挂载从 0 滚起。
 * 系统开启「减弱动态效果」时直接到位。返回应显示的整数。
 */
export function useCountUp(target: number, duration = 700): number {
  const reduced = useReducedMotion();
  const a = useRef(new Animated.Value(target)).current;
  const [val, setVal] = useState(target);
  const prev = useRef(target);
  const lastStepAt = useRef(0);
  useEffect(() => {
    if (reduced) {
      a.stopAnimation();
      prev.current = target;
      setVal(target);
      return;
    }
    const from = prev.current;
    prev.current = target;
    if (from === target) return;
    a.setValue(from);
    let lastShown = from;
    lastStepAt.current = 0;
    const id = a.addListener(({ value }) => {
      const next = Math.round(value);
      const now = Date.now();
      if (next === lastShown || now - lastStepAt.current < 32) return;
      lastShown = next;
      lastStepAt.current = now;
      setVal(next);
    });
    const animation = Animated.timing(a, {
      toValue: target,
      duration: Math.min(duration, 280),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
      isInteraction: false,
    });
    animation.start(({ finished }) => {
      if (finished) setVal(target);
    });
    return () => {
      a.removeListener(id);
      animation.stop();
    };
  }, [target, duration, reduced, a]);
  return reduced ? target : val;
}
