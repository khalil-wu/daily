import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  StyleSheet,
  Text,
  type TextProps,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
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
import { useStyles, useTheme, type Theme } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { photoSource } from '../data/assets';
import { usePhotoUri } from '../utils/usePhotoUri';
import { ND, PressableScale, SPRING, prefersReducedMotion } from './motion';

export const haptic = (kind: 'light' | 'medium' | 'success' | 'warning' = 'light') => {
  if (Platform.OS === 'web') return;
  try {
    if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (kind === 'warning') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else void Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  } catch {}
};

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
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
    <Pressable hitSlop={12} onPress={onBack} style={{ padding: 4, marginLeft: -6 }} accessibilityLabel="返回">
      <ChevronLeft size={24} color={c.text} strokeWidth={1.8} />
    </Pressable>
  ) : null);
  if (variant === 'large') {
    return (
      <View style={[{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14 }, style]}>
        <View style={{ height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>{leftNode}</View>
          <View>{right}</View>
        </View>
        {!!title && <Text style={[t.h1, { fontSize: t.h1.fontSize! + 2, marginTop: 6 }]}>{title}</Text>}
        {!!subtitle && <T v="sub" style={{ marginTop: 6 }}>{subtitle}</T>}
      </View>
    );
  }
  return (
    <View style={[{ height: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }, style]}>
      <View style={{ minWidth: 64, alignItems: 'flex-start' }}>{leftNode}</View>
      <View style={{ flex: 1, alignItems: variant === 'plain' ? 'flex-start' : 'center' }}>
        {!!title && (
          <Text numberOfLines={1} style={[t.h3, { fontSize: t.h3.fontSize! + 1 }]}>
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
    <Pressable hitSlop={10} onPress={onPress} disabled={disabled} style={{ paddingVertical: 4 }}>
      <Text style={{ fontSize: fs(15), color: disabled ? c.textMuted : color ?? c.textSub, fontWeight: bold ? '600' : '400' }}>{label}</Text>
    </Pressable>
  );
}

/** 胶囊主按钮（导航栏右侧 “发布”） */
export function PillAction({ label, onPress, disabled }: { label: string; onPress?: () => void; disabled?: boolean }) {
  const { c, fs } = useTheme();
  return (
    <PressableScale
      scaleTo={0.94}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={{
        backgroundColor: disabled ? c.primarySoft : c.primary,
        paddingHorizontal: 14,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: c.textOnPrimary, fontSize: fs(14), fontWeight: '600' }}>{label}</Text>
    </PressableScale>
  );
}

export function IconButton({ icon: Icon, onPress, size = 22, color, style, label, badge }: { icon: LucideIcon; onPress?: () => void; size?: number; color?: string; style?: StyleProp<ViewStyle>; label?: string; badge?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityLabel={label} hitSlop={8} onPress={onPress} style={({ pressed }) => [{ padding: 6, opacity: pressed ? 0.6 : 1 }, style]}>
      <Icon size={size} color={color ?? c.text} strokeWidth={1.7} />
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

export function Button({ title, onPress, variant = 'primary', size = 'lg', icon: Icon, loading, disabled, style, full = true }: ButtonProps) {
  const { c, fs } = useTheme();
  const h = size === 'lg' ? 48 : size === 'md' ? 40 : 32;
  const palette = {
    primary: { bg: c.primary, fg: c.textOnPrimary, bd: c.primary },
    secondary: { bg: c.card, fg: c.text, bd: c.border },
    outline: { bg: 'transparent', fg: c.primary, bd: c.primary },
    ghost: { bg: 'transparent', fg: c.textSub, bd: 'transparent' },
    danger: { bg: c.danger, fg: c.textOnPrimary, bd: c.danger },
    soft: { bg: c.primaryFaint, fg: c.primaryDark, bd: c.primarySoft },
  }[variant];
  const off = disabled || loading;
  return (
    <PressableScale
      scaleTo={0.97}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      onPress={() => {
        haptic('light');
        onPress?.();
      }}
      style={[
        {
          height: h,
          borderRadius: h / 2,
          backgroundColor: palette.bg,
          borderWidth: variant === 'ghost' ? 0 : StyleSheet.hairlineWidth * 2,
          borderColor: palette.bd,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: size === 'sm' ? 14 : 22,
          alignSelf: full ? 'stretch' : 'center',
          opacity: off ? 0.55 : 1,
        },
        variant === 'primary' && !off ? { shadowColor: c.primaryDark, shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} size="small" />
      ) : (
        <>
          {Icon && <Icon size={size === 'sm' ? 15 : 18} color={palette.fg} strokeWidth={1.8} style={{ marginRight: 6 }} />}
          <Text style={{ color: palette.fg, fontSize: fs(size === 'sm' ? 13 : 15), fontWeight: '600', letterSpacing: 1 }}>{title}</Text>
        </>
      )}
    </PressableScale>
  );
}

/* ============ 卡片 / 分组 ============ */

export function Card({ children, style, onPress, padded = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; padded?: boolean }) {
  const s = useStyles(cardStyles);
  if (onPress) {
    return (
      <PressableScale scaleTo={0.98} onPress={onPress} style={[s.card, padded && s.pad, style]}>
        {children}
      </PressableScale>
    );
  }
  return <View style={[s.card, padded && s.pad, style]}>{children}</View>;
}

const cardStyles = ({ c, dark, r, look }: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: r(radius.lg),
      // 圆润风格（温润 / 樱雾）用极细描边 + 柔和投影；利落风格（清冷 / 墨白 / 旧纸）改用清晰的线
      borderWidth: look.flat ? 1 : dark ? 0 : StyleSheet.hairlineWidth,
      borderColor: look.flat ? c.border : c.divider,
      shadowColor: c.shadow,
      shadowOpacity: dark || look.flat ? 0 : 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 3 },
      elevation: dark || look.flat ? 0 : 1,
    },
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
      {!!title && <Text style={{ fontSize: fs(13), color: c.textSub, marginBottom: 8, marginLeft: 4, fontWeight: '500' }}>{title}</Text>}
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
  const { c, fs } = useTheme();
  const showChevron = chevron ?? (!!onPress && !right && checked === undefined);
  return (
    <Pressable
      disabled={!onPress || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: subtitle ? 13 : 15, backgroundColor: pressed ? c.cardAlt : 'transparent', opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      {Icon && <Icon size={20} color={danger ? c.danger : iconColor ?? c.text} strokeWidth={1.6} style={{ marginRight: 14 }} />}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: fs(15), color: danger ? c.danger : c.text }}>{title}</Text>
        {!!subtitle && <Text style={{ fontSize: fs(12), color: c.textSub, marginTop: 3, lineHeight: fs(12) * 1.5 }}>{subtitle}</Text>}
      </View>
      {!!value && <Text style={{ fontSize: fs(13), color: c.textSub, marginLeft: 8, maxWidth: 170 }} numberOfLines={1}>{value}</Text>}
      {right}
      {checked !== undefined && (checked ? <Check size={18} color={c.primary} strokeWidth={2.2} /> : <View style={{ width: 18 }} />)}
      {showChevron && <ChevronRight size={18} color={c.textMuted} style={{ marginLeft: 4 }} />}
    </Pressable>
  );
}

/* ============ 开关 ============ */

export function Switch({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const { c, dark } = useTheme();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value ? 1 : 0, duration: 180, useNativeDriver: false }).start();
  }, [value, anim]);
  const bg = anim.interpolate({ inputRange: [0, 1], outputRange: [dark ? '#4A423B' : '#E3DCD3', c.primary] });
  const x = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        haptic('light');
        onChange(!value);
      }}
      hitSlop={8}
      style={{ opacity: disabled ? 0.5 : 1 }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <Animated.View style={{ width: 46, height: 26, borderRadius: 13, backgroundColor: bg, justifyContent: 'center' }}>
        <Animated.View
          style={{
            width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', transform: [{ translateX: x }],
            shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2,
          }}
        />
      </Animated.View>
    </Pressable>
  );
}

