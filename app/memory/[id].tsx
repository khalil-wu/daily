import { router, useLocalSearchParams } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { ChevronLeft, ChevronRight, Edit3, LockKeyhole, Mic, Pause, Play, Trash2, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Avatar } from '@/src/components/person/Avatar';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { Screen } from '@/src/components/ui/Screen';
import { WritingPreview } from '@/src/markdown/renderMarkdown';
import { selectionFeedback } from '@/src/motion';
import { useVisibleDiaryData } from '@/src/privacy/useVisibleDiaryData';
import { useDiaryStore } from '@/src/stores/useDiaryStore';
import { useMoodStore } from '@/src/stores/useMoodStore';
import { resolveMood } from '@/src/i18n/copy';
import { alpha, colors, getContentWidth, radius, shadows, spacing, strokeWidth, typography } from '@/src/theme';
import type { MemoryVoiceNote } from '@/src/data/mock';

function formatVoiceTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function VoiceNotePlayer({ voice, index }: { voice: MemoryVoiceNote; index: number }) {
  const player = useAudioPlayer({ uri: voice.uri }, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const duration = status.duration > 0 ? status.duration : Math.max(1, voice.durationMs / 1000);
  const current = Math.min(duration, status.currentTime || 0);
  const progress = duration > 0 ? Math.min(1, current / duration) : 0;

  const toggle = () => {
    void selectionFeedback();
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish) {
      void player.seekTo(0);
    }
    player.play();
  };

  return (
    <View style={styles.voiceItem}>
      <Pressable accessibilityRole="button" accessibilityLabel={status.playing ? `暂停语音${index + 1}` : `播放语音${index + 1}`} onPress={toggle} hitSlop={6} style={styles.voiceButton}>
        {status.playing ? <Pause size={16} color={colors.textPrimary} /> : <Play size={16} color={colors.textPrimary} />}
      </Pressable>
      <Mic size={16} color={colors.accent} strokeWidth={1.8} />
      <View style={styles.voiceProgressWrap}>
        <Text style={styles.voiceText}>语音 {index + 1}</Text>
        <View style={styles.voiceTrack}>
          <View style={[styles.voiceProgress, { width: `${progress * 100}%` }]} />
        </View>
      </View>
      <Text style={styles.voiceDuration}>{formatVoiceTime(current)} / {formatVoiceTime(duration)}</Text>
    </View>
  );
}

