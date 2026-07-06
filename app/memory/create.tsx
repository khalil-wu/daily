import { useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Archive, Bold, Camera, CheckSquare, Heading1, Heading2, History, Image as ImageIcon, List, Mic, Quote, SeparatorHorizontal, Square, Tag, Trash2, X } from 'lucide-react-native';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { PostComposer } from '@/src/components/memory/PostComposer';
import { useMemoryEditor } from '@/src/components/memory/useMemoryEditor';
import { Avatar } from '@/src/components/person/Avatar';
import { Screen } from '@/src/components/ui/Screen';
import { formatEntryDate, getSaveFeedback, moods, pickPlaceholder } from '@/src/i18n/copy';
import { motion, selectionFeedback, successFeedback, useReducedMotion } from '@/src/motion';
import { useVisibleDiaryData } from '@/src/privacy/useVisibleDiaryData';
import { useDiaryStore } from '@/src/stores/useDiaryStore';
import { useDraftStore } from '@/src/stores/useDraftStore';
import { loadArchivedDrafts, saveArchivedDrafts } from '@/src/storage/draftRepository';
import type { ArchivedDraft } from '@/src/storage/draftRepository';
import { colors, getContentWidth, radius, shadows, spacing, strokeWidth, typography } from '@/src/theme';

function iconForFormat(label: string) {
  if (label === '标题') return Heading1;
  if (label === '小标题') return Heading2;
  if (label === '重点') return Bold;
  if (label === '引用') return Quote;
  if (label === '清单') return List;
  if (label === '待办') return CheckSquare;
  return SeparatorHorizontal;
}

