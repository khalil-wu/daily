import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ChevronLeft, Download, GitMerge, Upload } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { BackupExportEstimate } from '@/src/backup/backupEstimate';
import { backupSizeLevel, formatBytes } from '@/src/backup/backupEstimate';
import type { BackupImportPreview } from '@/src/backup/backupMerge';
import { buildImportPreview } from '@/src/backup/backupMerge';
import { createBackupPayload, parseBackupPayload } from '@/src/backup/backupPayload';
import { estimateBackupExport, exportBackup, importBackupText, restoreBackupMedia } from '@/src/backup/backupService';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { Screen } from '@/src/components/ui/Screen';
import { SectionCard } from '@/src/components/ui/SectionCard';
import type { DiaryData } from '@/src/storage/diaryRepository';
import { useDiaryStore } from '@/src/stores/useDiaryStore';
import { alpha, colors, radius, spacing, strokeWidth, typography } from '@/src/theme';

type PendingImport = {
  data: DiaryData;
  raw: string;
  preview: BackupImportPreview;
};

export default function BackupScreen() {
  const people = useDiaryStore((state) => state.people);
  const memories = useDiaryStore((state) => state.memories);
  const replaceDiaryData = useDiaryStore((state) => state.replaceDiaryData);
  const mergeDiaryData = useDiaryStore((state) => state.mergeDiaryData);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [exportEstimate, setExportEstimate] = useState<BackupExportEstimate | null>(null);
  const privateCount = memories.filter((memory) => memory.isPrivate).length;
  const exportSizeLevel = exportEstimate ? backupSizeLevel(exportEstimate.totalBytes) : 'normal';
  const duplicatePeoplePreview = pendingImport?.preview.duplicatePeopleDetails.slice(0, 3) ?? [];
  const duplicateMemoryPreview = pendingImport?.preview.duplicateMemoryDetails.slice(0, 3) ?? [];
  const hiddenDuplicateCount = pendingImport
    ? pendingImport.preview.duplicatePeople + pendingImport.preview.duplicateMemories
      - duplicatePeoplePreview.length - duplicateMemoryPreview.length
    : 0;
  const hasDuplicateImportItems = pendingImport
    ? pendingImport.preview.duplicatePeople + pendingImport.preview.duplicateMemories > 0
    : false;

  useEffect(() => {
    let canceled = false;

    async function refreshEstimate() {
      try {
        const nextEstimate = await estimateBackupExport(createBackupPayload({ people, memories }));
        if (!canceled) setExportEstimate(nextEstimate);
      } catch {
        if (!canceled) setExportEstimate(null);
      }
    }

    void refreshEstimate();
    return () => {
      canceled = true;
    };
  }, [memories, people]);

  const exportData = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const target = await exportBackup(createBackupPayload({ people, memories }));
      setMessage(`备份已经准备好：${target}`);
    } catch (error) {
      const text = error instanceof Error ? error.message : '备份没有完成';
      setMessage(text);
    } finally {
      setBusy(false);
    }
  };

  const restoreFromBackup = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const raw = await importBackupText();
      if (!raw) return;
      const data = parseBackupPayload(raw);
      const preview = buildImportPreview({ people, memories }, data);
      setPendingImport({ data, raw, preview });
      setMessage('已读入备份，先看看内容再决定。');
    } catch (error) {
      const text = error instanceof Error ? error.message : '这份备份读不出来';
      setMessage(text);
    } finally {
      setBusy(false);
    }
  };

  const clearPendingImport = () => {
    setPendingImport(null);
    setMessage(null);
  };

  const mergePendingImport = async (overwriteDuplicates = false) => {
    if (!pendingImport) return;
    setBusy(true);
    try {
      const restoredData = await restoreBackupMedia(pendingImport.data, pendingImport.raw);
      mergeDiaryData(restoredData, { overwriteDuplicates });
      const overwritten = pendingImport.preview.duplicatePeople + pendingImport.preview.duplicateMemories;
      if (overwriteDuplicates) {
        setMessage(`已经合并新内容，并覆盖 ${overwritten} 个重复项。`);
      } else {
        setMessage(
          pendingImport.preview.newPeople + pendingImport.preview.newMemories > 0
            ? `已经合并 ${pendingImport.preview.newPeople} 位身边人、${pendingImport.preview.newMemories} 条记忆。`
            : '没有发现新的身边人或记忆。',
        );
      }
      setPendingImport(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '备份合并失败');
    } finally {
      setBusy(false);
    }
  };

  const replaceWithPendingImport = () => {
    if (!pendingImport) return;

    Alert.alert('替换当前数据吗？', '当前这台设备上的人物和记忆会被这份备份替换。', [
      { text: '再想想', style: 'cancel' },
      {
        text: '替换',
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          void restoreBackupMedia(pendingImport.data, pendingImport.raw)
            .then((restoredData) => {
              replaceDiaryData(restoredData);
              setMessage('已经用这份备份替换当前数据。');
              setPendingImport(null);
            })
            .catch((error: unknown) => {
              setMessage(error instanceof Error ? error.message : '备份恢复失败');
            })
            .finally(() => setBusy(false));
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
          <Text style={styles.title}>备份与恢复</Text>
          <Text style={styles.subtitle}>你的记忆默认只在这台设备上。</Text>
        </View>

        <SectionCard>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{people.length}</Text>
              <Text style={styles.statLabel}>身边人</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{memories.length}</Text>
              <Text style={styles.statLabel}>记忆</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {memories.reduce((sum, memory) => sum + memory.attachments.length, 0)}
              </Text>
              <Text style={styles.statLabel}>照片</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{privateCount}</Text>
              <Text style={styles.statLabel}>私密</Text>
            </View>
          </View>
        </SectionCard>

        <SectionCard>
          <View style={styles.estimateRow}>
            <View style={styles.settingText}>
              <Text style={styles.estimateTitle}>预计备份大小</Text>
              <Text style={[styles.estimateDesc, exportSizeLevel !== 'normal' && styles.warningText]}>
                {exportEstimate
                  ? `${formatBytes(exportEstimate.totalBytes)} · ${exportEstimate.embeddedMediaCount} 张照片会随备份带走`
                  : '正在估算。'}
              </Text>
              {exportEstimate?.missingMediaCount ? (
                <Text style={styles.estimateSubtle}>
                  {exportEstimate.missingMediaCount} 张照片当前读不到，只会保留引用。
                </Text>
              ) : null}
            </View>
          </View>
        </SectionCard>

        <View style={styles.actions}>
          <PrimaryButton label={busy ? '等一下' : '导出备份'} onPress={exportData} disabled={busy} style={styles.fullButton} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="恢复备份"
            accessibilityState={{ disabled: busy }}
            onPress={restoreFromBackup}
            disabled={busy}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && !busy && styles.secondaryPressed,
              busy && styles.disabled,
            ]}
          >
            <Upload size={17} color={colors.accent} />
            <Text style={styles.secondaryText}>恢复备份</Text>
          </Pressable>
        </View>

        {pendingImport ? (
          <SectionCard>
            <View style={styles.previewHeader}>
              <GitMerge size={17} color={colors.accent} />
              <Text style={styles.previewTitle}>导入预览</Text>
            </View>
            <View style={styles.previewGrid}>
              <View style={styles.previewItem}>
                <Text style={styles.previewValue}>{pendingImport.preview.imported.people}</Text>
                <Text style={styles.previewLabel}>备份人物</Text>
              </View>
              <View style={styles.previewItem}>
                <Text style={styles.previewValue}>{pendingImport.preview.imported.memories}</Text>
                <Text style={styles.previewLabel}>备份记忆</Text>
              </View>
              <View style={styles.previewItem}>
                <Text style={styles.previewValue}>{pendingImport.preview.newPeople}</Text>
                <Text style={styles.previewLabel}>新增人物</Text>
              </View>
              <View style={styles.previewItem}>
                <Text style={styles.previewValue}>{pendingImport.preview.newMemories}</Text>
                <Text style={styles.previewLabel}>新增记忆</Text>
              </View>
            </View>
            <Text style={styles.previewNote}>
              合并新内容会跳过重复 ID；合并并覆盖会用备份里的同 ID 人物和记忆替换当前内容。带照片的原生备份会先把照片恢复到本机。重复项：{pendingImport.preview.duplicatePeople} 位人物、{pendingImport.preview.duplicateMemories} 条记忆。
            </Text>
            {pendingImport.preview.duplicatePeopleDetails.length > 0 || pendingImport.preview.duplicateMemoryDetails.length > 0 ? (
              <View style={styles.conflictBlock}>
                {duplicatePeoplePreview.map((person) => (
                  <Text key={person.id} style={styles.conflictText}>
                    人物重复：{person.name} · {person.relation}
                  </Text>
                ))}
                {duplicateMemoryPreview.map((memory) => (
                  <Text key={memory.id} style={styles.conflictText}>
                    记忆重复：{memory.title} · {memory.date}
                  </Text>
                ))}
                {hiddenDuplicateCount > 0 ? (
                  <Text style={styles.conflictText}>还有 {hiddenDuplicateCount} 个重复项。</Text>
                ) : null}
              </View>
            ) : null}
            <View style={styles.previewActions}>
              <PrimaryButton
                label="合并新内容"
                onPress={() => void mergePendingImport(false)}
                disabled={busy}
                style={styles.previewPrimary}
              />
              {hasDuplicateImportItems ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="合并并覆盖重复项"
                  accessibilityState={{ disabled: busy }}
                  onPress={() => void mergePendingImport(true)}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.overwriteButton,
                    pressed && !busy && styles.overwritePressed,
                    busy && styles.disabled,
                  ]}
                >
                  <Text style={styles.overwriteText}>合并并覆盖</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="用导入备份替换当前数据"
                accessibilityState={{ disabled: busy }}
                onPress={replaceWithPendingImport}
                disabled={busy}
                style={({ pressed }) => [
                  styles.replaceButton,
                  pressed && !busy && styles.replacePressed,
                  busy && styles.disabled,
                ]}
              >
                <Text style={styles.replaceText}>替换当前</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="取消导入备份"
                accessibilityState={{ disabled: busy }}
                onPress={clearPendingImport}
                disabled={busy}
                style={styles.cancelImportButton}
              >
                <Text style={styles.cancelImportText}>取消导入</Text>
              </Pressable>
            </View>
          </SectionCard>
        ) : null}

        <SectionCard>
          <View style={styles.noteRow}>
            <Download size={17} color={colors.textSecondary} />
            <Text style={styles.noteText}>本地备份会包含人物、文字记忆、心情、关联关系、私密标记；原生端会尽量把本地照片内容一起带上。</Text>
          </View>
        </SectionCard>

        {message ? <Text style={styles.message}>{message}</Text> : null}
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
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    fontSize: typography.caption,
  },
  estimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  settingText: {
    flex: 1,
    gap: spacing.xs,
  },
  estimateTitle: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '500',
    lineHeight: typography.lineHeights.title,
    includeFontPadding: false,
  },
  estimateDesc: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
  },
  estimateSubtle: {
    color: colors.textTertiary,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
  },
  warningText: {
    color: colors.danger,
  },
  actions: {
    gap: spacing.md,
  },
  fullButton: {
    alignSelf: 'stretch',
  },
  secondaryButton: {
    height: 52,
    borderRadius: radius.button,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryPressed: {
    backgroundColor: alpha.accent8,
  },
  secondaryText: {
    color: colors.accent,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '500',
    lineHeight: typography.lineHeights.title,
    includeFontPadding: false,
  },
  disabled: {
    opacity: 0.4,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  noteText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
  },
  message: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    textAlign: 'center',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  previewTitle: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '500',
    lineHeight: typography.lineHeights.title,
    includeFontPadding: false,
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  previewItem: {
    flexGrow: 1,
    flexBasis: 120,
    minWidth: 120,
    minHeight: 64,
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bgElevated,
  },
  previewValue: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.titleLg,
    fontWeight: '500',
    lineHeight: typography.lineHeights.titleLg,
    includeFontPadding: false,
  },
  previewLabel: {
    color: colors.textSecondary,
    fontSize: typography.caption,
  },
  previewNote: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    marginTop: spacing.lg,
  },
  conflictBlock: {
    gap: spacing.xs,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.input,
    backgroundColor: colors.bgElevated,
  },
  conflictText: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
  },
  previewActions: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  previewPrimary: {
    alignSelf: 'stretch',
  },
  replaceButton: {
    height: 52,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: alpha.danger34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replacePressed: {
    backgroundColor: alpha.danger10,
  },
  replaceText: {
    color: colors.danger,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '500',
    lineHeight: typography.lineHeights.title,
    includeFontPadding: false,
  },
  overwriteButton: {
    height: 52,
    borderRadius: radius.button,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overwritePressed: {
    backgroundColor: alpha.accent8,
  },
  overwriteText: {
    color: colors.accent,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '500',
    lineHeight: typography.lineHeights.title,
    includeFontPadding: false,
  },
  cancelImportButton: {
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  cancelImportText: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    fontWeight: '500',
  },
});