export default function MemoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { visibleMemories, visiblePeople } = useVisibleDiaryData();
  const deleteMemory = useDiaryStore((state) => state.deleteMemory);
  const memory = visibleMemories.find((item) => item.id === id);
  const { width } = useWindowDimensions();
  const mediaSize = useMemo(() => {
    const contentWidth = getContentWidth(width, { maxWidth: 720 });
    const pageChrome = spacing.lg * 2 + 46 + spacing.md + spacing.sm * 2;
    const available = Math.max(240, contentWidth - pageChrome);
    return Math.max(76, Math.min(128, Math.floor(available / 3)));
  }, [width]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const moodRegistry = useMoodStore((state) => state.moods);

  if (!memory) {
    return (
      <Screen>
        <View style={styles.notFound}>
          <Text style={styles.empty}>没找到这段记忆。</Text>
          <PrimaryButton label="回去看看" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const relatedPeople = memory.personIds
    .map((personId) => visiblePeople.find((person) => person.id === personId))
    .filter((person): person is NonNullable<typeof person> => Boolean(person));
  const primaryPerson = relatedPeople[0];
  const authorName = primaryPerson?.name ?? '我';
  const authorSubline = primaryPerson ? `${primaryPerson.relation} · ${memory.date}` : memory.date;
  const targetLabel = primaryPerson ? `${primaryPerson.name}的时间线` : '我的时间线';
  const otherPeople = relatedPeople.slice(1);

  const remove = () => {
    Alert.alert('删除这条动态吗？', '它会从所有时间线里移开。', [
      { text: '再想想', style: 'cancel' },
      {
        text: '不留了',
        style: 'destructive',
        onPress: () => {
          deleteMemory(memory.id);
          router.replace('/(tabs)/timeline');
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="返回" onPress={() => router.back()} style={styles.iconButton}>
            <ChevronLeft size={22} color={colors.textSecondary} strokeWidth={2.2} />
          </Pressable>
          {!memory.isMasked ? (
            <View style={styles.actionRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="编辑动态"
                onPress={() => {
                  void selectionFeedback();
                  router.push(`/memory/${memory.id}/edit`);
                }}
                style={styles.iconButton}
              >
                <Edit3 size={17} color={colors.textSecondary} strokeWidth={2.2} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="删除动态" onPress={remove} style={[styles.iconButton, styles.dangerButton]}>
                <Trash2 size={17} color={colors.danger} />
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.postSurface}>
          <View style={styles.postRow}>
            <Avatar name={authorName} size={46} highlighted={primaryPerson?.recent} avatarUri={primaryPerson?.avatarUri} />
            <View style={styles.postBody}>
              <View style={styles.authorRow}>
                <View style={styles.authorText}>
                  <Text style={styles.authorName}>{authorName}</Text>
                  <Text style={styles.date}>{authorSubline}</Text>
                </View>
              </View>

              <WritingPreview value={memory.content} />

              {memory.voiceNotes?.length ? (
                <View style={styles.voiceList}>
                  {memory.voiceNotes.map((voice, index) => (
                    <VoiceNotePlayer key={voice.id} voice={voice} index={index} />
                  ))}
                </View>
              ) : null}

              {memory.hasMedia && !memory.isMasked ? (
                <View style={styles.mediaRow}>
                  {memory.attachments.length > 0 ? (
                    memory.attachments.map((attachment, attachIndex) => (
                      <Pressable
                        key={attachment.id}
                        accessibilityRole="button"
                        accessibilityLabel="查看大图"
                        onPress={() => {
                          void selectionFeedback();
                          setViewerIndex(attachIndex);
                        }}
                      >
                        <Image source={{ uri: attachment.uri }} style={[styles.mediaThumb, { width: mediaSize, height: mediaSize }]} />
                      </Pressable>
                    ))
                  ) : (
                    <>
                      <View style={[styles.mediaThumb, { width: mediaSize, height: mediaSize }]} />
                      <View style={[styles.mediaThumb, { width: mediaSize, height: mediaSize }]} />
                    </>
                  )}
                </View>
              ) : null}

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>{memory.date}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>{targetLabel}</Text>
                {(() => {
                  const mood = resolveMood(memory.mood, moodRegistry);
                  return mood ? (
                    <>
                      <Text style={styles.metaDot}>·</Text>
                      <Text style={styles.mood}>{mood.emoji} {mood.label}</Text>
                    </>
                  ) : null;
                })()}
                {memory.location ? (
                  <>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.metaText}>{memory.location.label}</Text>
                  </>
                ) : null}
                {memory.isPrivate ? (
                  <View style={styles.privatePill}>
                    <LockKeyhole size={12} color={colors.accent} />
                    <Text style={styles.privateText}>私密</Text>
                  </View>
                ) : null}
              </View>

              {memory.tags?.length ? (
                <View style={styles.tagRow}>
                  {memory.tags.map((tag) => (
                    <View key={tag} style={styles.tagPill}>
                      <Text style={styles.tagText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {otherPeople.length > 0 ? (
                <View style={styles.peopleRow}>
                  {otherPeople.map((person) => (
                    <Pressable
                      key={person.id}
                      accessibilityRole="button"
                      accessibilityLabel={`查看${person.name}的时间线`}
                      onPress={() => {
                        void selectionFeedback();
                        router.push(`/person/${person.id}`);
                      }}
                      style={styles.personChip}
                    >
                      <Avatar name={person.name} size={28} highlighted={person.recent} avatarUri={person.avatarUri} />
                      <Text style={styles.personName}>{person.name}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal visible={viewerIndex !== null} transparent animationType="fade" onRequestClose={() => setViewerIndex(null)}>
        <View style={styles.viewer}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setViewerIndex(null)} />
          {viewerIndex !== null && memory.attachments[viewerIndex] ? (
            <Image
              source={{ uri: memory.attachments[viewerIndex].uri }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          ) : null}
          {viewerIndex !== null && viewerIndex > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="上一张"
              onPress={() => {
                void selectionFeedback();
                setViewerIndex((prev) => (prev !== null ? prev - 1 : null));
              }}
              style={styles.viewerNavLeft}
            >
              <ChevronLeft size={28} color={colors.bgPaper} strokeWidth={2.2} />
            </Pressable>
          ) : null}
          {viewerIndex !== null && viewerIndex < memory.attachments.length - 1 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="下一张"
              onPress={() => {
                void selectionFeedback();
                setViewerIndex((prev) => (prev !== null ? prev + 1 : null));
              }}
              style={styles.viewerNavRight}
            >
              <ChevronRight size={28} color={colors.bgPaper} strokeWidth={2.2} />
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel="关闭大图" onPress={() => setViewerIndex(null)} style={styles.viewerClose}>
            <X size={22} color={colors.bgPaper} strokeWidth={2.2} />
          </Pressable>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSecondary,
    borderWidth: strokeWidth.button,
    borderColor: colors.stroke,
    ...shadows.card,
  },
  dangerButton: {
    borderWidth: strokeWidth.button,
    borderColor: colors.danger,
  },
  postSurface: {
    padding: spacing.lg,
    borderWidth: strokeWidth.card,
    borderColor: colors.stroke,
    borderRadius: radius.card,
    backgroundColor: colors.bgPaper,
    ...shadows.card,
  },
  postRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  postBody: {
    flex: 1,
    minWidth: 0,
    gap: spacing.lg,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  authorText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  authorName: {
    color: colors.socialName,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: '600',
    includeFontPadding: false,
  },
  date: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    includeFontPadding: false,
  },
  mood: {
    color: colors.secondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    includeFontPadding: false,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.xs,
    rowGap: spacing.xs,
  },
  metaText: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    includeFontPadding: false,
  },
  metaDot: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    includeFontPadding: false,
  },
  privatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceMint,
    borderRadius: radius.input,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  privateText: {
    color: colors.accent,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    includeFontPadding: false,
  },
  peopleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  personChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.input,
    backgroundColor: colors.bgWash,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    paddingLeft: 4,
    paddingRight: spacing.md,
    paddingVertical: 8,
  },
  personName: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    includeFontPadding: false,
  },
  voiceList: {
    gap: spacing.sm,
  },
  voiceItem: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'stretch',
    borderRadius: radius.button,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    backgroundColor: colors.bgWash,
    paddingHorizontal: spacing.md,
  },
  voiceButton: {
    width: 36,
    height: 36,
    borderRadius: radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  voiceProgressWrap: {
    flex: 1,
    gap: 5,
  },
  voiceText: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: '600',
    includeFontPadding: false,
  },
  voiceDuration: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.micro,
    lineHeight: typography.lineHeights.micro,
    includeFontPadding: false,
  },
  voiceTrack: {
    height: 3,
    overflow: 'hidden',
    borderRadius: radius.pill,
    backgroundColor: colors.divider,
  },
  voiceProgress: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tagPill: {
    minHeight: 30,
    justifyContent: 'center',
    borderRadius: radius.input,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    backgroundColor: colors.bgWash,
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
  mediaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  mediaThumb: {
    borderRadius: radius.input,
    backgroundColor: colors.bgWash,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    overflow: 'hidden',
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
  },
  viewer: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
  viewerNavLeft: {
    position: 'absolute',
    left: spacing.md,
    top: '50%',
    marginTop: -28,
    width: 56,
    height: 56,
    borderRadius: radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha.scrim,
  },
  viewerNavRight: {
    position: 'absolute',
    right: spacing.md,
    top: '50%',
    marginTop: -28,
    width: 56,
    height: 56,
    borderRadius: radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha.scrim,
  },
  viewerClose: {
    position: 'absolute',
    top: spacing.xxxl,
    right: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha.scrim,
  },
});