/* ============ 选项卡 ============ */

/** 灰底白块分段控件（时间线 / 年度 / 那年今日）—— 白块随选中项滑动 */
export function Segmented<K extends string>({ items, value, onChange, style }: { items: { key: K; label: string }[]; value: K; onChange: (k: K) => void; style?: StyleProp<ViewStyle> }) {
  const { c, fs, dark } = useTheme();
  const [w, setW] = useState(0);
  const idx = Math.max(0, items.findIndex(it => it.key === value));
  const pos = useRef(new Animated.Value(idx)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current || prefersReducedMotion()) {
      first.current = false;
      pos.setValue(idx);
      return;
    }
    Animated.spring(pos, { toValue: idx, useNativeDriver: ND, ...SPRING.slide }).start();
  }, [idx, pos]);

  const itemW = w > 0 ? (w - 6) / Math.max(1, items.length) : 0;
  const translateX = items.length > 1
    ? pos.interpolate({ inputRange: [0, items.length - 1], outputRange: [0, itemW * (items.length - 1)] })
    : 0;

  return (
    <View
      onLayout={e => setW(e.nativeEvent.layout.width)}
      style={[{ flexDirection: 'row', backgroundColor: dark ? c.cardAlt : '#F0EAE2', borderRadius: 12, padding: 3 }, style]}
    >
      {itemW > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', left: 3, top: 3, bottom: 3, width: itemW, borderRadius: 10, backgroundColor: c.card,
            shadowColor: c.shadow, shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
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
            onPress={() => {
              if (!on) haptic('light');
              onChange(it.key);
            }}
            style={{ flex: 1, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on && itemW === 0 ? c.card : 'transparent' }}
          >
            <Text style={{ fontSize: fs(13), color: on ? c.primaryDark : c.textSub, fontWeight: on ? '600' : '400' }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 下划线标签栏（全部 / 日记 / 草稿 / 收藏 / 置顶）—— 下划线随选中项滑动 */
export function UnderlineTabs<K extends string>({ items, value, onChange, style }: { items: { key: K; label: string; count?: number }[]; value: K; onChange: (k: K) => void; style?: StyleProp<ViewStyle> }) {
  const { c, fs } = useTheme();
  const [layouts, setLayouts] = useState<Record<string, { x: number; w: number }>>({});
  const x = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  const cur = layouts[value];
  const curX = cur ? cur.x + (cur.w - 16) / 2 : null;

  useEffect(() => {
    if (curX == null) return;
    if (!placed.current || prefersReducedMotion()) {
      placed.current = true;
      x.setValue(curX);
      return;
    }
    Animated.spring(x, { toValue: curX, useNativeDriver: ND, ...SPRING.slide }).start();
  }, [curX, x]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[{ flexGrow: 0 }, style]} contentContainerStyle={{ gap: 22, paddingRight: 8 }}>
      {items.map(it => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            hitSlop={6}
            onLayout={e => {
              const { x: lx, width } = e.nativeEvent.layout;
              setLayouts(prev => (prev[it.key]?.x === lx && prev[it.key]?.w === width ? prev : { ...prev, [it.key]: { x: lx, w: width } }));
            }}
            onPress={() => {
              if (!on) haptic('light');
              onChange(it.key);
            }}
            style={{ paddingVertical: 8, alignItems: 'center' }}
          >
            <Text style={{ fontSize: fs(14), color: on ? c.text : c.textSub, fontWeight: on ? '600' : '400' }}>
              {it.label}
              {it.count ? ` ${it.count}` : ''}
            </Text>
            <View style={{ marginTop: 6, height: 2.5, width: 16, borderRadius: 2, backgroundColor: on && curX == null ? c.primary : 'transparent' }} />
          </Pressable>
        );
      })}
      {curX != null && (
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, bottom: 8, width: 16, height: 2.5, borderRadius: 2, backgroundColor: c.primary, transform: [{ translateX: x }] }}
        />
      )}
    </ScrollView>
  );
}

