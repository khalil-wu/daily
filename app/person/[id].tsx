import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Edit3, Trash2 } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MemoryCard } from '@/src/components/memory/MemoryCard';
import { Avatar } from '@/src/components/person/Avatar';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { Screen } from '@/src/components/ui/Screen';
import { emptyStates } from '@/src/i18n/copy';
import { selectionFeedback } from '@/src/motion';
import { useVisibleDiaryData } from '@/src/privacy/useVisibleDiaryData';
import { useDiaryStore } from '@/src/stores/useDiaryStore';
import { alpha, colors, radius, shadows, spacing, strokeWidth, typography } from '@/src/theme';

function pronounFor(relation: string, name: string): string {
  if (relation === '自己') return '自己';
  if (['母亲', '外婆', '恋人'].includes(relation) || ['妈妈', '外婆'].includes(name)) return '她';
  return '他';
}

export default function PersonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { visiblePeople, visibleMemories } = useVisibleDiaryData();
  const deletePerson = useDiaryStore((state) => state.deletePerson);
  const [filter, setFilter] = useState<'all' | 'photos'>('all');
  const person = visiblePeople.find((item) => item.id === id);

  if (!person) {
    return (
      <Screen>
        <View style={styles.notFound}>
          <Text style={styles.empty}>没找到这个人。</Text>
          <PrimaryButton label="回去看看" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const relatedMemories = visibleMemories.filter((item) => item.personIds.includes(person.id));
  const photoMemories = relatedMemories.filter((memory) => memory.hasMedia);
  const filteredMemories = filter === 'photos' ? photoMemories : relatedMemories;
  const pronoun = pronounFor(person.relation, person.name);

  const byYear = filteredMemories.reduce<Record<string, typeof relatedMemories>>((acc, memory) => {
    (acc[memory.year] ??= []).push(memory);
    return acc;
  }, {});
  const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a));

  const remove = () => {
    Alert.alert('不再记住这个人了吗？', '人物会从星图和列表里移开，已经写下的记忆还会留在总时间线里。', [
      { text: '再想想', style: 'cancel' },
      {
        text: '不留了',
        style: 'destructive',
        onPress: () => {
          deletePerson(person.id);
          router.replace('/(tabs)/people');
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="返回" onPress={() => router.back()} style={styles.iconButton}>
            <ChevronLeft size={22} color={colors.textSecondary} />
          </Pressable>
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="编辑人物"
              onPress={() => {
                void selectionFeedback();
                router.push(`/person/${person.id}/edit`);
              }}
              style={styles.iconButton}
            >
              <Edit3 size={17} color={colors.textSecondary} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="删除人物" onPress={remove} style={[styles.iconButton, styles.dangerButton]}>
              <Trash2 size={17} color={colors.danger} />
            </Pressable>
          </View>
        </View>

        <View style={styles.header}>
          <Avatar name={person.name} size={64} highlighted={person.recent} masked={person.isMasked} avatarUri={person.avatarUri} />
          <Text style={styles.name}>
            {person.name} · {person.relation}
          </Text>
          <Text style={styles.note}>{person.note}</Text>
          <Text style={styles.meta}>
            {person.memoryCount} 条记忆 · 最近记录 {person.lastDate}
          </Text>
        </View>

        {person.isMasked ? (
          <Text style={styles.empty}>解锁后查看关于这位人物的记忆。</Text>
        ) : (
          <>
            <PrimaryButton
              label={`写下关于${pronoun}`}
              onPress={() => router.push({ pathname: '/memory/create', params: { personId: person.id, personName: person.name } })}
            />

            {relatedMemories.length === 0 ? (
              <Text style={styles.empty}>{emptyStates.person(pronoun)}</Text>
            ) : (
              <>
                  <View style={styles.tabRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`显示全部相关记忆，共${relatedMemories.length}条`}
                      accessibilityState={{ selected: filter === 'all' }}
                      onPress={() => {
                        if (filter !== 'all') void selectionFeedback();
                        setFilter('all');
                      }}
                      style={[styles.tabChip, filter === 'all' && styles.tabChipActive]}
                    >
                      <Text style={[styles.tabText, filter === 'all' && styles.tabTextActive]}>全部 {relatedMemories.length}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`只显示照片记忆，共${photoMemories.length}条`}
                      accessibilityState={{ selected: filter === 'photos' }}
                      onPress={() => {
                        if (filter !== 'photos') void selectionFeedback();
                        setFilter('photos');
                      }}
                      style={[styles.tabChip, filter === 'photos' && styles.tabChipActive]}
                    >
                      <Text style={[styles.tabText, filter === 'photos' && styles.tabTextActive]}>照片 {photoMemories.length}</Text>
                    </Pressable>
                  </View>

                  {filteredMemories.length === 0 ? (
                    <Text style={styles.empty}>还没有和{person.name}有关的照片记忆。</Text>
                  ) : (
                    years.map((year) => (
                      <View key={year} style={styles.timelineBlock}>
                        <Text style={styles.year}>{year}</Text>
                        {byYear[year].map((memory) => (
                          <MemoryCard key={memory.id} memory={memory} people={visiblePeople} />
                        ))}
                      </View>
                    ))
                  )}
                </>
              )}
          </>
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
    borderRadius: radius.circle,
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
  header: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  name: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.titleLg,
    fontWeight: '500',
    lineHeight: typography.lineHeights.titleLg,
    includeFontPadding: false,
  },
  note: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    includeFontPadding: false,
  },
  meta: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
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
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  tabChip: {
    minWidth: 74,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bgSecondary,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
  },
  tabChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.stroke,
  },
  tabText: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    fontWeight: '500',
    lineHeight: typography.lineHeights.caption,
    includeFontPadding: false,
  },
  tabTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  timelineBlock: {
    gap: spacing.md,
  },
  year: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    letterSpacing: 0,
    textTransform: 'uppercase',
    lineHeight: typography.lineHeights.caption,
    includeFontPadding: false,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
});
