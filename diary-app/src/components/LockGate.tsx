import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal, Platform, Pressable, View } from 'react-native';
import { Text } from './text';
import * as LocalAuthentication from 'expo-local-authentication';
import { Delete, ScanFace, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { actions } from '../store/store';
import { IMAGES } from '../data/assets';
import { haptic } from './ui';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

interface PinPadProps {
  title: string;
  subtitle?: string;
  length?: number;
  allowBiometric?: boolean;
  onComplete: (code: string) => Promise<boolean | string | void> | boolean | string | void;
  onBiometricSuccess?: () => void;
  onClose?: () => void;
}

/** 数字密码键盘面板（1:1 复刻设计稿3 #9） */
export function PinPadView({ title, subtitle, length = 4, allowBiometric, onComplete, onBiometricSuccess, onClose }: PinPadProps) {
  const { c, t, fs, dark } = useTheme();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const shake = useRef(new Animated.Value(0)).current;

  const triggerShake = useCallback(() => {
    haptic('warning');
    Animated.sequence([
      Animated.timing(shake, { toValue: 10, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shake, { toValue: -10, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shake, { toValue: 6, duration: 45, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shake, { toValue: 0, duration: 45, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  }, [shake]);

  const tryBio = useCallback(async () => {
    if (!allowBiometric || Platform.OS === 'web') return;
    try {
      const has = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!has || !enrolled) return;
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: '验证身份以解锁记得日记', cancelLabel: '使用密码' });
      if (res.success) {
        haptic('success');
        onBiometricSuccess?.();
      }
    } catch {}
  }, [allowBiometric, onBiometricSuccess]);

  useEffect(() => {
    if (allowBiometric) void tryBio();
  }, [allowBiometric, tryBio]);

  const pressKey = async (k: string) => {
    if (!k) return;
    haptic('light');
    setError('');
    if (k === 'del') {
      setCode(v => v.slice(0, -1));
      return;
    }
    if (code.length >= length) return;
    const next = code + k;
    setCode(next);
    if (next.length === length) {
      const res = await onComplete(next);
      if (res === false || typeof res === 'string') {
        setError(typeof res === 'string' ? res : '密码不正确，请重试');
        setCode('');
        triggerShake();
      } else {
        setCode('');
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
      {onClose && (
        <Pressable onPress={onClose} hitSlop={12} style={{ position: 'absolute', top: 52, right: 22, padding: 8 }}>
          <X size={22} color={c.textSub} />
        </Pressable>
      )}

      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: dark ? 48 : 0,
          backgroundColor: dark ? 'rgba(236,246,247,0.92)' : 'transparent',
          padding: dark ? 10 : 0,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
        }}
      >
        <Image source={IMAGES.privacyLock} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
      </View>
      <Text style={[t.h1, { fontSize: fs(20), textAlign: 'center' }]}>{title}</Text>
      {!!subtitle && <Text style={[t.sub, { textAlign: 'center', marginTop: 6 }]}>{subtitle}</Text>}

      {/* 密码圆点 */}
      <Animated.View style={{ flexDirection: 'row', gap: 16, marginTop: 26, marginBottom: 10, transform: [{ translateX: shake }] }}>
        {Array.from({ length }).map((_, i) => {
          const filled = i < code.length;
          return (
            <View
              key={i}
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: filled ? c.primary : 'transparent',
                borderWidth: 1.5,
                borderColor: error ? c.danger : filled ? c.primary : c.textMuted,
              }}
            />
          );
        })}
      </Animated.View>
      <View style={{ height: 22, justifyContent: 'center' }}>
        {!!error && <Text style={{ fontSize: fs(12), color: c.danger }}>{error}</Text>}
      </View>

      {/* 数字键盘 */}
      <View style={{ width: 276, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16, marginTop: 14 }}>
        {KEYS.map((k, idx) => {
          if (!k) return <View key={idx} style={{ width: 76, height: 76 }} />;
          if (k === 'del') {
            return (
              <Pressable key={idx} onPress={() => void pressKey(k)} style={({ pressed }) => ({ width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}>
                <Delete size={24} color={c.textSub} strokeWidth={1.6} />
              </Pressable>
            );
          }
          return (
            <Pressable
              key={idx}
              onPress={() => void pressKey(k)}
              style={({ pressed }) => ({
                width: 76,
                height: 76,
                borderRadius: 38,
                backgroundColor: pressed ? c.primarySoft : c.card,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: c.shadow,
                shadowOpacity: 0.06,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: 1,
              })}
            >
              <Text style={{ fontSize: fs(26), color: c.text, fontWeight: '400', fontVariant: ['tabular-nums'] }}>{k}</Text>
            </Pressable>
          );
        })}
      </View>

      {allowBiometric && (
        <Pressable onPress={() => void tryBio()} style={{ marginTop: 26, alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: fs(13), color: c.textSub }}>或使用 Face ID 解锁</Text>
          <View style={{ width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
            <ScanFace size={22} color={c.primaryDark} strokeWidth={1.6} />
          </View>
        </Pressable>
      )}
    </View>
  );
}

/** 独立弹窗：用于设置/修改或验证应用锁密码 */
export function PinModal({ visible, mode, onSuccess, onClose }: { visible: boolean; mode: 'setup' | 'verify'; onSuccess: () => void; onClose: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [first, setFirst] = useState('');

  useEffect(() => {
    if (visible) {
      setStep(1);
      setFirst('');
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <PinPadView
        title={mode === 'verify' ? '请输入应用锁密码' : step === 1 ? '设置应用锁密码' : '请再次输入以确认'}
        subtitle={mode === 'setup' ? '设置 4 位数字密码，保护你的日记隐私' : undefined}
        allowBiometric={mode === 'verify'}
        onBiometricSuccess={onSuccess}
        onClose={onClose}
        onComplete={async code => {
          if (mode === 'verify') {
            const ok = await actions.verifyPasscode(code);
            if (!ok) return '密码不正确，请重试';
            onSuccess();
            return true;
          }
          if (step === 1) {
            setFirst(code);
            setStep(2);
            return true;
          }
          if (code !== first) {
            setFirst('');
            setStep(1);
            return '两次输入的密码不一致，请重新设置';
          }
          await actions.setPasscode(code);
          onSuccess();
          return true;
        }}
      />
    </Modal>
  );
}
