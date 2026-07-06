import { router } from 'expo-router';
import { ChevronLeft, Eye, EyeOff, LockKeyhole, UnlockKeyhole } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { Screen } from '@/src/components/ui/Screen';
import { SectionCard } from '@/src/components/ui/SectionCard';
import type { MemoryPrivacyMode, MemorySummary } from '@/src/data/mock';
import { useAppLockStore } from '@/src/stores/useAppLockStore';
import { useDiaryStore } from '@/src/stores/useDiaryStore';
import { alpha, colors, radius, spacing, strokeWidth, typography } from '@/src/theme';

function modeFor(memory: MemorySummary): MemoryPrivacyMode {
  return memory.privacyMode === 'masked' ? 'masked' : 'hidden';
}

function modeLabel(mode: MemoryPrivacyMode): string {
  return mode === 'masked' ? '隐藏正文' : '完全隐藏';
}

export default function PrivacySettingsScreen() {
  const people = useDiaryStore((state) => state.people);
  const memories = useDiaryStore((state) => state.memories);
  const updateMemory = useDiaryStore((state) => state.updateMemory);
  const appLockEnabled = useAppLockStore((state) => state.appLockEnabled);
  const privateMemories = memories.filter((memory) => memory.isPrivate);
  const hiddenCount = privateMemories.filter((memory) => modeFor(memory) === 'hidden').length;
  const maskedCount = privateMemories.filter((memory) => modeFor(memory) === 'masked').length;

  const setMemoryMode = (memory: MemorySummary, privacyMode: MemoryPrivacyMode) => {
    updateMemory({
      id: memory.id,
      content: memory.content,
      mood: memory.mood,
      personIds: memory.personIds,
      attachments: memory.attachments,
      isPrivate: true,
      privacyMode,
      location: memory.location,
    });
  };

  const removePrivacy = (memory: MemorySummary) => {
    Alert.alert('取消私密标记吗？', '这段记忆会重新出现在时间线、人物页和搜索结果里。', [
      { text: '再想想', style: 'cancel' },
      {
        text: '取消私密',
        style: 'destructive',
        onPress: () => {
          updateMemory({
            id: memory.id,
            content: memory.content,
            mood: memory.mood,
            personIds: memory.personIds,
            attachments: memory.attachments,
            isPrivate: false,
            privacyMode: null,
            location: memory.location,
          });
        },
      },
    ]);
  };

  const applyBulkMode = (privacyMode: MemoryPrivacyMode) => {
    if (privateMemories.length === 0) return;
    Alert.alert(`全部设为${modeLabel(privacyMode)}吗？`, '只会调整私密模式，不会改动正文、照片或关联人物。', [
      { text: '取消', style: 'cancel' },
      {
        text: '确认',
        onPress: () => {
          privateMemories.forEach((memory) => setMemoryMode(memory, privacyMode));
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" accessibilityLabel="返回" onPress={() => router.back()} style={styles.back}>
          <ChevronLeft size={22} color={colors.textSecondary} />
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>私密记忆</Text>
          <Text style={styles.subtitle}>统一管理那些需要多一层安静的内容。</Text>
        </View>

        <SectionCard>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{privateMemories.length}</Text>
              <Text style={styles.statLabel}>私密</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{hiddenCount}</Text>
              <Text style={styles.statLabel}>完全隐藏</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{maskedCount}</Text>
              <Text style={styles.statLabel}>隐藏正文</Text>
            </View>
          </View>
        </SectionCard>

        {!appLockEnabled ? (
          <SectionCard>
            <View style={styles.warningRow}>
              <LockKeyhole size={17} color={colors.danger} />
              <Text style={styles.warningText}>应用锁关闭时，建议先开启应用锁，再继续新增私密记忆。</Text>
            </View>
          </SectionCard>
        ) : null}

        {privateMemories.length > 0 ? (
          <View style={styles.bulkActions}>
            <PrimaryButton
              label="全部完全隐藏"
              onPress={() => applyBulkMode('hidden')}
              style={styles.bulkPrimary}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="全部私密记忆设为隐藏正文"
              onPress={() => applyBulkMode('masked')}
              style={({ pressed }) => [styles.bulkSecondary, pressed && styles.bulkSecondaryPressed]}
            >
              <Eye size={17} color={colors.accent} />
              <Text style={styles.bulkSecondaryText}>全部隐藏正文</Text>
            </Pressable>
          </View>
        ) : null}

        {privateMemories.length === 0 ? (
          <Text style={styles.empty}>还没有私密记忆。</Text>
        ) : (
          privateMemories.map((memory) => {
            const mode = modeFor(memory);
            const relatedNames = memory.personIds
              .map((personId) => people.find((person) => person.id === personId)?.name)
              .filter(Boolean)
              .join('、');

            return (
              <SectionCard key={memory.id}>
                <View style={styles.memoryHeader}>
                  <View style={styles.memoryText}>
                    <Text style={styles.memoryTitle}>{memory.title}</Text>
                    <Text style={styles.memoryMeta}>
                      {memory.date}{relatedNames ? ` · ${relatedNames}` : ''}
                    </Text>
                  </View>
                  <View style={styles.modePill}>
                    {mode === 'masked' ? (
                      <Eye size={12} color={colors.accent} />
                    ) : (
                      <EyeOff size={12} color={colors.accent} />
                    )}
                    <Text style={styles.modeText}>{modeLabel(mode)}</Text>
                  </View>
                </View>

                <View style={styles.itemActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${mode === 'hidden' ? '已设为' : '设为'}完全隐藏`}
                    accessibilityState={{ selected: mode === 'hidden' }}
                    onPress={() => setMemoryMode(memory, 'hidden')}
                    style={[styles.itemButton, mode === 'hidden' && styles.itemButtonActive]}
                  >
                    <Text style={[styles.itemButtonText, mode === 'hidden' && styles.itemButtonTextActive]}>完全隐藏</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${mode === 'masked' ? '已设为' : '设为'}隐藏正文`}
                    accessibilityState={{ selected: mode === 'masked' }}
                    onPress={() => setMemoryMode(memory, 'masked')}
                    style={[styles.itemButton, mode === 'masked' && styles.itemButtonActive]}
                  >
                    <Text style={[styles.itemButtonText, mode === 'masked' && styles.itemButtonTextActive]}>隐藏正文</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="取消这段记忆的私密标记"
                    onPress={() => removePrivacy(memory)}
                    style={styles.unlockButton}
                  >
                    <UnlockKeyhole size={14} color={colors.danger} />
                    <Text style={styles.unlockText}>取消</Text>
                  </Pressable>
                </View>
              </SectionCard>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSecondary,
  },
  header: {
    gap: spacing.sm,
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
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statItem: {
    flex: 1,
    gap: spacing.xs,
  },
  statValue: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.titleLg,
    fontWeight: '500',
    lineHeight: typography.lineHeights.titleLg,
    includeFontPadding: false,
  },
  statLabel: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    includeFontPadding: false,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  warningText: {
    flex: 1,
    color: colors.danger,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    includeFontPadding: false,
  },
  bulkActions: {
    gap: spacing.md,
  },
  bulkPrimary: {
    alignSelf: 'stretch',
  },
  bulkSecondary: {
    height: 52,
    borderRadius: radius.button,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  bulkSecondaryPressed: {
    backgroundColor: alpha.accent8,
  },
  bulkSecondaryText: {
    color: colors.accent,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '500',
    lineHeight: typography.lineHeights.title,
    includeFontPadding: false,
  },
  empty: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    textAlign: 'center',
    marginTop: spacing.xxxl,
    includeFontPadding: false,
  },
  memoryHeader: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  memoryText: {
    flex: 1,
    gap: spacing.xs,
  },
  memoryTitle: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '500',
    lineHeight: typography.lineHeights.title,
    includeFontPadding: false,
  },
  memoryMeta: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    includeFontPadding: false,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: alpha.accent10,
  },
  modeText: {
    color: colors.accent,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.micro,
    fontWeight: '500',
    lineHeight: typography.lineHeights.micro,
    includeFontPadding: false,
  },
  itemActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  itemButton: {
    minHeight: 44,
    borderRadius: radius.button,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bgElevated,
    borderWidth: strokeWidth.input,
    borderColor: colors.strokeSoft,
  },
  itemButtonActive: {
    backgroundColor: colors.accent,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
  },
  itemButtonText: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: '500',
    includeFontPadding: false,
  },
  itemButtonTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  unlockButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    backgroundColor: alpha.danger10,
    borderWidth: strokeWidth.input,
    borderColor: colors.strokeSoft,
  },
  unlockText: {
    color: colors.danger,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: '500',
    includeFontPadding: false,
  },
});
