import { useState } from 'react';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/src/components/person/Avatar';
import { WritingFootprint } from '@/src/components/memory/WritingFootprint';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { Screen } from '@/src/components/ui/Screen';
import { SectionCard } from '@/src/components/ui/SectionCard';
import { selectionFeedback } from '@/src/motion';
import { useAppLockStore } from '@/src/stores/useAppLockStore';
import { useDiaryStore } from '@/src/stores/useDiaryStore';
import { useVisibleDiaryData } from '@/src/privacy/useVisibleDiaryData';
import { alpha, colors, radius, shadows, spacing, strokeWidth, typography } from '@/src/theme';

export default function MeScreen() {
  const hydrated = useDiaryStore((state) => state.hydrated);
  const hydrationError = useDiaryStore((state) => state.hydrationError);
  const appLockHydrated = useAppLockStore((state) => state.hydrated);
  const appLockEnabled = useAppLockStore((state) => state.appLockEnabled);
  const appLockError = useAppLockStore((state) => state.settingsError);
  const enableAppLock = useAppLockStore((state) => state.enableAppLock);
  const disableAppLock = useAppLockStore((state) => state.disableAppLock);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [lockBusy, setLockBusy] = useState(false);

  const { visibleMemories, visiblePeople } = useVisibleDiaryData();

  const closePinModal = () => {
    if (lockBusy) return;
    setPinModalVisible(false);
    setPin('');
    setConfirmPin('');
    setPinError(null);
  };

  const toggleAppLock = (enabled: boolean) => {
    if (enabled) {
      setPinModalVisible(true);
      return;
    }

    setLockBusy(true);
    void disableAppLock().finally(() => setLockBusy(false));
  };

  const savePin = async () => {
    if (pin.trim().length < 4) {
      setPinError('密码至少 4 位。');
      return;
    }
    if (pin.trim() !== confirmPin.trim()) {
      setPinError('两次输入不一样。');
      return;
    }

    setLockBusy(true);
    try {
      await enableAppLock(pin);
      closePinModal();
    } catch (error) {
      setPinError(error instanceof Error ? error.message : '应用锁保存失败。');
    } finally {
      setLockBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileRow}>
          <Avatar name="我" size={72} highlighted />
          <View style={styles.profileText}>
            <Text style={styles.title}>我</Text>
            <Text style={styles.subtitle}>你的记忆只存在这台设备上。</Text>
          </View>
        </View>

        <WritingFootprint memories={visibleMemories} people={visiblePeople} />

        <SectionCard>
          <View style={styles.settingRow}>
            <View style={styles.settingText}>
              <Text style={styles.settingTitle}>应用锁</Text>
              <Text style={[styles.settingDesc, appLockError && styles.errorText]}>
                {appLockError
                  ? `应用锁遇到问题：${appLockError}`
                  : appLockEnabled
                    ? '已开启，回到应用时会先锁住。'
                    : '回到应用时，再确认一次是你。'}
              </Text>
            </View>
            <Switch
              value={appLockEnabled}
              disabled={!appLockHydrated || lockBusy}
              onValueChange={toggleAppLock}
              thumbColor={colors.accent}
              trackColor={{ false: colors.bgElevated, true: alpha.accent22 }}
            />
          </View>
        </SectionCard>

        <SectionCard>
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>本地保存</Text>
            <Text style={[styles.settingDesc, hydrationError && styles.errorText]}>
              {hydrationError
                ? `本地保存遇到问题：${hydrationError}`
                : hydrated
                  ? '已开启，人物和记忆会留在这台设备上。'
                  : '正在读取本地记忆。'}
            </Text>
          </View>
        </SectionCard>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="进入私密记忆设置"
          onPress={() => {
            void selectionFeedback();
            router.push('/settings/privacy');
          }}
        >
          <SectionCard>
            <View style={styles.settingRow}>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>私密记忆</Text>
                <Text style={styles.settingDesc}>集中调整隐藏方式，或取消私密标记。</Text>
              </View>
              <ChevronRight color={colors.textTertiary} size={18} />
            </View>
          </SectionCard>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="进入备份与恢复"
          onPress={() => {
            void selectionFeedback();
            router.push('/settings/backup');
          }}
        >
          <SectionCard>
            <View style={styles.settingRow}>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>备份与恢复</Text>
                <Text style={styles.settingDesc}>导出一份本地备份，换机时也能带走。</Text>
              </View>
              <ChevronRight color={colors.textTertiary} size={18} />
            </View>
          </SectionCard>
        </Pressable>

        <SectionCard>
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>之后</Text>
            <Text style={styles.settingDesc}>云端备份会等端到端加密准备好后再开放。</Text>
          </View>
        </SectionCard>
      </ScrollView>

      <Modal transparent animationType="fade" visible={pinModalVisible} onRequestClose={closePinModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalPanel}>
            <Text style={styles.modalTitle}>设置应用锁</Text>
            <TextInput
              accessibilityLabel="输入应用锁密码"
              value={pin}
              onChangeText={(value) => {
                setPin(value);
                setPinError(null);
              }}
              placeholder="输入密码"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={12}
              style={styles.modalInput}
            />
            <TextInput
              accessibilityLabel="再次输入应用锁密码"
              value={confirmPin}
              onChangeText={(value) => {
                setConfirmPin(value);
                setPinError(null);
              }}
              placeholder="再输入一次"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={12}
              style={styles.modalInput}
            />
            {pinError ? <Text style={styles.modalError}>{pinError}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="取消设置应用锁"
                accessibilityState={{ disabled: lockBusy }}
                onPress={closePinModal}
                disabled={lockBusy}
                style={({ pressed }) => [styles.modalGhostButton, pressed && !lockBusy && styles.modalGhostPressed]}
              >
                <Text style={styles.modalGhostText}>取消</Text>
              </Pressable>
              <PrimaryButton
                label={lockBusy ? '保存中' : '开启'}
                onPress={savePin}
                disabled={lockBusy}
                style={styles.modalPrimary}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  profileRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'center',
  },
  profileText: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.titleLg,
    lineHeight: typography.lineHeights.titleLg,
    fontWeight: '500',
    includeFontPadding: false,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    includeFontPadding: false,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  settingText: {
    flex: 1,
    gap: spacing.xs,
  },
  settingTitle: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: '500',
    includeFontPadding: false,
  },
  settingDesc: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    includeFontPadding: false,
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.fontFamily.display,
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.overlay,
  },
  modalPanel: {
    width: '100%',
    maxWidth: 360,
    gap: spacing.lg,
    padding: spacing.xxl,
    borderRadius: radius.card,
    backgroundColor: colors.bgSecondary,
    borderWidth: strokeWidth.card,
    borderColor: colors.stroke,
    ...shadows.sheet,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.titleLg,
    lineHeight: typography.lineHeights.titleLg,
    fontWeight: '500',
    textAlign: 'center',
    includeFontPadding: false,
  },
  modalInput: {
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
  modalError: {
    color: colors.danger,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    textAlign: 'center',
    includeFontPadding: false,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalGhostButton: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
  },
  modalGhostPressed: {
    backgroundColor: colors.bgElevated,
  },
  modalGhostText: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: '500',
    includeFontPadding: false,
  },
  modalPrimary: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: spacing.lg,
  },
});
