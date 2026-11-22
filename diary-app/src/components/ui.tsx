import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, type ImageSourcePropType, KeyboardAvoidingView, Platform, Pressable, type PressableProps, ScrollView, type ScrollViewProps, type StyleProp, StyleSheet, type TextStyle, View, type ViewStyle } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Text, TextInput, type TextProps, type TextInputProps } from './text';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useIllustrations, useStyles, useTheme, type Theme } from '../theme/ThemeProvider';
import { control, radius } from '../theme/tokens';
import { mixHex } from '../theme/palette';
import { photoSource, type IllustrationName } from '../data/assets';
import { usePhotoUri } from '../utils/usePhotoUri';
import { ND, PressableScale, SPRING, useReducedMotion } from './motion';

let lastHapticAt = 0;

export const haptic = (kind: 'light' | 'medium' | 'success' | 'warning' = 'light') => {
  if (Platform.OS === 'web') return;
  const now = Date.now();
  if (now - lastHapticAt < 30) return;
  lastHapticAt = now;
  try {
    if (Platform.OS === 'android') {
      const androidKind =
        kind === 'success' ? Haptics.AndroidHaptics.Confirm
        : kind === 'warning' ? Haptics.AndroidHaptics.Reject
        : kind === 'medium' ? Haptics.AndroidHaptics.Context_Click
        : Haptics.AndroidHaptics.Clock_Tick;
      void Haptics.performAndroidHapticsAsync(androidKind).catch(() => undefined);
      return;
    }
    const feedback = kind === 'success' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : kind === 'warning' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      : Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    void feedback.catch(() => undefined);
  } catch {}
};

/** RN Web handles Enter for all Pressables, but Space only for the button role. */
export function webSpaceAction(onActivate: () => void, disabled = false) {
  return Platform.OS === 'web' ? {
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget || (event.key !== ' ' && event.key !== 'Spacebar')) return;
      event.preventDefault();
      event.stopPropagation();
      if (!disabled && !event.repeat) onActivate();
    },
  } : {};
}

/* ============ 文本 ============ */

type Variant = keyof Theme['t'];
export function T({ v = 'body', color, style, center, ...rest }: TextProps & { v?: Variant; color?: string; center?: boolean }) {
  const { t } = useTheme();
  return <Text {...rest} style={[t[v], color ? { color } : null, center ? { textAlign: 'center' } : null, style]} />;
}

/* ============ 页面容器 ============ */

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  keyboard?: boolean;
  bg?: string;
  scrollProps?: ScrollViewProps;
}

export function Screen({ children, scroll, edges = ['top'], style, contentStyle, header, footer, keyboard, bg, scrollProps }: ScreenProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const maxW = 680;
  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      {...scrollProps}
      contentContainerStyle={[{ paddingHorizontal: 20, paddingBottom: 32 + (edges.includes('bottom') ? 0 : insets.bottom) }, contentStyle]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
  );
  const inner = (
    <View style={{ flex: 1, width: '100%', maxWidth: maxW, alignSelf: 'center' }}>
      {header}
      {body}
      {footer}
    </View>
  );
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: bg ?? c.bg }, style]}>
      {keyboard ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

/* ============ 导航栏 ============ */

interface NavBarProps {
  title?: string;
  subtitle?: string;
  /** center：标题居中；large：返回键下方大标题（设置类页面） */
  variant?: 'center' | 'large' | 'plain';
  back?: boolean | (() => void);
  left?: React.ReactNode;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)');
}

