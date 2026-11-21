import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, CheckCircle2, CloudOff, Lock, Trash2, XCircle, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { haptic } from './ui';
import { BottomSheet, ND, PopDialog, PressableScale, SPRING } from './motion';

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

  const showToast = useCallback<Feedback['toast']>((title, opts) => {
    seq.current += 1;
    const type = opts?.type ?? 'success';
    if (type === 'success') haptic('success');
    if (type === 'error' || type === 'warning') haptic('warning');
    setToast({ id: seq.current, type, title, message: opts?.message, action: opts?.action });
  }, []);

  const confirm = useCallback<Feedback['confirm']>(opts => new Promise<boolean>(resolve => setDialog({ ...opts, resolve })), []);
  const showSheet = useCallback<Feedback['sheet']>((options, title) => setSheet({ options, title }), []);

  const value = React.useMemo(() => ({ toast: showToast, confirm, sheet: showSheet }), [showToast, confirm, showSheet]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {toast && <ToastView key={toast.id} item={toast} onDone={() => setToast(t => (t?.id === toast.id ? null : t))} />}
      <ConfirmDialog
        data={dialog}
        onClose={v => {
          dialog?.resolve(v);
          setDialog(null);
        }}
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
  const { c, fs } = useTheme();
  const insets = useSafeAreaInsets();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(a, { toValue: 1, useNativeDriver: ND, ...SPRING.pop }).start();
    const delay = item.action ? 4200 : item.message ? 2600 : 1900;
    const t = setTimeout(() => {
      Animated.timing(a, { toValue: 0, duration: 200, useNativeDriver: ND }).start(onDone);
    }, delay);
    return () => clearTimeout(t);
  }, [a, item, onDone]);
  const meta = TOAST_META[item.type];
  const color = c[meta.key];
  const Icon = meta.icon;
  return (
    <Animated.View
      pointerEvents={item.action ? 'box-none' : 'none'}
      style={{
        position: 'absolute', left: 20, right: 20, top: insets.top + 12, alignItems: 'center', zIndex: 100,
        opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
        transform: [
          { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) },
          { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
        ],
      }}
    >
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16,
          maxWidth: 440, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6,
          borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider,
        }}
      >
        <Icon size={22} color={color} strokeWidth={1.8} fill={item.type === 'success' ? color : 'transparent'} {...(item.type === 'success' ? { color: '#fff', fill: color } : {})} />
        <View style={{ marginLeft: 10, flexShrink: 1 }}>
          <Text style={{ fontSize: fs(14), color: c.text, fontWeight: '600' }}>{item.title}</Text>
          {!!item.message && <Text style={{ fontSize: fs(12), color: c.textSub, marginTop: 2, lineHeight: fs(12) * 1.5 }}>{item.message}</Text>}
        </View>
        {item.action && (
          <Pressable
            onPress={() => {
              onDone();
              item.action?.onPress();
            }}
            style={{ marginLeft: 12, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: c.bgDeep, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border }}
          >
            <Text style={{ fontSize: fs(12), color: c.text, fontWeight: '500' }}>{item.action.label}</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

function ConfirmDialog({ data, onClose }: { data: (ConfirmOptions & { resolve: (v: boolean) => void }) | null; onClose: (v: boolean) => void }) {
  const { c, t, fs } = useTheme();
  // 关闭动画期间仍需要显示上一份内容
  const last = useRef(data);
  if (data) last.current = data;
  const shown = data ?? last.current;
  return (
    <PopDialog visible={!!data} onClose={() => onClose(false)} style={{ paddingTop: 24 }}>
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
      <Text style={[t.h3, { textAlign: 'center', fontSize: fs(17) }]}>{shown?.title}</Text>
      {!!shown?.message && <Text style={[t.sub, { textAlign: 'center', marginTop: 10 }]}>{shown.message}</Text>}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 22 }}>
        <PressableScale onPress={() => onClose(false)} style={{ flex: 1, height: 42, borderRadius: 21, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: c.textSub, fontSize: fs(14) }}>{shown?.cancelText ?? '取消'}</Text>
        </PressableScale>
        <PressableScale
          onPress={() => onClose(true)}
          style={{ flex: 1, height: 42, borderRadius: 21, backgroundColor: shown?.destructive ? c.danger : c.primary, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: c.textOnPrimary, fontSize: fs(14), fontWeight: '600' }}>{shown?.confirmText ?? '确定'}</Text>
        </PressableScale>
      </View>
    </PopDialog>
  );
}

function ActionSheet({ data, onClose }: { data: { options: SheetOption[]; title?: string } | null; onClose: () => void }) {
  const { c, fs } = useTheme();
  const last = useRef(data);
  if (data) last.current = data;
  const shown = data ?? last.current;
  return (
    <BottomSheet visible={!!data} onClose={onClose} contentStyle={{ paddingHorizontal: 12, paddingTop: 0 }}>
      {!!shown?.title && <Text numberOfLines={1} style={{ textAlign: 'center', color: c.textSub, fontSize: fs(13), marginBottom: 10, paddingHorizontal: 12 }}>{shown.title}</Text>}
      <View style={{ backgroundColor: c.card, borderRadius: 16, overflow: 'hidden' }}>
        {shown?.options.map((o, i) => (
          <Pressable
            key={o.label}
            onPress={() => {
              haptic('light');
              onClose();
              setTimeout(() => o.onPress?.(), 240);
            }}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 54,
              borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderColor: c.divider, backgroundColor: pressed ? c.cardAlt : 'transparent',
            })}
          >
            {o.icon && <o.icon size={18} color={o.destructive ? c.danger : c.text} strokeWidth={1.7} style={{ marginRight: 8 }} />}
            <Text style={{ fontSize: fs(15), color: o.destructive ? c.danger : c.text }}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
      <PressableScale scaleTo={0.985} onPress={onClose} style={{ marginTop: 10, height: 52, borderRadius: 16, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: fs(15), color: c.textSub }}>取消</Text>
      </PressableScale>
    </BottomSheet>
  );
}
