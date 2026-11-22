import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from './text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, CheckCircle2, CloudOff, Lock, Trash2, XCircle, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { contrastRatio } from '../theme/tokens';
import { haptic } from './ui';
import { BottomSheet, ND, PopDialog, PressableScale, SPRING, useReducedMotion } from './motion';

export type ToastType = 'success' | 'warning' | 'error' | 'offline' | 'denied' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  icon?: 'danger' | 'warning' | 'none';
}

export interface SheetOption {
  label: string;
  icon?: LucideIcon;
  destructive?: boolean;
  onPress?: () => void;
}

interface Feedback {
  toast: (title: string, opts?: { type?: ToastType; message?: string; action?: { label: string; onPress: () => void } }) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  sheet: (options: SheetOption[], title?: string) => void;
}

const Ctx = createContext<Feedback | null>(null);

export function useFeedback() {
  const f = useContext(Ctx);
  if (!f) throw new Error('FeedbackProvider missing');
  return f;
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [sheet, setSheet] = useState<{ options: SheetOption[]; title?: string } | null>(null);
  const seq = useRef(0);
  const pendingConfirm = useRef<((value: boolean) => void) | null>(null);
  useEffect(() => () => { pendingConfirm.current?.(false); }, []);

  const showToast = useCallback<Feedback['toast']>((title, opts) => {
    seq.current += 1;
    const type = opts?.type ?? 'success';
    if (type === 'success') haptic('success');
    if (type === 'error' || type === 'warning') haptic('warning');
    setToast({ id: seq.current, type, title, message: opts?.message, action: opts?.action });
  }, []);

  const confirm = useCallback<Feedback['confirm']>(opts => new Promise<boolean>(resolve => {
    // Replacing a dialog must settle its promise, otherwise the previous action stays suspended.
    pendingConfirm.current?.(false);
    pendingConfirm.current = resolve;
    setDialog({ ...opts, resolve });
  }), []);
  const closeConfirm = useCallback((value: boolean) => {
    const resolve = pendingConfirm.current;
    pendingConfirm.current = null;
    setDialog(null);
    resolve?.(value);
  }, []);
  const showSheet = useCallback<Feedback['sheet']>((options, title) => setSheet({ options, title }), []);

  const value = React.useMemo(() => ({ toast: showToast, confirm, sheet: showSheet }), [showToast, confirm, showSheet]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {toast && <ToastView key={toast.id} item={toast} onDone={() => setToast(t => (t?.id === toast.id ? null : t))} />}
      <ConfirmDialog
        data={dialog}
        onClose={closeConfirm}
      />
      <ActionSheet data={sheet} onClose={() => setSheet(null)} />
    </Ctx.Provider>
  );
}

const TOAST_META: Record<ToastType, { icon: LucideIcon; key: 'success' | 'warning' | 'danger' | 'textSub' | 'primary' }> = {
  success: { icon: CheckCircle2, key: 'success' },
  warning: { icon: AlertCircle, key: 'warning' },
  error: { icon: XCircle, key: 'danger' },
  offline: { icon: CloudOff, key: 'textSub' },
  denied: { icon: Lock, key: 'primary' },
  info: { icon: AlertCircle, key: 'primary' },
};

function ToastView({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const { c, fs, r } = useTheme();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const a = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (reduced) a.setValue(1);
    else Animated.spring(a, { toValue: 1, useNativeDriver: ND, ...SPRING.pop }).start();
    const delay = item.action ? 6000 : item.message ? 3600 : 2600;
    const t = setTimeout(() => {
      if (reduced) { doneRef.current(); return; }
      Animated.timing(a, { toValue: 0, duration: 180, useNativeDriver: ND }).start(({ finished }) => { if (finished) doneRef.current(); });
    }, delay);
    return () => { clearTimeout(t); a.stopAnimation(); };
  }, [a, item, reduced]);
  const meta = TOAST_META[item.type];
  const color = c[meta.key];
  const Icon = meta.icon;
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      pointerEvents={item.action ? 'box-none' : 'none'}
      style={{
        position: 'absolute', left: 20, right: 20, top: insets.top + 56, alignItems: 'center', zIndex: 100,
        opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
        transform: [
          { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : -12, 0] }) },
          { scale: a.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 1 : 0.98, 1] }) },
        ],
      }}
    >
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: r(16), paddingVertical: 12, paddingHorizontal: 16,
          maxWidth: 440, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6,
          borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider,
        }}
      >
        <Icon size={22} color={color} strokeWidth={1.8} />
        <View style={{ marginLeft: 10, flexShrink: 1 }}>
          <Text style={{ fontSize: fs(14), color: c.text, fontWeight: '600' }}>{item.title}</Text>
          {!!item.message && <Text style={{ fontSize: fs(12), color: c.textSub, marginTop: 2, lineHeight: fs(12) * 1.5 }}>{item.message}</Text>}
        </View>
        {item.action && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onDone();
              item.action?.onPress();
            }}
            style={{ marginLeft: 12, paddingHorizontal: 12, paddingVertical: 6, minHeight: 40, justifyContent: 'center', borderRadius: r(999), backgroundColor: c.bgDeep, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border }}
          >
            <Text style={{ fontSize: fs(12), color: c.text, fontWeight: '500' }}>{item.action.label}</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