/* ============ 标签 Chip ============ */

export function Chip({ label, icon: Icon, selected, onPress, onRemove, color, bg, style, size = 'md' }: { label: string; icon?: LucideIcon | React.ReactNode; selected?: boolean; onPress?: () => void; onRemove?: () => void; color?: string; bg?: string; style?: StyleProp<ViewStyle>; size?: 'sm' | 'md' }) {
  const { c, fs } = useTheme();
  const fg = color ?? (selected ? c.primaryDark : c.textSub);
  const iconNode = typeof Icon === 'function' || (Icon && typeof Icon === 'object' && 'render' in (Icon as object))
    ? React.createElement(Icon as LucideIcon, { size: size === 'sm' ? 12 : 14, color: fg, strokeWidth: 1.8 })
    : (Icon as React.ReactNode);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[
        {
          flexDirection: 'row', alignItems: 'center', gap: 4,
          paddingHorizontal: size === 'sm' ? 8 : 12, height: size === 'sm' ? 24 : 32, borderRadius: 999,
          backgroundColor: bg ?? (selected ? c.primaryFaint : c.card),
          borderWidth: StyleSheet.hairlineWidth * 2, borderColor: selected ? c.primary : c.divider,
        },
        style,
      ]}
    >
      {iconNode}
      <Text style={{ fontSize: fs(size === 'sm' ? 11 : 13), color: fg }}>{label}</Text>
      {onRemove && (
        <Pressable hitSlop={8} onPress={onRemove}>
          <X size={12} color={fg} />
        </Pressable>
      )}
    </Pressable>
  );
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
  const { c, fs } = useTheme();
  const [hide, setHide] = useState(true);
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ marginBottom: 12 }, containerStyle]}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: 14, paddingHorizontal: 14,
          backgroundColor: c.inputBg, borderWidth: 1, borderColor: error ? c.danger : focus ? c.primary : 'transparent',
        }}
      >
        {Icon && <Icon size={18} color={c.textMuted} strokeWidth={1.6} style={{ marginRight: 10 }} />}
        <TextInput
          placeholderTextColor={c.textMuted}
          secureTextEntry={secure && hide}
          onFocus={e => { setFocus(true); rest.onFocus?.(e); }}
          onBlur={e => { setFocus(false); rest.onBlur?.(e); }}
          style={[{ flex: 1, fontSize: fs(15), color: c.text, paddingVertical: 0, outlineStyle: 'none' } as any, style]}
          {...rest}
        />
        {secure && (
          <Pressable hitSlop={10} onPress={() => setHide(h => !h)}>
            {hide ? <EyeOff size={18} color={c.textMuted} /> : <Eye size={18} color={c.textMuted} />}
          </Pressable>
        )}
        {right}
      </View>
      {!!error && <Text style={{ color: c.danger, fontSize: fs(12), marginTop: 6, marginLeft: 6 }}>{error}</Text>}
    </View>
  );
}

