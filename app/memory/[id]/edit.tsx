import { useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Bold, Camera, CheckSquare, Heading1, Heading2, Image as ImageIcon, List, Mic, Quote, SeparatorHorizontal, Square, Tag, X } from 'lucide-react-native';
import {
  Alert,
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
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { Screen } from '@/src/components/ui/Screen';
import { selectionFeedback } from '@/src/motion';
import { useMoodStore } from '@/src/stores/useMoodStore';
import { useVisibleDiaryData } from '@/src/privacy/useVisibleDiaryData';
import { useDiaryStore } from '@/src/stores/useDiaryStore';
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

export default function EditMemoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const updateMemory = useDiaryStore((state) => state.updateMemory);
  const { visibleMemories } = useVisibleDiaryData();
  const memory = visibleMemories.find((item) => item.id === id);
  const editor = useMemoryEditor(
    memory
      ? {
          content: memory.content,
          mood: memory.mood,
          personIds: memory.personIds,
          attachments: memory.attachments,
          voiceNotes: memory.voiceNotes,
          location: memory.location,
          privacyMode: memory.isPrivate ? memory.privacyMode ?? 'hidden' : null,
          tags: memory.tags,
        }
      : {},
    visibleMemories,
  );
  const { width } = useWindowDimensions();
  const contentWidth = useMemo(() => getContentWidth(width, { maxWidth: 680 }), [width]);
  const moodList = useMoodStore((state) => state.moods);
  const moodHydrated = useMoodStore((state) => state.hydrated);
  const hydrateMoods = useMoodStore((state) => state.hydrate);
  const addMood = useMoodStore((state) => state.addMood);
  const removeMood = useMoodStore((state) => state.removeMood);
  const [moodAddOpen, setMoodAddOpen] = useState(false);
  const [moodEmoji, setMoodEmoji] = useState('⭐');
  const [moodLabel, setMoodLabel] = useState('');
  useEffect(() => { void hydrateMoods(); }, [hydrateMoods]);
  const composerPerson = editor.people.find((person) => editor.selectedPersonIds.includes(person.id));
  const composerName = composerPerson?.name ?? '我';
  const composerSubline = memory
    ? composerPerson
      ? `关于 ${composerPerson.name} · ${memory.date}`
      : `记得日记 · ${memory.date}`
    : '记得日记';
  const title = useMemo(() => {
    if (!memory) return '编辑动态';
    const firstPerson = editor.people.find((person) => memory.personIds.includes(person.id));
    return firstPerson ? `关于${firstPerson.name}` : '编辑动态';
  }, [memory, editor.people]);

  if (!memory || memory.isMasked) {
    return (
      <Screen>
        <View style={styles.notFound}>
          <Text style={styles.empty}>{memory?.isMasked ? '先解锁后再编辑这段记忆。' : '没找到这段记忆。'}</Text>
          <PrimaryButton label="回去看看" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const close = () => {
    if (!editor.dirty) {
      router.back();
      return;
    }

    Alert.alert('这次修改还没记下，要离开吗？', '', [
      { text: '不留了', style: 'destructive', onPress: () => router.back() },
      { text: '再想想', style: 'cancel' },
    ]);
  };

  const save = () => {
    if (!editor.canSave) return;
    updateMemory({ id: memory.id, ...editor.saveInput });
    router.back();
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.topRow, { width: contentWidth }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="取消编辑动态" onPress={close} hitSlop={12}>
            <Text style={styles.cancel}>取消</Text>
          </Pressable>
          <View style={styles.topCenter}>
            <Text style={styles.topTitle}>{title}</Text>
            <Text style={styles.date}>{memory.date}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="保存这条动态"
            accessibilityState={{ disabled: !editor.canSave }}
            onPress={save}
            hitSlop={12}
            disabled={!editor.canSave}
          >
            <Text style={[styles.save, !editor.canSave && styles.saveDisabled]}>保存</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.flex}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.editorWrap}
        >
          <PostComposer
            authorName={composerName}
            authorHighlighted={composerPerson?.recent}
            meta={composerSubline}
            value={editor.content}
            onChangeText={editor.setContent}
            placeholder="这一刻的想法..."
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
                {moodList.map((item) => {
                  const selected = editor.mood === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${selected ? '取消选择' : '选择'}${item.label}心情${item.custom ? '，长按删除' : ''}`}
                      accessibilityState={{ selected }}
                      onPress={() => {
                        void selectionFeedback();
                        editor.setMood(selected ? null : item.id);
                        editor.setActiveSheet(null);
                      }}
                      onLongPress={item.custom ? () => {
                        void selectionFeedback();
                        removeMood(item.id);
                      } : undefined}
                      style={[styles.moodPill, selected && styles.moodPillActive]}
                    >
                      <Text style={styles.moodEmoji}>{item.emoji}</Text>
                      <Text style={[styles.moodText, selected && styles.moodTextActive]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="添加自定义心情"
                  onPress={() => { void selectionFeedback(); setMoodAddOpen(true); }}
                  style={styles.moodPill}
                >
                  <Text style={styles.moodEmoji}>＋</Text>
                  <Text style={styles.moodText}>自定义</Text>
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={moodAddOpen} transparent animationType="fade" onRequestClose={() => setMoodAddOpen(false)}>
        <Pressable style={styles.moodAddBackdrop} onPress={() => setMoodAddOpen(false)}>
          <Pressable style={[styles.moodAddSheet, { width: contentWidth }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>添加心情</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="关闭" onPress={() => setMoodAddOpen(false)} style={styles.sheetClose}>
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            <View style={styles.moodAddRow}>
              <TextInput
                accessibilityLabel="心情表情"
                value={moodEmoji}
                onChangeText={setMoodEmoji}
                maxLength={4}
                style={styles.moodAddEmoji}
              />
              <TextInput
                accessibilityLabel="心情名字"
                value={moodLabel}
                onChangeText={setMoodLabel}
                placeholder="给心情起个名字"
                placeholderTextColor={colors.textTertiary}
                maxLength={8}
                style={styles.moodAddLabel}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="保存这个心情"
              disabled={!moodLabel.trim()}
              onPress={() => {
                const created = addMood(moodEmoji, moodLabel);
                if (created) {
                  void selectionFeedback();
                  editor.setMood(created.id);
                  setMoodEmoji('⭐');
                  setMoodLabel('');
                  setMoodAddOpen(false);
                  editor.setActiveSheet(null);
                }
              }}
              style={({ pressed }) => [styles.pickerConfirm, pressed && styles.pickerConfirmPressed, !moodLabel.trim() && { opacity: 0.4 }]}
            >
              <Text style={styles.pickerConfirmText}>记下这个心情</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
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
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.button,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
  },
  tagAddText: {
    color: colors.textPrimary,
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
    borderColor: colors.surfaceMint,
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
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minWidth: 72,
    minHeight: 64,
    borderRadius: radius.button,
    backgroundColor: colors.bgWash,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  moodPillActive: {
    backgroundColor: colors.surfaceMint,
    borderColor: colors.stroke,
  },
  moodEmoji: {
    fontSize: 22,
    includeFontPadding: false,
  },
  moodText: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: '600',
    includeFontPadding: false,
  },
  moodTextActive: {
    color: colors.textPrimary,
  },
  moodAddBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: colors.scrim,
    padding: spacing.lg,
  },
  moodAddSheet: {
    maxWidth: 680,
    borderRadius: radius.card,
    borderWidth: strokeWidth.card,
    borderColor: colors.stroke,
    backgroundColor: colors.bgPaper,
    padding: spacing.lg,
    gap: spacing.lg,
    ...shadows.sheet,
  },
  moodAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  moodAddEmoji: {
    width: 64,
    height: 56,
    fontSize: 28,
    textAlign: 'center',
    color: colors.textPrimary,
    borderRadius: radius.input,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    backgroundColor: colors.bgWash,
    includeFontPadding: false,
  },
  moodAddLabel: {
    flex: 1,
    height: 56,
    fontSize: typography.body,
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    borderRadius: radius.input,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    backgroundColor: colors.bgWash,
    paddingHorizontal: spacing.md,
    includeFontPadding: false,
  },
  pickerConfirm: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.button,
    borderWidth: strokeWidth.button,
    borderColor: colors.stroke,
    backgroundColor: colors.accent,
    ...shadows.accent,
  },
  pickerConfirmPressed: {
    backgroundColor: colors.accentDim,
  },
  pickerConfirmText: {
    color: colors.bgPaper,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: '700',
    includeFontPadding: false,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  empty: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
