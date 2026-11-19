import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
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

let reduceMotion = false;
try {
  void AccessibilityInfo.isReduceMotionEnabled?.()
    .then(v => {
      reduceMotion = !!v;
    })
    .catch(() => undefined);
  AccessibilityInfo.addEventListener?.('reduceMotionChanged', v => {
    reduceMotion = !!v;
  });
} catch {
  reduceMotion = false;
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
  const v = useRef(new Animated.Value(0)).current;
  const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
  const { transform, ...restStyle } = flat;
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, scaleTo] });
  const run = (to: number) => {
    Animated.spring(v, { toValue: to, useNativeDriver: ND, ...(to ? SPRING.press : SPRING.release) }).start();
  };
  return (
    <AnimatedPressable
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
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, {
      toValue: 1,
      duration: reduceMotion ? 1 : duration,
      delay: reduceMotion ? 0 : delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: ND,
    }).start();
  }, [a, delay, duration]);
  const transform: any[] = [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 0 : dy, 0] }) }];
  if (scaleFrom != null) transform.push({ scale: a.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 1 : scaleFrom, 1] }) });
  return <Animated.View style={[style, { opacity: a, transform }]}>{children}</Animated.View>;
}

/* ---------------- 进出场状态机 ---------------- */

/**
 * 让「可见性」带上退场动画：visible 变为 false 后仍保持挂载，直到退场结束。
 * 返回 mounted（是否渲染）与 a（0→1 的进度值）。
 */
function usePresence(visible: boolean, enter: 'sheet' | 'pop') {
  const [mounted, setMounted] = useState(visible);
  const a = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (reduceMotion) {
        a.setValue(1);
        return;
      }
      Animated.spring(a, { toValue: 1, useNativeDriver: ND, ...SPRING[enter] }).start();
    } else {
      Animated.timing(a, {
        toValue: 0,
        duration: reduceMotion ? 1 : 190,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: ND,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, a, enter]);

  return { mounted, a };
}

/* ---------------- 底部面板 ---------------- */

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
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
export function BottomSheet({ visible, onClose, title, right, children, maxHeight = 0.86, keyboard, bg, contentStyle }: BottomSheetProps) {
  const { c, t } = useTheme();
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
            Animated.spring(drag, { toValue: 0, useNativeDriver: ND, ...SPRING.sheet }).start();
          }
        },
        onPanResponderTerminate: () => {
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
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="关闭面板" />
      </Animated.View>
      <Animated.View
        onLayout={e => setSheetH(e.nativeEvent.layout.height)}
        style={{
          width: '100%',
          maxWidth: 520,
          alignSelf: 'center',
          maxHeight: `${Math.round(maxHeight * 100)}%`,
          backgroundColor: bg ?? c.bg,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
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
              <Text style={[t.h2, { flexShrink: 1 }]} numberOfLines={1}>{title}</Text>
              {right ?? (
                <Pressable hitSlop={12} onPress={onClose} accessibilityLabel="关闭">
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
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {keyboard ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </Modal>
  );
}

/* ---------------- 居中弹窗 ---------------- */

/** 居中弹窗：遮罩淡入、卡片带弹簧轻微放大出现 */
export function PopDialog({
  visible,
  onClose,
  children,
  maxWidth = 340,
  inset = 32,
  style,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
  /** 弹窗距屏幕边缘的留白 */
  inset?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const { mounted, a } = usePresence(visible, 'pop');
  if (!mounted) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: inset }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay, opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="关闭弹窗" />
        </Animated.View>
        <Animated.View
          style={[
            {
              width: '100%',
              maxWidth,
              backgroundColor: c.card,
              borderRadius: 20,
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
    </Modal>
  );
}