export default function CreateMemoryScreen() {
  const { personId, personName } = useLocalSearchParams<{ personId?: string; personName?: string }>();
  const addMemory = useDiaryStore((state) => state.addMemory);
  const { visibleMemories } = useVisibleDiaryData();
  const draft = useDraftStore((state) => state.draft);
  const draftHydrated = useDraftStore((state) => state.hydrated);
  const hydrateDraft = useDraftStore((state) => state.hydrate);
  const saveDraft = useDraftStore((state) => state.saveDraft);
  const clearDraft = useDraftStore((state) => state.clearDraft);
  const editor = useMemoryEditor({ personIds: personId ? [personId] : [] }, visibleMemories);
  const [showDraftNotice, setShowDraftNotice] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [archivedDrafts, setArchivedDrafts] = useState<ArchivedDraft[]>([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const appliedDraftRef = useRef(false);
  const savingRef = useRef(false);
  const { width } = useWindowDimensions();
  const contentWidth = useMemo(() => getContentWidth(width, { maxWidth: 680 }), [width]);
  const reducedMotion = useReducedMotion();
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastOffset = useRef(new Animated.Value(8)).current;
  const saveDotOpacity = useRef(new Animated.Value(0)).current;
  const saveDotOffset = useRef(new Animated.Value(0)).current;
  const placeholder = useMemo(pickPlaceholder, []);
  const dateLabel = useMemo(() => formatEntryDate(new Date()), []);
  const title = personName ? `关于${personName}` : '发表动态';
  const composerPerson = editor.people.find((person) => editor.selectedPersonIds.includes(person.id));
  const composerName = composerPerson?.name ?? '我';
  const composerSubline = composerPerson ? `关于 ${composerPerson.name} · ${dateLabel}` : `记得日记 · ${dateLabel}`;

  useEffect(() => {
    void hydrateDraft();
  }, [hydrateDraft]);

  useEffect(() => {
    void loadArchivedDrafts().then((items) => setArchivedDrafts(items)).catch(() => undefined);
  }, []);

  const archiveCurrent = async () => {
    if (!editor.hasDraftContent) return;
    void selectionFeedback();
    const draft = editor.toDraft();
    const id = `draft-${Date.now()}`;
    const next = [{ ...draft, id }, ...archivedDrafts].slice(0, 20);
    setArchivedDrafts(next);
    try {
      await saveArchivedDrafts(next);
    } catch {
      // 归档失败不阻断写作
    }
  };

  const restoreArchive = (item: ArchivedDraft) => {
    void selectionFeedback();
    editor.applyDraft(item, personId ? [personId] : []);
    appliedDraftRef.current = true;
    void removeArchive(item.id);
    setArchiveOpen(false);
  };

  const removeArchive = async (id: string) => {
    const next = archivedDrafts.filter((item) => item.id !== id);
    setArchivedDrafts(next);
    try {
      await saveArchivedDrafts(next);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!draftHydrated || !draft || appliedDraftRef.current) return;
    editor.applyDraft(draft, personId ? [personId] : []);
    appliedDraftRef.current = true;
    setShowDraftNotice(true);
  }, [draft, draftHydrated, editor, personId]);

  useEffect(() => {
    if (!draftHydrated || savingRef.current) return undefined;

    const timeout = setTimeout(() => {
      if (editor.hasDraftContent && editor.dirty) {
        void saveDraft(editor.toDraft());
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [
    draftHydrated,
    editor.content,
    editor.mood,
    editor.selectedPersonIds,
    editor.attachments,
    editor.location,
    editor.privacyMode,
    editor.tags,
    editor.hasDraftContent,
    editor.dirty,
    saveDraft,
  ]);

  const close = () => {
    if (!editor.hasDraftContent || !editor.dirty) {
      void clearDraft();
      router.back();
      return;
    }

    Alert.alert('写了一半的话，要留着下次继续吗？', '', [
      {
        text: '留着',
        onPress: () => {
          savingRef.current = true;
          void saveDraft(editor.toDraft()).finally(() => router.back());
        },
      },
      {
        text: '不留了',
        style: 'destructive',
        onPress: () => {
          savingRef.current = true;
          void clearDraft().finally(() => router.back());
        },
      },
      { text: '再想想', style: 'cancel' },
    ]);
  };

  const discardDraftNotice = () => {
    setShowDraftNotice(false);
    appliedDraftRef.current = true;
    editor.resetToInitial();
    void clearDraft();
  };

  const animateSaveDot = () => {
    if (reducedMotion) return;
    saveDotOpacity.setValue(1);
    saveDotOffset.setValue(0);
    Animated.parallel([
      Animated.timing(saveDotOpacity, { toValue: 0, duration: 600, useNativeDriver: motion.useNativeDriver }),
      Animated.timing(saveDotOffset, { toValue: -24, duration: 600, useNativeDriver: motion.useNativeDriver }),
    ]).start();
  };

  const save = () => {
    if (!editor.canSave) return;
    savingRef.current = true;
    void successFeedback();
    const firstPerson = editor.people.find((person) => editor.selectedPersonIds.includes(person.id));
    addMemory(editor.saveInput);
    const message = getSaveFeedback({
      personName: firstPerson?.name ?? personName,
      hasImage: editor.attachments.length > 0,
      short: editor.content.trim().length < 30,
    });
    setToast(message);
    animateSaveDot();
    toastOffset.setValue(reducedMotion ? 0 : 8);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(toastOpacity, { toValue: 1, duration: motion.duration.base, useNativeDriver: motion.useNativeDriver }),
        Animated.timing(toastOffset, { toValue: 0, duration: motion.duration.base, useNativeDriver: motion.useNativeDriver }),
      ]),
      Animated.delay(1400),
      Animated.timing(toastOpacity, { toValue: 0, duration: motion.duration.fast, useNativeDriver: motion.useNativeDriver }),
    ]).start(() => {
      void clearDraft();
      router.back();
    });
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.topRow, { width: contentWidth }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="取消发布动态" onPress={close} hitSlop={12}>
            <Text style={styles.cancel}>取消</Text>
          </Pressable>
          <View style={styles.topCenter}>
            <Text style={styles.topTitle}>{title}</Text>
            <Text style={styles.date}>{dateLabel}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="发表这条动态"
            accessibilityState={{ disabled: !editor.canSave }}
            onPress={save}
            hitSlop={12}
            disabled={!editor.canSave}
          >
            <Text style={[styles.save, !editor.canSave && styles.saveDisabled]}>发表</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.flex}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.editorWrap}
        >
          {showDraftNotice ? (
            <View style={[styles.draftNotice, { width: contentWidth }]}>
              <Text style={styles.draftText}>上次写了一半的话，还给你留着。</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="丢弃草稿" onPress={discardDraftNotice} style={styles.draftClose}>
                <X size={14} color={colors.textSecondary} />
              </Pressable>
            </View>
          ) : null}

          {archivedDrafts.length > 0 || editor.hasDraftContent ? (
            <View style={[styles.draftBar, { width: contentWidth }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="把当前内容存为草稿"
                onPress={() => void archiveCurrent()}
                disabled={!editor.hasDraftContent}
                style={({ pressed }) => [styles.draftBarAction, pressed && styles.draftBarActionPressed, !editor.hasDraftContent && styles.draftBarActionDisabled]}
              >
                <Archive size={14} color={editor.hasDraftContent ? colors.accent : colors.textTertiary} strokeWidth={2.2} />
                <Text style={[styles.draftBarText, !editor.hasDraftContent && styles.draftBarTextDisabled]}>存草稿</Text>
              </Pressable>
              {archivedDrafts.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`打开草稿箱，共${archivedDrafts.length}份`}
                  onPress={() => { void selectionFeedback(); setArchiveOpen(true); }}
                  style={({ pressed }) => [styles.draftBarAction, pressed && styles.draftBarActionPressed]}
                >
                  <Text style={styles.draftBarText}>草稿箱 · {archivedDrafts.length}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <PostComposer
            authorName={composerName}
            authorHighlighted={composerPerson?.recent}
            meta={composerSubline}
            value={editor.content}
            onChangeText={editor.setContent}
            placeholder={placeholder}
            attachments={editor.attachments}
            voiceNotes={editor.voiceNotes}
            tags={editor.tags}
            previewMode={editor.previewMode}
            onAddImages={() => editor.openSheet('photos')}
            onRemoveAttachment={editor.removeAttachment}
            onRemoveTag={editor.removeTag}
            selectedPeople={editor.selectedPeople}
            mood={editor.mood}
            location={editor.location}
            locationLoading={editor.locationLoading}
            privacyLabel={editor.isPrivate ? editor.privacyLabel : null}
            targetLabel={composerPerson ? `${composerPerson.name}的时间线` : '我的时间线'}
            onPressLocation={editor.pickLocation}
            onPressPhotos={() => editor.openSheet('photos')}
            onPressFormat={() => editor.openSheet('format')}
            onPressVoice={() => editor.openSheet('voice')}
            onPressTags={() => editor.openSheet('tags')}
            onTogglePreview={() => editor.setPreviewMode((prev) => !prev)}
            onPressTarget={() => editor.openSheet('people')}
            onPressMention={() => editor.openSheet('people')}
            onPressMood={() => editor.openSheet('mood')}
            onTogglePrivacy={editor.togglePrivate}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={editor.activeSheet !== null} transparent animationType="fade" onRequestClose={() => editor.setActiveSheet(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => editor.setActiveSheet(null)}>
          <Pressable style={[styles.sheet, { width: contentWidth }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {editor.activeSheet === 'photos'
                  ? '照片'
                  : editor.activeSheet === 'people'
                    ? '人物'
                    : editor.activeSheet === 'format'
                      ? '排版'
                      : editor.activeSheet === 'voice'
                        ? '录音'
                        : editor.activeSheet === 'tags'
                          ? '给这段记忆一个标记'
                          : '心情'}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="关闭" onPress={() => editor.setActiveSheet(null)} style={styles.sheetClose}>
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            {editor.activeSheet === 'photos' ? (
              <View style={styles.sheetActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="从相册或文件选择照片"
                  onPress={() => {
                    editor.setActiveSheet(null);
                    void editor.pickImages();
                  }}
                  style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
                >
                  <ImageIcon size={19} color={colors.accent} />
                  <Text style={styles.actionButtonText}>选择照片</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="现场拍摄照片"
                  onPress={() => {
                    editor.setActiveSheet(null);
                    void editor.takePhoto();
                  }}
                  style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
                >
                  <Camera size={19} color={colors.accent} />
                  <Text style={styles.actionButtonText}>现场拍摄</Text>
                </Pressable>
              </View>
            ) : null}

            {editor.activeSheet === 'people' ? (
              <View style={styles.peopleGrid}>
                {editor.people.map((person) => {
                  const active = editor.selectedPersonIds.includes(person.id);
                  return (
                    <Pressable
                      key={person.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${active ? '取消选择' : '选择'}${person.name}`}
                      accessibilityState={{ selected: active }}
                      onPress={() => editor.togglePerson(person.id)}
                      style={[styles.personOption, active && styles.personOptionActive]}
                    >
                      <Avatar name={person.name} size={40} highlighted={active} avatarUri={person.avatarUri} />
                      <Text style={[styles.personOptionText, active && styles.personOptionTextActive]} numberOfLines={1}>{person.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {editor.activeSheet === 'format' ? (
              <View style={styles.formatGrid}>
                {editor.formatTemplates.map((item) => {
                  const Icon = iconForFormat(item.label);
                  return (
                    <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={`插入${item.label}`} onPress={() => editor.insertWritingText(item.value)} style={({ pressed }) => [styles.formatButton, pressed && styles.actionButtonPressed]}>
                      <Icon size={18} color={colors.accent} strokeWidth={1.8} />
                      <Text style={styles.actionButtonText}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {editor.activeSheet === 'voice' ? (
              <View style={styles.voicePanel}>
                <View style={styles.voiceStatus}>
                  {editor.recording ? <Mic size={20} color={colors.danger} strokeWidth={1.8} /> : <Square size={20} color={colors.accent} strokeWidth={1.8} />}
                  <View style={styles.voiceCopy}>
                    <Text style={styles.voiceTitle}>{editor.recording ? '正在录音' : editor.voiceNotes.length > 0 ? `已添加 ${editor.voiceNotes.length} 段录音` : '添加一段语音备注'}</Text>
                    <Text style={styles.voiceHint}>录音会跟这条日记一起保存，适合保留当时的语气。</Text>
                  </View>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={editor.recording ? '停止录音' : '开始录音'} onPress={editor.recording ? editor.stopRecording : editor.startRecording} style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}>
                  <Mic size={19} color={editor.recording ? colors.danger : colors.accent} />
                  <Text style={styles.actionButtonText}>{editor.recording ? '停止录音' : '开始录音'}</Text>
                </Pressable>
              </View>
            ) : null}

            {editor.activeSheet === 'tags' ? (
              <View style={styles.tagPanel}>
                <View style={styles.tagInputRow}>
                  <Tag size={18} color={colors.accent} strokeWidth={1.8} />
                  <TextInput
                    accessibilityLabel="输入标记"
                    value={editor.tagInput}
                    onChangeText={editor.setTagInput}
                    placeholder="比如 家人、旅行、旧照片"
                    placeholderTextColor={colors.textTertiary}
                    onSubmitEditing={() => editor.addTag(editor.tagInput)}
                    style={styles.tagInput}
                  />
                  <Pressable accessibilityRole="button" accessibilityLabel="添加标记" onPress={() => editor.addTag(editor.tagInput)} style={styles.tagAddButton}>
                    <Text style={styles.tagAddText}>记下</Text>
                  </Pressable>
                </View>
                {editor.tagSuggestions.length > 0 ? (
                  <View style={styles.tagSuggestions}>
                    {editor.tagSuggestions.map((tag) => (
                      <Pressable key={tag} accessibilityRole="button" accessibilityLabel={`选择标记${tag}`} onPress={() => editor.addTag(tag)} style={styles.tagSuggestion}>
                        <Text style={styles.tagSuggestionText}>#{tag}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {editor.activeSheet === 'mood' ? (
              <View style={styles.moodGrid}>
                {moods.map((item) => {
                  const selected = editor.mood === item;
                  return (
                    <Pressable
                      key={item}
                      accessibilityRole="button"
                      accessibilityLabel={`${selected ? '取消选择' : '选择'}${item}心情`}
                      accessibilityState={{ selected }}
                      onPress={() => {
                        void selectionFeedback();
                        editor.setMood(selected ? null : item);
                        editor.setActiveSheet(null);
                      }}
                      style={[styles.moodPill, selected && styles.moodPillActive]}
                    >
                      <Text style={[styles.moodText, selected && styles.moodTextActive]}>{item}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={archiveOpen} transparent animationType="fade" onRequestClose={() => setArchiveOpen(false)}>
        <Pressable style={styles.archiveBackdrop} onPress={() => setArchiveOpen(false)}>
          <Pressable style={[styles.archiveSheet, { width: contentWidth }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>草稿箱</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="关闭草稿箱" onPress={() => setArchiveOpen(false)} style={styles.sheetClose}>
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={styles.archiveList} contentContainerStyle={styles.archiveContent}>
              {archivedDrafts.length === 0 ? (
                <Text style={styles.archiveEmpty}>草稿箱是空的。写一点后点“存草稿”留个快照。</Text>
              ) : archivedDrafts.map((item) => (
                <View key={item.id} style={styles.archiveItem}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="恢复这份草稿"
                    onPress={() => restoreArchive(item)}
                    style={({ pressed }) => [styles.archiveItemMain, pressed && styles.archiveItemPressed]}
                  >
                    <Text style={styles.archivePreview} numberOfLines={2}>{item.content.trim() || '（只有照片或标记的草稿）'}</Text>
                    <Text style={styles.archiveMeta}>{item.personIds.length > 0 ? `关于 ${item.personIds.length} 人` : '我的时间线'}{item.attachments.length > 0 ? ` · ${item.attachments.length} 张照片` : ''}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="恢复"
                    onPress={() => restoreArchive(item)}
                    style={styles.archiveRestore}
                  >
                    <History size={16} color={colors.accent} strokeWidth={2.2} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="删除这份草稿"
                    onPress={() => void removeArchive(item.id)}
                    style={styles.archiveDelete}
                  >
                    <Trash2 size={16} color={colors.danger} strokeWidth={2.2} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Animated.View pointerEvents="none" style={[styles.saveDot, { opacity: saveDotOpacity, transform: [{ translateY: saveDotOffset }] }]} />

      {toast ? (
        <Animated.View pointerEvents="none" style={[styles.toast, { opacity: toastOpacity, transform: [{ translateY: toastOffset }] }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  topRow: {
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  topCenter: {
    alignItems: 'center',
    gap: 2,
  },
  topTitle: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '600',
    lineHeight: typography.lineHeights.title,
    includeFontPadding: false,
  },
  cancel: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    includeFontPadding: false,
  },
  date: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.micro,
    lineHeight: typography.lineHeights.micro,
    includeFontPadding: false,
  },
  save: {
    color: colors.accent,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '600',
    lineHeight: typography.lineHeights.title,
    includeFontPadding: false,
  },
  saveDisabled: {
    opacity: 0.35,
  },
  editorWrap: {
    flexGrow: 1,
    gap: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  draftNotice: {
    minHeight: 44,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.button,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    backgroundColor: colors.surfaceMint,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
  },
  draftText: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    includeFontPadding: false,
  },
  draftClose: {
    width: 36,
    height: 36,
    borderRadius: radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'center',
  },
  draftBarAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 34,
    borderRadius: radius.button,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    backgroundColor: colors.bgSecondary,
    paddingHorizontal: spacing.md,
    ...shadows.card,
  },
  draftBarActionPressed: {
    backgroundColor: colors.bgWash,
  },
  draftBarActionDisabled: {
    opacity: 0.5,
  },
  draftBarText: {
    color: colors.accent,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: '700',
    includeFontPadding: false,
  },
  draftBarTextDisabled: {
    color: colors.textTertiary,
  },
  archiveBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: colors.scrim,
    padding: spacing.lg,
  },
  archiveSheet: {
    maxWidth: 680,
    maxHeight: '80%',
    borderRadius: radius.card,
    borderWidth: strokeWidth.card,
    borderColor: colors.stroke,
    backgroundColor: colors.bgPaper,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.sheet,
  },
  archiveList: {
    maxHeight: 440,
  },
  archiveContent: {
    gap: spacing.sm,
  },
  archiveEmpty: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    textAlign: 'center',
    paddingVertical: spacing.xl,
    includeFontPadding: false,
  },
  archiveItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.button,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    backgroundColor: colors.bgWash,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
  archiveItemMain: {
    flex: 1,
    gap: 2,
    paddingVertical: spacing.sm,
  },
  archiveItemPressed: {
    opacity: 0.6,
  },
  archivePreview: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.reading,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    includeFontPadding: false,
  },
  archiveMeta: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.micro,
    lineHeight: typography.lineHeights.micro,
    includeFontPadding: false,
  },
  archiveRestore: {
    width: 40,
    height: 40,
    borderRadius: radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  archiveDelete: {
    width: 40,
    height: 40,
    borderRadius: radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: colors.scrim,
    padding: spacing.lg,
  },
  sheet: {
    maxWidth: 680,
    borderRadius: radius.card,
    borderWidth: strokeWidth.card,
    borderColor: colors.stroke,
    backgroundColor: colors.bgPaper,
    padding: spacing.lg,
    gap: spacing.lg,
    ...shadows.sheet,
  },
  sheetHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: '600',
    includeFontPadding: false,
  },
  sheetClose: {
    width: 44,
    height: 44,
    borderRadius: radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgWash,
  },
  sheetActions: {
    gap: spacing.sm,
  },
  actionButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.button,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    backgroundColor: colors.bgWash,
    paddingHorizontal: spacing.lg,
  },
  actionButtonPressed: {
    backgroundColor: colors.surfaceMint,
  },
  actionButtonText: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: '500',
    includeFontPadding: false,
  },
  peopleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  formatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  formatButton: {
    minHeight: 52,
    minWidth: 112,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.button,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    backgroundColor: colors.bgWash,
    paddingHorizontal: spacing.lg,
  },
  voicePanel: {
    gap: spacing.lg,
  },
  voiceStatus: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.bgWash,
    padding: spacing.lg,
  },
  voiceCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  voiceTitle: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: '600',
    includeFontPadding: false,
  },
  voiceHint: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    includeFontPadding: false,
  },
  tagPanel: {
    gap: spacing.lg,
  },
  tagInputRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.button,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    backgroundColor: colors.bgWash,
    paddingHorizontal: spacing.md,
  },
  tagInput: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    paddingVertical: 0,
  },
  tagAddButton: {
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: radius.button,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
  },
  tagAddText: {
    color: colors.bgPaper,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: '600',
    includeFontPadding: false,
  },
  tagSuggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tagSuggestion: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: radius.button,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    backgroundColor: colors.bgWash,
    paddingHorizontal: spacing.md,
  },
  tagSuggestionText: {
    color: colors.accent,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: '600',
    includeFontPadding: false,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  personOption: {
    minWidth: 76,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.button,
    backgroundColor: colors.bgWash,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    paddingHorizontal: spacing.sm,
  },
  personOptionActive: {
    backgroundColor: colors.surfaceMint,
    borderColor: colors.stroke,
  },
  personOptionText: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.micro,
    lineHeight: typography.lineHeights.micro,
    maxWidth: 56,
    includeFontPadding: false,
  },
  personOptionTextActive: {
    color: colors.accent,
  },
  moodPill: {
    minHeight: 44,
    borderRadius: radius.button,
    backgroundColor: colors.bgWash,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  moodPillActive: {
    backgroundColor: colors.surfaceMint,
    borderColor: colors.surfaceMint,
  },
  moodText: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    includeFontPadding: false,
  },
  moodTextActive: {
    color: colors.textPrimary,
  },
  saveDot: {
    position: 'absolute',
    top: 62,
    right: spacing.xxl,
    width: 6,
    height: 6,
    borderRadius: radius.circle,
    backgroundColor: colors.accent,
  },
  toast: {
    position: 'absolute',
    left: spacing.xxl,
    right: spacing.xxl,
    bottom: 120,
    backgroundColor: colors.surfaceMint,
    borderRadius: radius.card,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  toastText: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