export function NavBar({ title, subtitle, variant = 'center', back = true, left, right, style }: NavBarProps) {
  const { c, t } = useTheme();
  const onBack = typeof back === 'function' ? back : goBack;
  const leftNode = left ?? (back ? (
    <Pressable onPress={onBack} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -10 }} accessibilityRole="button" accessibilityLabel="返回">
      <ChevronLeft size={24} color={c.text} strokeWidth={1.8} />
    </Pressable>
  ) : null);
  if (variant === 'large') {
    return (
      <View style={[{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14 }, style]}>
        <View style={{ minHeight: control.target, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>{leftNode}</View>
          <View>{right}</View>
        </View>
        {!!title && <Text style={[t.h1, { fontSize: t.h1.fontSize! + 2, marginTop: 6, letterSpacing: -0.3 }]}>{title}</Text>}
        {!!subtitle && <T v="sub" style={{ marginTop: 6 }}>{subtitle}</T>}
      </View>
    );
  }
  return (
    <View style={[{ minHeight: 56, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }, style]}>
      <View style={{ minWidth: 64, alignItems: 'flex-start' }}>{leftNode}</View>
      <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 6, alignItems: variant === 'plain' ? 'flex-start' : 'center' }}>
        {!!title && (
          <Text numberOfLines={1} style={[t.h3, { fontSize: t.h3.fontSize! + 1, textAlign: variant === 'plain' ? 'left' : 'center' }]}>
            {title}
          </Text>
        )}
        {!!subtitle && <T v="tiny" numberOfLines={1} style={{ marginTop: 2 }}>{subtitle}</T>}
      </View>
      <View style={{ minWidth: 64, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

/** 文字按钮（取消 / 发布 / 管理） */
export function TextAction({ label, onPress, color, disabled, bold }: { label: string; onPress?: () => void; color?: string; disabled?: boolean; bold?: boolean }) {
  const { c, fs } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} aria-disabled={!!disabled} hitSlop={6} onPress={onPress} disabled={disabled} style={{ minHeight: control.target, minWidth: control.target, justifyContent: 'center', paddingVertical: 6 }}>
      <Text style={{ fontSize: fs(15), color: disabled ? c.textMuted : color ?? c.textSub, fontWeight: bold ? '600' : '400' }}>{label}</Text>
    </Pressable>
  );
}

/**
 * 线绘陪伴风的「按压到墨影上」容器：底层是一块纯色的硬位移投影（underlay），
 * 面层（face）按下时整体下移 offset 贴到影子上，松开弹簧回位。
 * 用于 Button / PillAction / FAB，不要各自复制这份逻辑。
 */
export function InkPress({
  offset = 3,
  radius = 999,
  underlay,
  hold = false,
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  style,
  faceStyle,
  children,
  ...rest
}: Omit<PressableProps, 'children'> & {
  children?: React.ReactNode;
  offset?: number;
  radius?: number;
  underlay?: string;
  /** 无投影、面层常驻按下位（禁用/加载态） */
  hold?: boolean;
  faceStyle?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(hold ? 1 : 0)).current;
  useEffect(() => {
    v.setValue(hold ? 1 : 0);
    return () => v.stopAnimation();
  }, [hold, v]);
  const run = (down: boolean) => {
    if (hold) return;
    if (reduced) {
      v.setValue(down ? 1 : 0);
      return;
    }
    if (down) {
      Animated.timing(v, { toValue: 1, duration: 70, easing: Easing.out(Easing.cubic), useNativeDriver: ND }).start();
    } else {
      Animated.spring(v, { toValue: 0, useNativeDriver: ND, ...SPRING.release }).start();
    }
  };
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      {...rest}
      onPressIn={e => {
        run(true);
        onPressIn?.(e);
      }}
      onPressOut={e => {
        run(false);
        onPressOut?.(e);
      }}
      onPress={onPress}
      style={style}
    >
      <View style={{ paddingBottom: offset }}>
        {underlay != null && (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: offset, bottom: 0, borderRadius: radius, backgroundColor: underlay }} />
        )}
        <Animated.View style={[faceStyle, { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, offset] }) }] }]}>
          {children}
        </Animated.View>
      </View>
    </Pressable>
  );
}

/** 胶囊主按钮（导航栏右侧 “发布”/“完成”：保持 44px 触控热区，内层视觉高度 34px 更轻巧） */
export function PillAction({ label, onPress, disabled }: { label: string; onPress?: () => void; disabled?: boolean }) {
  const { c, fs, r, ink, dark } = useTheme();
  if (ink.on) {
    const underlay = disabled ? undefined : dark ? '#000000' : ink.line;
    return (
      <InkPress
        offset={2}
        radius={r(999)}
        underlay={underlay}
        hold={!!disabled}
        onPress={() => {
          haptic('light');
          onPress?.();
        }}
        disabled={disabled}
        accessibilityState={{ disabled: !!disabled }}
        hitSlop={6}
        style={{ minHeight: control.target, minWidth: 56, justifyContent: 'center', alignItems: 'flex-end' }}
        faceStyle={{
          minHeight: 34,
          paddingHorizontal: 15,
          paddingVertical: 6,
          borderRadius: r(999),
          backgroundColor: disabled ? c.disabledBg : c.primary,
          borderWidth: disabled ? 1.25 : 1.25,
          borderColor: disabled ? c.divider : ink.line,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: disabled ? c.disabledText : dark ? '#0B1012' : '#182326', fontSize: fs(13.5), fontWeight: '600' }}>{label}</Text>
      </InkPress>
    );
  }
  return (
    <PressableScale
      scaleTo={0.94}
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={6}
      style={{
        minHeight: control.target,
        minWidth: 56,
        justifyContent: 'center',
        alignItems: 'flex-end',
      }}
    >
      <View
        style={{
          backgroundColor: disabled ? c.disabledBg : c.primary,
          paddingHorizontal: 15,
          minHeight: 34,
          paddingVertical: 6,
          borderRadius: r(999),
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: disabled ? c.disabledText : c.textOnPrimary, fontSize: fs(13.5), fontWeight: '600' }}>{label}</Text>
      </View>
    </PressableScale>
  );
}