export function SearchBar({ value, onChangeText, placeholder = '搜索日记、关键词或内容…', onSubmit, autoFocus, style, editable = true, onPress }: { value?: string; onChangeText?: (t: string) => void; placeholder?: string; onSubmit?: () => void; autoFocus?: boolean; style?: StyleProp<ViewStyle>; editable?: boolean; onPress?: () => void }) {
  const { c, fs } = useTheme();
  const content = (
    <View style={[{ flexDirection: 'row', alignItems: 'center', height: 40, borderRadius: 20, paddingHorizontal: 14, backgroundColor: c.inputBg }, style]}>
      <Search size={16} color={c.textMuted} />
      {editable ? (
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.textMuted}
          autoFocus={autoFocus}
          returnKeyType="search"
          onSubmitEditing={onSubmit}
          style={{ flex: 1, marginLeft: 8, fontSize: fs(14), color: c.text, paddingVertical: 0, outlineStyle: 'none' } as any}
        />
      ) : (
        <Text style={{ flex: 1, marginLeft: 8, fontSize: fs(14), color: c.textMuted }}>{placeholder}</Text>
      )}
      {!!value && editable && (
        <Pressable hitSlop={10} onPress={() => onChangeText?.('')} style={{ backgroundColor: c.textMuted, borderRadius: 9, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
          <X size={11} color={c.card} strokeWidth={3} />
        </Pressable>
      )}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}

/* ============ 勾选 ============ */

export function Checkbox({ checked, onChange, size = 18 }: { checked: boolean; onChange?: (v: boolean) => void; size?: number }) {
  const { c } = useTheme();
  return (
    <Pressable hitSlop={8} onPress={() => onChange?.(!checked)} style={{ width: size, height: size, borderRadius: 5, borderWidth: 1.5, borderColor: checked ? c.primary : c.textMuted, backgroundColor: checked ? c.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {checked && <Check size={size - 6} color="#fff" strokeWidth={3} />}
    </Pressable>
  );
}

export function Radio({ checked, size = 20 }: { checked: boolean; size?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: checked ? c.primary : c.textMuted, alignItems: 'center', justifyContent: 'center' }}>
      {checked && <View style={{ width: size - 9, height: size - 9, borderRadius: size, backgroundColor: c.primary }} />}
    </View>
  );
}

/** 选中角标（照片多选右上角） */
export function SelectBadge({ checked, index }: { checked: boolean; index?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#fff', backgroundColor: checked ? c.primary : 'rgba(0,0,0,0.18)', alignItems: 'center', justifyContent: 'center' }}>
      {checked && (index ? <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{index}</Text> : <Check size={13} color="#fff" strokeWidth={3} />)}
    </View>
  );
}

/* ============ 其他 ============ */

export function Divider({ style, inset = 0 }: { style?: StyleProp<ViewStyle>; inset?: number }) {
  const { c } = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: c.divider, marginLeft: inset }, style]} />;
}

