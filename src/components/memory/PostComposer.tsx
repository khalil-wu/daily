import { AtSign, ChevronRight, Eye, Image as ImageIcon, LockKeyhole, MapPin, Mic, Plus, SmilePlus, Tag, TextCursorInput, UsersRound, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { Avatar } from '@/src/components/person/Avatar';
import { MemoryAttachment, MemoryLocation, MemoryVoiceNote } from '@/src/data/mock';
import { WritingPreview } from '@/src/markdown/renderMarkdown';
import { alpha, colors, getContentWidth, radius, shadows, spacing, strokeWidth, typography } from '@/src/theme';

type SelectedPerson = {
  id: string;
  name: string;
  recent?: boolean;
  avatarUri?: string | null;
};

type Props = {
  authorName: string;
  authorHighlighted?: boolean;
  meta: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  attachments: MemoryAttachment[];
  voiceNotes?: MemoryVoiceNote[];
  tags?: string[];
  previewMode?: boolean;
  onAddImages: () => void;
  onRemoveAttachment: (id: string) => void;
  selectedPeople: SelectedPerson[];
  mood?: string | null;
  location?: MemoryLocation | null;
  locationLoading?: boolean;
  privacyLabel?: string | null;
  targetLabel?: string;
  onPressLocation?: () => void;
  onPressPhotos?: () => void;
  onPressFormat?: () => void;
  onPressVoice?: () => void;
  onPressTags?: () => void;
  onRemoveTag?: (tag: string) => void;
  onTogglePreview?: () => void;
  onPressTarget?: () => void;
  onPressMention?: () => void;
  onPressMood?: () => void;
  onTogglePrivacy?: () => void;
  saveStatus?: 'idle' | 'saving' | 'saved';
  durationLabel?: string;
};

export function PostComposer({
  authorName,
  authorHighlighted,
  meta,
  value,
  onChangeText,
  placeholder,
  attachments,
  voiceNotes = [],
  tags = [],
  previewMode = false,
  onAddImages,
  onRemoveAttachment,
  selectedPeople,
  mood,
  location,
  locationLoading,
  privacyLabel,
  targetLabel = '我的时间线',
  onPressLocation,
  onPressPhotos,
  onPressFormat,
  onPressVoice,
  onPressTags,
  onRemoveTag,
  onTogglePreview,
  onPressTarget,
  onPressMention,
  onPressMood,
  onTogglePrivacy,
  saveStatus = 'idle',
  durationLabel,
}: Props) {
  const { width } = useWindowDimensions();
  const surfaceWidth = useMemo(() => getContentWidth(width, { maxWidth: 680 }), [width]);
  const attachmentSize = useMemo(() => {
    const available = Math.max(232, surfaceWidth - spacing.lg * 2 - 12);
    return Math.max(76, Math.min(116, Math.floor(available / 3)));
  }, [surfaceWidth]);
  const hasContext = selectedPeople.length > 0;
  const visibilityLabel = privacyLabel ?? '公开';
  const charCount = useMemo(() => {
    const stripped = value.replace(/\s/g, '');
    return stripped.length;
  }, [value]);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (saveStatus === 'saving') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.25, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    if (saveStatus === 'saved') {
      pulseAnim.setValue(0.5);
    } else {
      pulseAnim.setValue(0);
    }
    return undefined;
  }, [saveStatus, pulseAnim]);

  const renderSettingRow = ({
    label,
    value,
    Icon,
    active,
    onPress,
    accessibilityLabel,
  }: {
    label: string;
    value: string;
    Icon: typeof MapPin;
    active?: boolean;
    onPress?: () => void;
    accessibilityLabel: string;
  }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]}
    >
      <View style={[styles.settingIcon, active && styles.settingIconActive]}>
        <Icon size={19} color={active ? colors.accent : colors.textPrimary} strokeWidth={1.8} />
      </View>
      <View style={styles.settingCopy}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={[styles.settingValue, active && styles.settingValueActive]} numberOfLines={1}>{value}</Text>
      </View>
      <ChevronRight size={17} color={colors.textTertiary} strokeWidth={1.8} />
    </Pressable>
  );

  return (
    <View style={[styles.composerSurface, { width: surfaceWidth }]}>
      <View style={styles.editorFrame}>
        <View style={styles.editorTopBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={previewMode ? '切回编辑模式' : '查看排版效果'}
            onPress={onTogglePreview}
            disabled={!onTogglePreview}
            style={({ pressed }) => [styles.toolPill, previewMode && styles.toolPillActive, pressed && styles.toolPillPressed]}
          >
            {previewMode ? <TextCursorInput size={16} color={colors.accent} strokeWidth={1.8} /> : <Eye size={16} color={colors.textSecondary} strokeWidth={1.8} />}
            <Text style={[styles.toolPillText, previewMode && styles.toolPillTextActive]}>{previewMode ? '编辑' : '效果'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="打开排版工具"
            onPress={onPressFormat}
            disabled={!onPressFormat}
            style={({ pressed }) => [styles.toolPill, pressed && styles.toolPillPressed]}
          >
            <Text style={styles.typeIcon}>Aa</Text>
            <Text style={styles.toolPillText}>排版</Text>
          </Pressable>
        </View>
        {previewMode ? (
          <WritingPreview value={value} emptyText="写一点内容后，这里会显示排版效果。" />
        ) : (
          <TextInput
            accessibilityLabel="动态正文"
            multiline
            autoFocus
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.accent}
            style={styles.editor}
          />
        )}
      </View>

      {attachments.length > 0 ? (
        <View style={styles.attachmentGrid}>
          {attachments.map((attachment) => (
            <View key={attachment.id} style={[styles.attachmentItem, { width: attachmentSize, height: attachmentSize }]}>
              <Image source={{ uri: attachment.uri }} style={styles.attachmentImage} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="移除这张照片"
                onPress={() => onRemoveAttachment(attachment.id)}
                hitSlop={8}
                style={styles.removeAttachment}
              >
                <X size={13} color={colors.bgPaper} />
              </Pressable>
            </View>
          ))}
          {attachments.length < 9 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="继续添加照片"
              onPress={onAddImages}
              style={[styles.attachmentItem, styles.addAttachment, { width: attachmentSize, height: attachmentSize }]}
            >
              <Plus size={28} color={colors.textTertiary} strokeWidth={1.6} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {tags.length > 0 ? (
        <View style={styles.tagRow}>
          {tags.map((tag) => (
            <Pressable
              key={tag}
              accessibilityRole="button"
              accessibilityLabel={`移除标记${tag}`}
              onPress={() => onRemoveTag?.(tag)}
              style={styles.tagChip}
            >
              <Text style={styles.tagText}>#{tag}</Text>
              <X size={12} color={colors.textTertiary} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.settingsList}>
        {renderSettingRow({
          label: '位置',
          value: locationLoading ? '正在定位...' : location?.label ?? '未选择',
          Icon: MapPin,
          active: Boolean(location),
          onPress: onPressLocation,
          accessibilityLabel: location ? `重新定位，当前为${location.label}` : '选择位置',
        })}
        {renderSettingRow({
          label: '照片',
          value: attachments.length > 0 ? `${attachments.length} 张` : '未添加',
          Icon: ImageIcon,
          active: attachments.length > 0,
          onPress: onPressPhotos,
          accessibilityLabel: attachments.length > 0 ? `管理照片，当前${attachments.length}张` : '添加照片',
        })}
        {renderSettingRow({
          label: '录音',
          value: voiceNotes.length > 0 ? `${voiceNotes.length} 段语音` : '未添加',
          Icon: Mic,
          active: voiceNotes.length > 0,
          onPress: onPressVoice,
          accessibilityLabel: voiceNotes.length > 0 ? `管理录音，当前${voiceNotes.length}段` : '添加录音',
        })}
        {renderSettingRow({
          label: '标记',
          value: tags.length > 0 ? tags.join('、') : '未添加',
          Icon: Tag,
          active: tags.length > 0,
          onPress: onPressTags,
          accessibilityLabel: tags.length > 0 ? `管理标记，当前${tags.join('、')}` : '添加标记',
        })}
        {renderSettingRow({
          label: '排版',
          value: '标题、引用、清单、分隔',
          Icon: TextCursorInput,
          active: previewMode,
          onPress: onPressFormat,
          accessibilityLabel: '打开排版工具',
        })}
        {renderSettingRow({
          label: '发布到',
          value: targetLabel,
          Icon: UsersRound,
          active: selectedPeople.length > 0,
          onPress: onPressTarget,
          accessibilityLabel: `选择发布到，当前为${targetLabel}`,
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`切换可见范围，当前为${visibilityLabel}`}
          onPress={onTogglePrivacy}
          disabled={!onTogglePrivacy}
          style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]}
        >
          <View style={[styles.settingIcon, privacyLabel && styles.settingIconActive]}>
            <LockKeyhole size={19} color={privacyLabel ? colors.accent : colors.textPrimary} strokeWidth={1.8} />
          </View>
          <View style={styles.settingCopy}>
            <Text style={styles.settingLabel}>可见范围</Text>
            <Text style={[styles.settingValue, privacyLabel && styles.settingValueActive]}>{visibilityLabel}</Text>
          </View>
          <ChevronRight size={17} color={colors.textTertiary} strokeWidth={1.8} />
        </Pressable>
        {renderSettingRow({
          label: '提及',
          value: selectedPeople.length > 0 ? `${selectedPeople.length} 人` : '未提及',
          Icon: AtSign,
          active: selectedPeople.length > 0,
          onPress: onPressMention,
          accessibilityLabel: '选择提及的人',
        })}
        {renderSettingRow({
          label: '心情',
          value: mood ?? '未选择',
          Icon: SmilePlus,
          active: Boolean(mood),
          onPress: onPressMood,
          accessibilityLabel: mood ? `重新选择心情，当前为${mood}` : '选择心情',
        })}
      </View>

      {hasContext ? (
        <View style={styles.selectedRow}>
          {selectedPeople.map((person) => (
            <View key={person.id} style={styles.selectedChip}>
              <Avatar name={person.name} size={22} highlighted={person.recent ?? authorHighlighted} avatarUri={person.avatarUri} />
              <Text style={styles.selectedName}>{person.name}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.authorFootnote}>
        <Text style={styles.authorFootnoteText}>{authorName}</Text>
        <Text style={styles.authorFootnoteMeta}>{meta}</Text>
      </View>

      {/* 写作状态栏：字数 + 时长 + 自动保存指示 */}
      <View style={styles.statusBar}>
        <View style={styles.statusGroup}>
          <Text style={styles.statusText}>{charCount} 字</Text>
          {durationLabel ? (
            <>
              <Text style={styles.statusDot}>·</Text>
              <Text style={styles.statusText}>{durationLabel}</Text>
            </>
          ) : null}
        </View>
        {saveStatus !== 'idle' ? (
          <View style={styles.saveIndicator}>
            <Animated.View
              style={[
                styles.saveDot,
                { opacity: saveStatus === 'saving' ? pulseAnim : 0.5, backgroundColor: saveStatus === 'saving' ? colors.accent : colors.textTertiary },
              ]}
            />
            <Text style={styles.saveText}>{saveStatus === 'saving' ? '正在保存' : '已保存'}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  composerSurface: {
    minHeight: 430,
    gap: spacing.lg,
    alignSelf: 'center',
  },
  editorFrame: {
    minHeight: 248,
    justifyContent: 'flex-start',
    gap: spacing.lg,
    backgroundColor: colors.bgPaper,
    borderRadius: radius.card,
    borderWidth: strokeWidth.card,
    borderColor: colors.stroke,
    padding: spacing.xl,
    ...shadows.card,
  },
  editorTopBar: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  toolPill: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.button,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    backgroundColor: colors.bgWash,
    paddingHorizontal: spacing.md,
  },
  toolPillActive: {
    backgroundColor: colors.surfaceMint,
    borderColor: colors.line,
  },
  toolPillPressed: {
    backgroundColor: colors.bgElevated,
  },
  toolPillText: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: '600',
    includeFontPadding: false,
  },
  toolPillTextActive: {
    color: colors.accent,
  },
  typeIcon: {
    color: colors.accent,
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: '700',
    includeFontPadding: false,
  },
  editor: {
    minHeight: 208,
    color: colors.textPrimary,
    fontSize: typography.postBody,
    lineHeight: typography.lineHeights.postBody,
    fontFamily: typography.fontFamily.reading,
    fontWeight: '400',
    letterSpacing: 0,
    includeFontPadding: false,
    backgroundColor: 'transparent',
    textAlignVertical: 'top',
    padding: 0,
  },
  attachmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  attachmentItem: {
    borderRadius: radius.input,
    overflow: 'hidden',
    backgroundColor: colors.bgElevated,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
  },
  addAttachment: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    backgroundColor: colors.bgWash,
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
    borderRadius: radius.input,
  },
  removeAttachment: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha.scrim,
    borderWidth: 1,
    borderColor: colors.bgPaper,
  },
  settingsList: {
    backgroundColor: colors.bgPaper,
    borderWidth: strokeWidth.card,
    borderColor: colors.stroke,
    borderRadius: radius.card,
    overflow: 'hidden',
    ...shadows.card,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tagChip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.input,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    backgroundColor: colors.bgPaper,
    paddingHorizontal: spacing.md,
  },
  tagText: {
    color: colors.accent,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: '600',
    includeFontPadding: false,
  },
  settingRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  settingRowPressed: {
    backgroundColor: colors.bgWash,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgWash,
  },
  settingIconActive: {
    backgroundColor: colors.surfaceMint,
  },
  settingCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  settingLabel: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: '500',
    includeFontPadding: false,
  },
  settingValue: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    includeFontPadding: false,
  },
  settingValueActive: {
    color: colors.accent,
    fontWeight: '500',
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bgPaper,
    borderRadius: radius.input,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    paddingLeft: 4,
    paddingRight: spacing.md,
    paddingVertical: 8,
  },
  selectedName: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    includeFontPadding: false,
  },
  authorFootnote: {
    alignItems: 'flex-start',
    gap: 2,
  },
  authorFootnoteText: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: '600',
    includeFontPadding: false,
  },
  authorFootnoteMeta: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.micro,
    lineHeight: typography.lineHeights.micro,
    includeFontPadding: false,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusText: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.micro,
    lineHeight: typography.lineHeights.micro,
    includeFontPadding: false,
  },
  statusDot: {
    color: colors.textTertiary,
    fontSize: typography.micro,
    includeFontPadding: false,
  },
  saveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  saveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  saveText: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.micro,
    lineHeight: typography.lineHeights.micro,
    includeFontPadding: false,
  },
});
