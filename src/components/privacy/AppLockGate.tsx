import { useEffect, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { LockKeyhole, ShieldCheck } from 'lucide-react-native';
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { useAppLockStore } from '@/src/stores/useAppLockStore';
import { alpha, colors, radius, spacing, strokeWidth, typography } from '@/src/theme';

export function AppLockGate() {
  const hydrated = useAppLockStore((state) => state.hydrated);
  const appLockEnabled = useAppLockStore((state) => state.appLockEnabled);
  const locked = useAppLockStore((state) => state.locked);
  const hydrateAppLock = useAppLockStore((state) => state.hydrateAppLock);
  const lockApp = useAppLockStore((state) => state.lockApp);
  const unlockWithPin = useAppLockStore((state) => state.unlockWithPin);
  const unlockTrusted = useAppLockStore((state) => state.unlockTrusted);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deviceAvailable, setDeviceAvailable] = useState(false);
  const [deviceBusy, setDeviceBusy] = useState(false);

  useEffect(() => {
    void hydrateAppLock();
  }, [hydrateAppLock]);

  useEffect(() => {
    if (!appLockEnabled) return undefined;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'inactive' || nextState === 'background') {
        lockApp();
      }
    });

    return () => subscription.remove();
  }, [appLockEnabled, lockApp]);

  useEffect(() => {
    let mounted = true;

    async function checkDeviceAuth() {
      if (!appLockEnabled || !locked || Platform.OS === 'web') {
        setDeviceAvailable(false);
        return;
      }

      try {
        const [hasHardware, isEnrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);
        if (mounted) setDeviceAvailable(hasHardware && isEnrolled);
      } catch {
        if (mounted) setDeviceAvailable(false);
      }
    }

    void checkDeviceAuth();
    return () => {
      mounted = false;
    };
  }, [appLockEnabled, locked]);

  const submitPin = async () => {
    if (pin.trim().length === 0) return;
    const unlocked = await unlockWithPin(pin);
    if (unlocked) {
      setPin('');
      setError(null);
      return;
    }
    setError('密码不对。');
  };

  const unlockWithDevice = async () => {
    if (deviceBusy) return;
    setDeviceBusy(true);
    setError(null);

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: '打开记得日记',
        cancelLabel: '取消',
        fallbackLabel: '输入密码',
        disableDeviceFallback: false,
      });

      if (result.success) {
        unlockTrusted();
      } else if (result.error !== 'user_cancel' && result.error !== 'system_cancel' && result.error !== 'app_cancel') {
        setError('设备验证没有通过。');
      }
    } catch {
      setError('设备验证暂时不可用。');
    } finally {
      setDeviceBusy(false);
    }
  };

  if (!hydrated) {
    return (
      <View style={styles.overlay}>
        <Text style={styles.loadingTitle}>记得日记</Text>
      </View>
    );
  }

  if (!appLockEnabled || !locked) return null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.overlay}
    >
      <View style={styles.panel}>
        <View style={styles.iconWrap}>
          <LockKeyhole size={24} color={colors.accent} />
        </View>
        <Text style={styles.title}>记得日记已锁定</Text>
        <TextInput
          accessibilityLabel="应用锁密码"
          value={pin}
          onChangeText={(value) => {
            setPin(value);
            setError(null);
          }}
          onSubmitEditing={submitPin}
          placeholder="输入密码"
          placeholderTextColor={colors.textTertiary}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={12}
          style={styles.input}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          label="解锁"
          onPress={submitPin}
          disabled={pin.trim().length === 0}
          style={styles.button}
        />
        {deviceAvailable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="使用设备验证解锁"
            accessibilityState={{ disabled: deviceBusy }}
            onPress={unlockWithDevice}
            disabled={deviceBusy}
            style={({ pressed }) => [
              styles.deviceButton,
              pressed && !deviceBusy && styles.deviceButtonPressed,
              deviceBusy && styles.deviceButtonDisabled,
            ]}
          >
            <ShieldCheck size={17} color={colors.accent} />
            <Text style={styles.deviceText}>{deviceBusy ? '验证中' : '使用设备验证'}</Text>
          </Pressable>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bgPrimary,
  },
  loadingTitle: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.titleLg,
    fontWeight: '500',
    lineHeight: typography.lineHeights.titleLg,
    includeFontPadding: false,
  },
  panel: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.card,
    padding: spacing.xxl,
    gap: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.bgSecondary,
    borderWidth: strokeWidth.card,
    borderColor: colors.stroke,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha.accent10,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.titleLg,
    fontWeight: '500',
    lineHeight: typography.lineHeights.titleLg,
    includeFontPadding: false,
  },
  input: {
    width: '100%',
    height: 52,
    borderRadius: radius.input,
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    lineHeight: typography.lineHeights.title,
    textAlign: 'center',
    backgroundColor: colors.bgElevated,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
  },
  error: {
    color: colors.danger,
    fontSize: typography.caption,
  },
  button: {
    alignSelf: 'stretch',
  },
  deviceButton: {
    height: 44,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
  },
  deviceButtonPressed: {
    backgroundColor: alpha.accent8,
  },
  deviceButtonDisabled: {
    opacity: 0.45,
  },
  deviceText: {
    color: colors.accent,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    fontWeight: '500',
    lineHeight: typography.lineHeights.caption,
    includeFontPadding: false,
  },
});