export function IconButton({ icon: Icon, onPress, size = 22, color, style, label, badge }: { icon: LucideIcon; onPress?: () => void; size?: number; color?: string; style?: StyleProp<ViewStyle>; label?: string; badge?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={4} onPress={onPress} style={({ pressed }) => [{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: 6, opacity: pressed ? 0.6 : 1 }, style]}>
      <Icon size={size} color={color ?? c.text} strokeWidth={1.8} />
      {badge && <View style={{ position: 'absolute', right: 5, top: 5, width: 7, height: 7, borderRadius: 4, backgroundColor: c.danger }} />}
    </Pressable>
  );
}

/* ============ 按钮 ============ */

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'soft';
  size?: 'lg' | 'md' | 'sm';
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  full?: boolean;
}

/** 线绘陪伴风按钮：矢量面层 + 硬质墨影，按下整面贴到影子上 */
function InkButton({ title, onPress, variant = 'primary', size = 'lg', icon: Icon, loading, disabled, style, full }: ButtonProps) {
  const { c, fs, r, ink, dark } = useTheme();
  const h = size === 'lg' ? 52 : size === 'md' ? 44 : 36;
  const offset = size === 'sm' ? 2 : 3;
  const off = disabled || loading;
  const conf = {
    primary: { bg: c.primary, fg: dark ? '#0B1012' : '#182326', bd: ink.line, ul: dark ? '#000000' : ink.line, bw: 1.5 },
    secondary: { bg: c.card, fg: c.text, bd: ink.line, ul: c.divider, bw: 1.5 },
    danger: { bg: c.danger, fg: c.textOnDanger, bd: ink.line, ul: dark ? '#000000' : ink.line, bw: 1.5 },
    soft: { bg: c.primaryFaint, fg: c.primaryDark, bd: 'transparent', ul: undefined, bw: 0 },
    outline: { bg: 'transparent', fg: c.primaryDark, bd: c.primaryDark, ul: undefined, bw: 1.5 },
    ghost: { bg: 'transparent', fg: c.textSub, bd: 'transparent', ul: undefined, bw: 0 },
  }[variant];
  const face: ViewStyle = {
    height: h,
    borderRadius: r(999),
    backgroundColor: off ? c.disabledBg : conf.bg,
    borderWidth: off ? (conf.bw ? 1 : 0) : conf.bw,
    borderColor: off ? c.divider : conf.bd,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: size === 'sm' ? 18 : 24,
    alignSelf: 'stretch',
  };
  const label = loading ? (
    <ActivityIndicator color={off ? c.disabledText : conf.fg} size="small" />
  ) : (
    <>
      {Icon && <Icon size={size === 'sm' ? 16 : 18} color={off ? c.disabledText : conf.fg} strokeWidth={1.8} style={{ marginRight: 7 }} />}
      <Text style={{ color: off ? c.disabledText : conf.fg, fontSize: fs(size === 'sm' ? 14 : size === 'md' ? 15 : 16), fontWeight: '600', letterSpacing: 0.3, textAlign: 'center', flexShrink: 1 }}>{title}</Text>
    </>
  );
  const a11y = {
    accessibilityLabel: title,
    accessibilityState: { disabled: !!off, busy: !!loading },
    hitSlop: size === 'sm' ? 6 : undefined,
    onPress: () => {
      haptic('light');
      onPress?.();
    },
    disabled: off,
  };
  if (!conf.ul) {
    // soft / outline / ghost / 禁用态：无投影；禁用态面层停在按下位
    return (
      <InkPress offset={off ? offset : 0} hold={off} {...a11y} style={[{ alignSelf: full ? 'stretch' : 'center' }, style]} faceStyle={face}>
        {label}
      </InkPress>
    );
  }
  return (
    <InkPress offset={offset} radius={r(999)} underlay={conf.ul} {...a11y} style={[{ alignSelf: full ? 'stretch' : 'center' }, style]} faceStyle={face}>
      {label}
    </InkPress>
  );
}