export function Photo({ uri, style, radius: r = 10 }: { uri?: string; style?: StyleProp<ViewStyle>; radius?: number }) {
  const { c } = useTheme();
  const resolved = usePhotoUri(uri);
  const src = photoSource(resolved);
  if (!src) return <View style={[{ backgroundColor: c.primarySoft, borderRadius: r, overflow: 'hidden' }, style]} />;
  return (
    <View style={[{ borderRadius: r, backgroundColor: c.primarySoft, overflow: 'hidden' }, style]}>
      <Image source={src} resizeMode="cover" style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} />
    </View>
  );
}

export function EmptyState({ image, title, desc, action, onAction, secondary, onSecondary, style, imageSize = 200 }: { image?: number; title: string; desc?: string; action?: string; onAction?: () => void; secondary?: string; onSecondary?: () => void; style?: StyleProp<ViewStyle>; imageSize?: number }) {
  const { c, t } = useTheme();
  return (
    <View style={[{ alignItems: 'center', paddingHorizontal: 32, paddingVertical: 24 }, style]}>
      {image != null && (
        <Image source={image} style={{ width: imageSize, height: imageSize, borderRadius: imageSize / 2, marginBottom: 12, opacity: 0.98 }} resizeMode="cover" />
      )}
      <Text style={[t.h2, { textAlign: 'center' }]}>{title}</Text>
      {!!desc && <T v="sub" center style={{ marginTop: 10 }}>{desc}</T>}
      {!!action && <Button title={action} onPress={onAction} full={false} size="md" style={{ marginTop: 22, minWidth: 150 }} />}
      {!!secondary && (
        <Pressable onPress={onSecondary} style={{ marginTop: 14 }}>
          <Text style={{ color: c.primaryDark, fontSize: 13 }}>{secondary}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Badge({ text, color, bg }: { text: string; color?: string; bg?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: bg ?? c.primaryFaint }}>
      <Text style={{ fontSize: 11, color: color ?? c.primaryDark }}>{text}</Text>
    </View>
  );
}

/** 圆角图标底座（设置项、模板等） */
export function IconTile({ icon: Icon, size = 40, color, bg, iconSize }: { icon: LucideIcon; size?: number; color?: string; bg?: string; iconSize?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: bg ?? c.primaryFaint, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={iconSize ?? size * 0.5} color={color ?? c.primaryDark} strokeWidth={1.6} />
    </View>
  );
}

export function Spacer({ h = 12, w }: { h?: number; w?: number }) {
  return <View style={{ height: h, width: w }} />;
}
