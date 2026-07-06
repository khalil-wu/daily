import { router } from 'expo-router';
import { LockKeyhole } from 'lucide-react-native';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Avatar } from '@/src/components/person/Avatar';
import { MemorySummary, PersonSummary } from '@/src/data/mock';
import { resolveMood } from '@/src/i18n/copy';
import { motion, selectionFeedback, useReducedMotion } from '@/src/motion';
import { useMoodStore } from '@/src/stores/useMoodStore';
import { colors, getContentWidth, radius, shadows, spacing, strokeWidth, typography } from '@/src/theme';

type Props = {
  memory: MemorySummary;
  people?: PersonSummary[];
  entranceDelay?: number;
};

export function MemoryCard({ memory, people = [], entranceDelay }: Props) {
  const { width } = useWindowDimensions();
  const attachments = memory.attachments.slice(0, 9);
  const primaryPerson = people.find((person) => memory.personIds.includes(person.id) || person.id === memory.personId);
  const otherPeopleCount = Math.max(0, memory.personIds.length - (primaryPerson ? 1 : 0));
  const authorName = primaryPerson?.name ?? '我';
  const relationLabel = primaryPerson ? `${primaryPerson.relation} · ${memory.date}` : memory.date;
  const targetLabel = primaryPerson ? `${primaryPerson.name}的时间线` : '我的时间线';
  const reducedMotion = useReducedMotion();
  const moodRegistry = useMoodStore((state) => state.moods);
  const scale = useRef(new Animated.Value(1)).current;
  const entranceOpacity = useRef(new Animated.Value(entranceDelay === undefined ? 1 : 0)).current;
  const entranceOffset = useRef(new Animated.Value(entranceDelay === undefined ? 0 : 8)).current;
  const cardWidth = useMemo(() => getContentWidth(width, { maxWidth: 620 }), [width]);
  const bodyWidth = useMemo(() => Math.max(0, cardWidth - spacing.lg * 2 - 42 - spacing.md), [cardWidth]);
  const mediaSize = useMemo(() => {
    const available = bodyWidth - 12;
    return Math.max(72, Math.min(96, Math.floor(available / 3)));
  }, [bodyWidth]);

  const animateScale = (value: number) => {
    if (reducedMotion) return;
    Animated.spring(scale, {
      toValue: value,
      speed: motion.spring.card.speed,
      bounciness: motion.spring.card.bounciness,
      useNativeDriver: motion.useNativeDriver,
    }).start();
  };

  useEffect(() => {
    if (entranceDelay === undefined) return undefined;
    if (reducedMotion) {
      entranceOpacity.setValue(1);
      entranceOffset.setValue(0);
      return undefined;
    }

    const animation = Animated.parallel([
      Animated.timing(entranceOpacity, {
        toValue: 1,
        duration: motion.duration.base,
        delay: entranceDelay,
        useNativeDriver: motion.useNativeDriver,
      }),
      Animated.timing(entranceOffset, {
        toValue: 0,
        duration: motion.duration.base,
        delay: entranceDelay,
        useNativeDriver: motion.useNativeDriver,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [entranceDelay, entranceOffset, entranceOpacity, reducedMotion]);

  return (
    <Animated.View style={[styles.cardShell, { width: cardWidth, opacity: entranceOpacity, transform: [{ translateY: entranceOffset }, { scale }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`查看${authorName}在${memory.date}发布的动态：${memory.excerpt}`}
        onPress={() => {
          void selectionFeedback();
          router.push(`/memory/${memory.id}`);
        }}
        onPressIn={() => animateScale(motion.cardPressScale)}
        onPressOut={() => animateScale(1)}
        style={({ pressed }) => [styles.feedCell, pressed && styles.feedCellPressed]}
      >
        <View style={styles.postRow}>
          <Avatar name={authorName} size={42} highlighted={primaryPerson?.recent} avatarUri={primaryPerson?.avatarUri} />
          <View style={[styles.postBody, { width: bodyWidth }]}>
            <View style={styles.authorRow}>
              <View style={styles.authorText}>
                <View style={styles.nameRow}>
                  <Text style={styles.authorName} numberOfLines={1}>{authorName}</Text>
                  {otherPeopleCount > 0 ? <Text style={styles.withCount}>等 {otherPeopleCount + 1} 人</Text> : null}
                </View>
                <Text style={styles.meta} numberOfLines={1}>{relationLabel}</Text>
              </View>
            </View>
            <Text style={styles.excerpt}>{memory.excerpt}</Text>
            {memory.hasMedia ? (
              <View style={styles.mediaGrid}>
                {attachments.length > 0 ? (
                  <>
                    {attachments.map((attachment) => (
                      <Image
                        key={attachment.id}
                        source={{ uri: attachment.uri }}
                        style={[styles.mediaThumb, { width: mediaSize, height: mediaSize }]}
                      />
                    ))}
                    {memory.attachments.length > attachments.length ? (
                      <View style={[styles.mediaThumb, styles.moreThumb, { width: mediaSize, height: mediaSize }]}>
                        <Text style={styles.moreText}>+{memory.attachments.length - attachments.length}</Text>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <>
                    <View style={[styles.mediaThumb, { width: mediaSize, height: mediaSize }]} />
                    <View style={[styles.mediaThumb, { width: mediaSize, height: mediaSize }]} />
                  </>
                )}
              </View>
            ) : null}
            <View style={styles.metaRow}>
              <Text style={styles.targetText}>{memory.date}</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.targetText}>{targetLabel}</Text>
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
                  <Text style={styles.targetText} numberOfLines={1}>{memory.location.label}</Text>
                </>
              ) : null}
              {memory.isPrivate ? (
                <View style={styles.privatePill}>
                  <LockKeyhole size={12} color={colors.accent} />
                  <Text style={styles.privateText}>私密</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardShell: {
    alignSelf: 'stretch',
    minWidth: 0,
  },
  feedCell: {
    alignSelf: 'stretch',
    minWidth: 0,
    padding: spacing.xl,
    borderWidth: strokeWidth.card,
    borderColor: colors.stroke,
    borderRadius: radius.card,
    backgroundColor: colors.bgPaper,
    ...shadows.card,
  },
  feedCellPressed: {
    backgroundColor: colors.bgWash,
    transform: [{ scale: 0.99 }],
  },
  postRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  postBody: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  authorText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  authorName: {
    flexShrink: 1,
    color: colors.socialName,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: '600',
    includeFontPadding: false,
  },
  withCount: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.micro,
    lineHeight: typography.lineHeights.micro,
    includeFontPadding: false,
  },
  meta: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    includeFontPadding: false,
  },
  privatePill: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.bgWash,
    borderRadius: radius.input,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
  },
  privateText: {
    color: colors.accent,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.micro,
    lineHeight: typography.lineHeights.micro,
    includeFontPadding: false,
  },
  mood: {
    color: colors.secondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.micro,
    lineHeight: typography.lineHeights.micro,
    includeFontPadding: false,
  },
  excerpt: {
    width: '100%',
    flexShrink: 1,
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.reading,
    fontSize: typography.postBody,
    lineHeight: typography.lineHeights.postBody,
    fontWeight: '400',
    letterSpacing: 0,
    includeFontPadding: false,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.xs,
    rowGap: spacing.xs,
  },
  targetText: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.micro,
    lineHeight: typography.lineHeights.micro,
    includeFontPadding: false,
  },
  metaDot: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.micro,
    lineHeight: typography.lineHeights.micro,
    includeFontPadding: false,
  },
  mediaGrid: {
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
  moreThumb: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: '600',
    includeFontPadding: false,
  },
});