export function Button({ title, onPress, variant = 'primary', size = 'lg', icon: Icon, loading, disabled, style, full = true }: ButtonProps) {
  const { c, fs, r, look, dark, ink } = useTheme();
  if (ink.on) return <InkButton {...{ title, onPress, variant, size, icon: Icon, loading, disabled, style, full }} />;
  const h = size === 'lg' ? 50 : control.target;
  const palette = {
    primary: { bg: c.primary, fg: c.textOnPrimary, bd: c.primary },
    secondary: { bg: c.card, fg: c.text, bd: c.controlBorder },
    outline: { bg: 'transparent', fg: c.primaryDark, bd: c.primaryDark },
    ghost: { bg: 'transparent', fg: c.textSub, bd: 'transparent' },
    danger: { bg: c.danger, fg: c.textOnDanger, bd: c.danger },
    soft: { bg: c.primaryFaint, fg: c.primaryDark, bd: c.primarySoft },
  }[variant];
  const off = disabled || loading;
  return (
    <PressableScale
      scaleTo={0.97}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      hitSlop={size === 'sm' ? 6 : undefined}
      onPress={() => {
        haptic('light');
        onPress?.();
      }}
      style={[
        {
          minHeight: h,
          paddingVertical: size === 'sm' ? 8 : 10,
          borderRadius: r(999),
          backgroundColor: disabled ? c.disabledBg : palette.bg,
          borderWidth: variant === 'ghost' ? 0 : StyleSheet.hairlineWidth * 2,
          borderColor: disabled ? c.border : palette.bd,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: size === 'sm' ? 18 : 24,
          alignSelf: full ? 'stretch' : 'center',
          opacity: 1,
          position: 'relative',
        },
        variant === 'primary' && !off && !look.flat && !dark ? { shadowColor: c.primaryDark, shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={disabled ? c.disabledText : palette.fg} size="small" />
      ) : (
        <>
          {Icon && <Icon size={size === 'sm' ? 16 : 18} color={disabled ? c.disabledText : palette.fg} strokeWidth={1.85} style={{ marginRight: 7 }} />}
          <Text style={{ color: disabled ? c.disabledText : palette.fg, fontSize: fs(size === 'sm' ? 13.5 : 15), fontWeight: '600', letterSpacing: 0.3, textAlign: 'center', flexShrink: 1 }}>{title}</Text>
        </>
      )}
    </PressableScale>
  );
}

/* ============ 卡片 / 分组 ============ */

export function Card({ children, style, onPress, padded = true, hero }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; padded?: boolean; hero?: boolean }) {
  const s = useStyles(cardStyles);
  const { frameInk } = useTheme();
  const frameStyle = hero ? frameInk : undefined;
  if (onPress) {
    return (
      <PressableScale scaleTo={0.98} onPress={onPress} style={[s.card, frameStyle, padded && s.pad, style]}>
        {children}
      </PressableScale>
    );
  }
  return <View style={[s.card, frameStyle, padded && s.pad, style]}>{children}</View>;
}

const cardStyles = ({ c, r, frame }: Theme) => StyleSheet.create({
  card: { backgroundColor: c.card, borderRadius: r(radius.lg), ...frame },
  pad: { padding: 16 },
});

export function SectionTitle({ title, right, style }: { title: string; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c, fs } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 }, style]}>
      <Text style={{ fontSize: fs(13), color: c.textSub, fontWeight: '500' }}>{title}</Text>
      {right}
    </View>
  );
}

/** 设置分组：白色圆角卡片 + 行 */
export function Group({ children, title, footer, style }: { children: React.ReactNode; title?: string; footer?: string; style?: StyleProp<ViewStyle> }) {
  const { c, fs } = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {!!title && <Text style={{ fontSize: fs(12.5), letterSpacing: 0.4, color: c.textSub, marginBottom: 8, marginLeft: 6, fontWeight: '500' }}>{title}</Text>}
      <Card padded={false} style={{ overflow: 'hidden' }}>
        {items.map((child, i) => (
          <View key={i}>
            {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.divider, marginLeft: 16 }} />}
            {child}
          </View>
        ))}
      </Card>
      {!!footer && <Text style={{ fontSize: fs(12), color: c.textMuted, marginTop: 8, marginHorizontal: 4, lineHeight: fs(12) * 1.6 }}>{footer}</Text>}
    </View>
  );
}

interface RowProps {
  icon?: LucideIcon;
  iconColor?: string;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  chevron?: boolean;
  danger?: boolean;
  checked?: boolean;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export function Row({ icon: Icon, iconColor, title, subtitle, value, onPress, right, chevron, danger, checked, style, disabled }: RowProps) {
  const { c, fs, r } = useTheme();
  const showChevron = chevron ?? (!!onPress && !right && checked === undefined);
  const rightControl = React.isValidElement<React.ComponentProps<typeof Switch>>(right) && right.type === Switch
    ? React.cloneElement(right, { label: right.props.label ?? title }) : right;
  const rowStyle: ViewStyle = { minHeight: control.target, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: subtitle ? 13 : 15, opacity: disabled ? 0.5 : 1 };
  const content = <>
    {Icon && (
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: r(10),
          backgroundColor: danger ? c.dangerSoft : c.primaryFaint,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 13,
          flexShrink: 0,
        }}
      >
        <Icon size={17} color={danger ? c.danger : iconColor ?? c.primaryDark} strokeWidth={1.85} />
      </View>
    )}
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ fontSize: fs(15), color: danger ? c.danger : c.text }}>{title}</Text>
      {!!subtitle && <Text style={{ fontSize: fs(12), color: c.textSub, marginTop: 3, lineHeight: fs(19) }}>{subtitle}</Text>}
    </View>
    {!!value && <Text style={{ fontSize: fs(13), color: c.textSub, marginLeft: 10, maxWidth: '42%', flexShrink: 1, textAlign: 'right' }}>{value}</Text>}
    {rightControl && <View style={{ flexShrink: 0, marginLeft: 10 }}>{rightControl}</View>}
    {checked !== undefined && (checked ? <Check size={18} color={c.primaryDark} strokeWidth={2.2} style={{ marginLeft: 8 }} /> : <View style={{ width: 26 }} />)}
    {showChevron && <ChevronRight size={18} color={c.textMuted} style={{ marginLeft: 4, flexShrink: 0 }} />}
  </>;
  // Rows containing a Switch are layout containers. A disabled Pressable ancestor
  // incorrectly describes an enabled child control as unavailable on the web.
  return onPress ? (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, ...(checked === undefined ? {} : { selected: checked }) }}
      aria-disabled={!!disabled}
      aria-selected={checked}
      onPress={onPress}
      style={({ pressed }) => [rowStyle, { backgroundColor: pressed ? c.cardAlt : 'transparent' }, style]}
    >{content}</Pressable>
  ) : <View style={[rowStyle, style]}>{content}</View>;
}