function ConfirmDialog({ data, onClose }: { data: (ConfirmOptions & { resolve: (v: boolean) => void }) | null; onClose: (v: boolean) => void }) {
  const { c, t, fs, r } = useTheme();
  const { width } = useWindowDimensions();
  const stacked = width < 380 || fs(14) > 16;
  // 关闭动画期间仍需要显示上一份内容
  const last = useRef(data);
  if (data) last.current = data;
  const shown = data ?? last.current;
  return (
    <PopDialog accessibilityLabel={shown?.title ?? '确认操作'} visible={!!data} onClose={() => onClose(false)} style={{ paddingTop: 24 }}>
      <ScrollView style={{ flexShrink: 1 }}>
      {shown?.icon === 'danger' && (
        <View style={{ alignSelf: 'center', width: 48, height: 48, borderRadius: 24, backgroundColor: c.dangerSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <Trash2 size={22} color={c.danger} />
        </View>
      )}
      {shown?.icon === 'warning' && (
        <View style={{ alignSelf: 'center', width: 48, height: 48, borderRadius: 24, backgroundColor: c.warningSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <AlertCircle size={22} color={c.warning} />
        </View>
      )}
      <Text accessibilityRole="header" style={[t.h3, { textAlign: 'center', fontSize: fs(17) }]}>{shown?.title}</Text>
      {!!shown?.message && <Text style={[t.sub, { textAlign: 'center', marginTop: 10 }]}>{shown.message}</Text>}
      </ScrollView>
      <View style={{ flexDirection: stacked ? 'column' : 'row', gap: 12, marginTop: 22 }}>
        <PressableScale onPress={() => onClose(false)} style={{ flex: stacked ? undefined : 1, minHeight: 46, paddingVertical: 10, paddingHorizontal: 12, borderRadius: r(999), borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: c.textSub, fontSize: fs(14) }}>{shown?.cancelText ?? '取消'}</Text>
        </PressableScale>
        <PressableScale
          onPress={() => onClose(true)}
          style={{ flex: stacked ? undefined : 1, minHeight: 46, paddingVertical: 10, paddingHorizontal: 12, borderRadius: r(999), backgroundColor: shown?.destructive ? c.danger : c.primary, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: shown?.destructive ? (contrastRatio('#FFFFFF', c.danger) >= 4.5 ? '#FFFFFF' : '#161616') : c.textOnPrimary, fontSize: fs(14), fontWeight: '600' }}>{shown?.confirmText ?? '确定'}</Text>
        </PressableScale>
      </View>
    </PopDialog>
  );
}

function ActionSheet({ data, onClose }: { data: { options: SheetOption[]; title?: string } | null; onClose: () => void }) {
  const { c, fs, r } = useTheme();
  const reduced = useReducedMotion();
  const last = useRef(data);
  if (data) last.current = data;
  const shown = data ?? last.current;
  return (
    <BottomSheet accessibilityLabel={shown?.title ?? '日记操作'} visible={!!data} onClose={onClose} contentStyle={{ paddingHorizontal: 12, paddingTop: 0 }}>
      {!!shown?.title && <Text accessibilityRole="header" style={{ textAlign: 'center', color: c.textSub, fontSize: fs(13), marginBottom: 10, paddingHorizontal: 12 }}>{shown.title}</Text>}
      <ScrollView style={{ flexShrink: 1, backgroundColor: c.card, borderRadius: r(16), overflow: 'hidden' }}>
        {shown?.options.map((o, i) => (
          <Pressable
            accessibilityRole="button"
            key={o.label}
            onPress={() => {
              haptic('light');
              onClose();
              setTimeout(() => o.onPress?.(), reduced ? 0 : 200);
            }}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 54, paddingVertical: 14, paddingHorizontal: 16,
              borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderColor: c.divider, backgroundColor: pressed ? c.cardAlt : 'transparent',
            })}
          >
            {o.icon && <o.icon size={18} color={o.destructive ? c.danger : c.text} strokeWidth={1.7} style={{ marginRight: 8 }} />}
            <Text style={{ flexShrink: 1, textAlign: 'center', fontSize: fs(15), color: o.destructive ? c.danger : c.text }}>{o.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <PressableScale scaleTo={0.985} onPress={onClose} style={{ marginTop: 10, minHeight: 52, borderRadius: r(16), backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: fs(15), color: c.textSub }}>取消</Text>
      </PressableScale>
    </BottomSheet>
  );
}