/* ============ 开关 ============ */

export function Switch({ value, onChange, disabled, label }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { anim.setValue(value ? 1 : 0); return; }
    const animation = Animated.timing(anim, { toValue: value ? 1 : 0, duration: 160, useNativeDriver: ND });
    animation.start();
    return () => animation.stop();
  }, [value, anim, reduced]);
  const x = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        haptic('light');
        onChange(!value);
      }}
      {...webSpaceAction(() => onChange(!value), disabled)}
      hitSlop={8}
      style={{ opacity: disabled ? 0.5 : 1, minWidth: control.target, minHeight: control.target, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      aria-checked={value}
      aria-disabled={!!disabled}
    >
      <View style={{ width: 46, height: 26, borderRadius: 13, backgroundColor: value ? c.primary : c.controlBorder, justifyContent: 'center' }}>
        <Animated.View
          style={{
            width: 22, height: 22, borderRadius: 11, backgroundColor: value ? c.textOnPrimary : c.card, transform: [{ translateX: x }],
            shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2,
          }}
        />
      </View>
    </Pressable>
  );
}

/* ============ 选项卡 ============ */

/** 灰底白块分段控件（时间线 / 年度 / 那年今日）—— 白块随选中项滑动 */
export function Segmented<K extends string>({ items, value, onChange, style }: { items: { key: K; label: string }[]; value: K; onChange: (k: K) => void; style?: StyleProp<ViewStyle> }) {
  const { c, fs, r, dark, look, ink } = useTheme();
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const idx = Math.max(0, items.findIndex(it => it.key === value));
  const pos = useRef(new Animated.Value(idx)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current || reduced) {
      first.current = false;
      pos.setValue(idx);
      return;
    }
    const animation = Animated.spring(pos, { toValue: idx, useNativeDriver: ND, ...SPRING.slide });
    animation.start();
    return () => animation.stop();
  }, [idx, pos, reduced]);

  const itemW = w > 0 ? (w - 6) / Math.max(1, items.length) : 0;
  const translateX = items.length > 1
    ? pos.interpolate({ inputRange: [0, items.length - 1], outputRange: [0, itemW * (items.length - 1)] })
    : 0;

  return (
    <View
      accessibilityRole="tablist"
      onLayout={e => setW(e.nativeEvent.layout.width)}
      style={[{ flexDirection: 'row', backgroundColor: c.inputBg, borderRadius: r(12), padding: 3 }, style]}
    >
      {itemW > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', left: 3, top: 3, bottom: 3, width: itemW, borderRadius: r(10), backgroundColor: c.card,
            borderWidth: ink.on ? 1.25 : look.flat ? 1 : 0, borderColor: ink.on ? ink.line : c.border,
            shadowColor: c.shadow, shadowOpacity: dark || look.flat ? 0 : 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: dark || look.flat ? 0 : 1,
            transform: [{ translateX }],
          }}
        />
      )}
      {items.map(it => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            aria-selected={on}
            {...webSpaceAction(() => onChange(it.key))}
            onPress={() => {
              if (!on) haptic('light');
              onChange(it.key);
            }}
            style={{ flex: 1, minHeight: control.target, paddingHorizontal: 5, paddingVertical: 8, borderRadius: r(10), alignItems: 'center', justifyContent: 'center', backgroundColor: on && itemW === 0 ? c.card : 'transparent' }}
          >
            <Text style={{ fontSize: fs(13), color: on ? c.primaryDark : c.textSub, fontWeight: on ? '600' : '400', textAlign: 'center' }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 下划线标签栏（全部 / 日记 / 草稿 / 收藏 / 置顶）—— 下划线随选中项滑动 */
export function UnderlineTabs<K extends string>({ items, value, onChange, style }: { items: { key: K; label: string; count?: number }[]; value: K; onChange: (k: K) => void; style?: StyleProp<ViewStyle> }) {
  const { c, fs, ink } = useTheme();
  const reduced = useReducedMotion();
  const [layouts, setLayouts] = useState<Record<string, { x: number; w: number }>>({});
  const x = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  const cur = layouts[value];
  const curX = cur ? cur.x + (cur.w - 16) / 2 : null;

  useEffect(() => {
    if (curX == null) return;
    if (!placed.current || reduced) {
      placed.current = true;
      x.setValue(curX);
      return;
    }
    const animation = Animated.spring(x, { toValue: curX, useNativeDriver: ND, ...SPRING.slide });
    animation.start();
    return () => animation.stop();
  }, [curX, x, reduced]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[{ flexGrow: 0 }, style]} contentContainerStyle={{ gap: 22, paddingRight: 8 }}>
      {items.map(it => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            aria-selected={on}
            {...webSpaceAction(() => onChange(it.key))}
            hitSlop={6}
            onLayout={e => {
              const { x: lx, width } = e.nativeEvent.layout;
              setLayouts(prev => (prev[it.key]?.x === lx && prev[it.key]?.w === width ? prev : { ...prev, [it.key]: { x: lx, w: width } }));
            }}
            onPress={() => {
              if (!on) haptic('light');
              onChange(it.key);
            }}
            style={{ minHeight: control.target, paddingVertical: 8, justifyContent: 'center', alignItems: 'center' }}
          >
            <Text style={{ fontSize: fs(14), color: on ? c.text : c.textSub, fontWeight: on ? '600' : '400' }}>
              {it.label}
              {it.count ? ` ${it.count}` : ''}
            </Text>
            <View style={{ marginTop: 6, height: 2.5, width: 16, borderRadius: 2, backgroundColor: on && curX == null ? (ink.on ? ink.line : c.primary) : 'transparent' }} />
          </Pressable>
        );
      })}
      {curX != null && (
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, bottom: 8, width: 16, height: 2.5, borderRadius: 2, backgroundColor: ink.on ? ink.line : c.primary, transform: [{ translateX: x }] }}
        />
      )}
    </ScrollView>
  );
}

/* ============ 标签 Chip ============ */

export function Chip({ label, icon: Icon, selected, onPress, onRemove, color, bg, style, size = 'md', tone }: { label: string; icon?: LucideIcon | React.ReactNode; selected?: boolean; onPress?: () => void; onRemove?: () => void; color?: string; bg?: string; style?: StyleProp<ViewStyle>; size?: 'sm' | 'md'; /** 'soft'：已填充的取值展示，不走选中态墨线 */ tone?: 'soft' }) {
  const { c, fs, r, ink, dark } = useTheme();
  const soft = tone === 'soft';
  const fg = color ?? (soft ? c.primaryDark : ink.on ? (selected ? (dark ? c.text : ink.line) : c.textSub) : selected ? c.primaryDark : c.textSub);
  const iconNode = typeof Icon === 'function' || (Icon && typeof Icon === 'object' && 'render' in (Icon as object))
    ? React.createElement(Icon as LucideIcon, { size: size === 'sm' ? 12 : 14, color: fg, strokeWidth: 1.8 })
    : (Icon as React.ReactNode);
  const pillStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: size === 'sm' ? 10 : 12,
    minHeight: ink.on ? (size === 'sm' ? 28 : 32) : size === 'sm' ? 28 : 34,
    paddingVertical: size === 'sm' ? 4 : 5,
    borderRadius: r(999),
    backgroundColor: bg ?? (soft ? c.primaryFaint : selected ? (ink.on ? c.primarySoft : c.primaryFaint) : ink.on ? c.inputBg : c.card),
    borderWidth: soft ? 0 : ink.on ? (selected ? 1.25 : 0) : 1,
    borderColor: ink.on ? ink.line : selected ? c.primaryDark : c.divider,
  };
  const inner = (
    <View style={[pillStyle, onPress ? undefined : style]}>
      {iconNode}
      <Text style={{ fontSize: fs(size === 'sm' ? 12 : 13), color: fg, flexShrink: 1, fontWeight: soft ? '500' : ink.on && selected ? '600' : '400' }}>{label}</Text>
      {onRemove && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`移除${label}`}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginVertical: -10, marginRight: -12 }}
          onPress={event => { event.stopPropagation(); onRemove(); }}
        >
          <X size={13} color={fg} />
        </Pressable>
      )}
    </View>
  );
  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={selected === undefined ? undefined : { selected }}
      aria-selected={selected}
      style={[{ minHeight: control.target, minWidth: control.target, justifyContent: 'center' }, style]}
    >
      {inner}
    </Pressable>
  ) : inner;
}

/* ============ 输入 ============ */

interface FieldProps extends TextInputProps {
  icon?: LucideIcon;
  right?: React.ReactNode;
  secure?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  error?: string;
}

export function Field({ icon: Icon, right, secure, containerStyle, error, style, ...rest }: FieldProps) {
  const { c, fs, r } = useTheme();
  const [hide, setHide] = useState(true);
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ marginBottom: 12 }, containerStyle]}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', minHeight: 50, borderRadius: r(14), paddingHorizontal: 14,
          backgroundColor: c.inputBg, borderWidth: 1, borderColor: error ? c.danger : focus ? c.focusRing : c.controlBorder,
        }}
      >
        {Icon && <Icon size={18} color={c.textMuted} strokeWidth={1.6} style={{ marginRight: 10 }} />}
        <TextInput
          {...rest}
          accessibilityLabel={rest.accessibilityLabel ?? rest.placeholder}
          placeholderTextColor={c.textMuted}
          secureTextEntry={secure && hide}
          onFocus={e => { setFocus(true); rest.onFocus?.(e); }}
          onBlur={e => { setFocus(false); rest.onBlur?.(e); }}
          style={[{ flex: 1, minWidth: 0, minHeight: 48, fontSize: fs(15), color: c.text, paddingVertical: 10, outlineStyle: 'none' } as any, style]}
        />
        {secure && (
          <Pressable accessibilityRole="button" accessibilityLabel={hide ? '显示密码' : '隐藏密码'} onPress={() => setHide(h => !h)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 }}>
            {hide ? <EyeOff size={18} color={c.textMuted} /> : <Eye size={18} color={c.textMuted} />}
          </Pressable>
        )}
        {right}
      </View>
      {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: c.danger, fontSize: fs(12), marginTop: 6, marginLeft: 6 }}>{error}</Text>}
    </View>
  );
}

export function SearchBar({ value, onChangeText, placeholder = '搜索日记、关键词或内容…', onSubmit, autoFocus, style, editable = true, onPress }: { value?: string; onChangeText?: (t: string) => void; placeholder?: string; onSubmit?: () => void; autoFocus?: boolean; style?: StyleProp<ViewStyle>; editable?: boolean; onPress?: () => void }) {
  const { c, fs, r } = useTheme();
  const [focus, setFocus] = useState(false);
  const content = (
    <View style={[{ flexDirection: 'row', alignItems: 'center', minHeight: 44, borderRadius: r(999), paddingHorizontal: 14, backgroundColor: c.inputBg, borderWidth: 1, borderColor: focus ? c.focusRing : c.controlBorder }, style]}>
      <Search size={16} color={c.textMuted} />
      {editable ? (
        <TextInput
          accessibilityLabel="搜索日记"
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.textMuted}
          autoFocus={autoFocus}
          returnKeyType="search"
          onSubmitEditing={onSubmit}
          style={{ flex: 1, minWidth: 0, minHeight: 42, marginLeft: 8, fontSize: fs(14), color: c.text, paddingVertical: 7, outlineStyle: 'none' } as any}
        />
      ) : (
        <Text style={{ flex: 1, marginLeft: 8, fontSize: fs(14), color: c.textMuted }}>{placeholder}</Text>
      )}
      {!!value && editable && (
        <Pressable accessibilityRole="button" accessibilityLabel="清空搜索" hitSlop={12} onPress={() => onChangeText?.('')} style={{ backgroundColor: 'transparent', borderRadius: r(12), minWidth: control.target, minHeight: control.target, alignItems: 'center', justifyContent: 'center' }}>
          <X size={18} color={c.textSub} strokeWidth={2} />
        </Pressable>
      )}
    </View>
  );
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel="搜索日记" onPress={onPress}>{content}</Pressable> : content;
}

/* ============ 勾选 ============ */

export function Checkbox({ checked, onChange, size = 18 }: { checked: boolean; onChange?: (v: boolean) => void; size?: number }) {
  const { c, r } = useTheme();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked, disabled: !onChange }} aria-checked={checked} aria-disabled={!onChange} disabled={!onChange} onPress={() => onChange?.(!checked)} {...webSpaceAction(() => onChange?.(!checked), !onChange)} style={{ minWidth: control.target, minHeight: control.target, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size, height: size, borderRadius: r(5), borderWidth: 1.5, borderColor: checked ? c.primaryDark : c.controlBorder, backgroundColor: checked ? c.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {checked && <Check size={size - 6} color={c.textOnPrimary} strokeWidth={3} />}
      </View>
    </Pressable>
  );
}

export function Radio({ checked, size = 20 }: { checked: boolean; size?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: checked ? c.primaryDark : c.controlBorder, alignItems: 'center', justifyContent: 'center' }}>
      {checked && <View style={{ width: size - 9, height: size - 9, borderRadius: size, backgroundColor: c.primary }} />}
    </View>
  );
}

/** 选中角标（照片多选右上角） */
export function SelectBadge({ checked, index }: { checked: boolean; index?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#fff', backgroundColor: checked ? c.primary : 'rgba(0,0,0,0.18)', alignItems: 'center', justifyContent: 'center' }}>
      {checked && (index ? <Text style={{ color: c.textOnPrimary, fontSize: 12, fontWeight: '700' }}>{index}</Text> : <Check size={13} color={c.textOnPrimary} strokeWidth={3} />)}
    </View>
  );
}

/* ============ 其他 ============ */

export function Divider({ style, inset = 0 }: { style?: StyleProp<ViewStyle>; inset?: number }) {
  const { c } = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: c.divider, marginLeft: inset }, style]} />;
}

export function Photo({ uri, style, radius: imageRadius = 10 }: { uri?: string; style?: StyleProp<ViewStyle>; radius?: number }) {
  const { c, r } = useTheme();
  const resolved = usePhotoUri(uri);
  const src = photoSource(resolved);
  if (!src) return <View style={[{ backgroundColor: c.primarySoft, borderRadius: r(imageRadius), overflow: 'hidden' }, style]} />;
  return (
    <View style={[{ borderRadius: r(imageRadius), backgroundColor: c.primarySoft, overflow: 'hidden' }, style]}>
      <ExpoImage
        source={src as any}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={0}
        recyclingKey={typeof resolved === 'string' ? resolved : undefined}
        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
      />
    </View>
  );
}

/** 主题插画：跟随当前风格包。dark + darkPlate 的包贴上一块浅色底托，避免墨色笔触消失 */
export function Illustration({ name, size = 160, style }: { name: IllustrationName; size?: number; style?: StyleProp<ViewStyle> }) {
  const pack = useIllustrations();
  const { c, dark, ink, r } = useTheme();
  const img = (
    <ExpoImage
      source={pack[name] as any}
      style={{ width: '100%', height: '100%' }}
      contentFit="contain"
      cachePolicy="memory-disk"
      transition={0}
    />
  );
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ width: size, height: size }, style]}>
      {dark && pack.darkPlate ? (
        <View style={{ flex: 1, backgroundColor: mixHex(c.card, '#FFFFFF', 0.86), borderRadius: r(24), padding: size * 0.12, borderWidth: 1, borderColor: ink.soft }}>
          {img}
        </View>
      ) : img}
    </View>
  );
}

export function EmptyState({ image, illustration, title, desc, action, onAction, secondary, onSecondary, style, imageSize = 186 }: { image?: ImageSourcePropType; illustration?: IllustrationName; title: string; desc?: string; action?: string; onAction?: () => void; secondary?: string; onSecondary?: () => void; style?: StyleProp<ViewStyle>; imageSize?: number }) {
  const { c, t, dark } = useTheme();
  return (
    <View style={[{ alignItems: 'center', paddingHorizontal: 32, paddingVertical: 24 }, style]}>
      {illustration != null ? (
        <Illustration name={illustration} size={imageSize} style={{ marginBottom: 14 }} />
      ) : image != null && (
        <View
          style={{
            width: imageSize,
            height: imageSize,
            borderRadius: dark ? imageSize / 2 : 0,
            backgroundColor: dark ? 'rgba(236,246,247,0.92)' : 'transparent',
            padding: dark ? 14 : 0,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
          }}
        >
          <Image source={image} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        </View>
      )}
      <Text style={[t.h2, { textAlign: 'center' }]}>{title}</Text>
      {!!desc && <T v="sub" center style={{ marginTop: 10 }}>{desc}</T>}
      {!!action && <Button title={action} onPress={onAction} full={false} size="md" style={{ marginTop: 22, minWidth: 164 }} />}
      {!!secondary && (
        <Pressable accessibilityRole="button" onPress={onSecondary} style={{ marginTop: 10, minHeight: control.target, justifyContent: 'center' }}>
          <Text style={{ color: c.primaryDark, fontSize: 13 }}>{secondary}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Badge({ text, color, bg }: { text: string; color?: string; bg?: string }) {
  const { c, r, fs } = useTheme();
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: r(999), backgroundColor: bg ?? c.primaryFaint }}>
      <Text style={{ fontSize: fs(12), color: color ?? c.primaryDark }}>{text}</Text>
    </View>
  );
}

/** 圆角图标底座（设置项、模板等） */
export function IconTile({ icon: Icon, size = 40, color, bg, iconSize }: { icon: LucideIcon; size?: number; color?: string; bg?: string; iconSize?: number }) {
  const { c, r } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: r(size * 0.32),
        backgroundColor: bg ?? c.primaryFaint,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={iconSize ?? size * 0.5} color={color ?? c.primaryDark} strokeWidth={1.75} />
    </View>
  );
}

export function Spacer({ h = 12, w }: { h?: number; w?: number }) {
  return <View style={{ height: h, width: w }} />;
}
