import { useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { CalendarDays, X } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MemoryCard } from '@/src/components/memory/MemoryCard';
import { Screen } from '@/src/components/ui/Screen';
import { emptyStates } from '@/src/i18n/copy';
import { selectionFeedback } from '@/src/motion';
import { useVisibleDiaryData } from '@/src/privacy/useVisibleDiaryData';
import { colors, radius, shadows, spacing, strokeWidth, typography } from '@/src/theme';

type MemoryTypeFilter = 'all' | 'photos' | 'private';

export default function TimelineScreen() {
  const params = useLocalSearchParams<{ type?: string }>();
  const { canRevealPrivate, visibleMemories, visiblePeople } = useVisibleDiaryData();
  const [typeFilter, setTypeFilter] = useState<MemoryTypeFilter>(params.type === 'photos' ? 'photos' : 'all');
  const [yearFilter, setYearFilter] = useState<string | null>(null);
  const [personFilter, setPersonFilter] = useState<string | null>(null);
  const [moodFilter, setMoodFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  useEffect(() => {
    if (params.type === 'photos') {
      setTypeFilter('photos');
      router.setParams({ type: undefined });
    }
  }, [params.type]);

  const photoMemories = useMemo(
    () => visibleMemories.filter((memory) => memory.hasMedia),
    [visibleMemories],
  );
  const privateMemories = useMemo(
    () => visibleMemories.filter((memory) => memory.isPrivate),
    [visibleMemories],
  );
  const yearOptions = useMemo(
    () => Array.from(new Set(visibleMemories.map((memory) => memory.year))).sort((a, b) => Number(b) - Number(a)),
    [visibleMemories],
  );
  const personOptions = useMemo(
    () => visiblePeople.filter((person) => person.memoryCount > 0),
    [visiblePeople],
  );
  const moodOptions = useMemo(
    () => Array.from(new Set(visibleMemories.map((memory) => memory.mood))).filter(Boolean),
    [visibleMemories],
  );
  const tagOptions = useMemo(
    () => Array.from(new Set(visibleMemories.flatMap((memory) => memory.tags ?? []))).filter(Boolean),
    [visibleMemories],
  );
  const filteredMemories = useMemo(() => (
    visibleMemories.filter((memory) => {
      if (typeFilter === 'photos' && !memory.hasMedia) return false;
      if (typeFilter === 'private' && !memory.isPrivate) return false;
      if (yearFilter && memory.year !== yearFilter) return false;
      if (personFilter && !memory.personIds.includes(personFilter)) return false;
      if (moodFilter && memory.mood !== moodFilter) return false;
      if (tagFilter && !(memory.tags ?? []).includes(tagFilter)) return false;
      return true;
    })
  ), [moodFilter, personFilter, tagFilter, typeFilter, visibleMemories, yearFilter]);
  const byYear = filteredMemories.reduce<Record<string, typeof visibleMemories>>((acc, memory) => {
    (acc[memory.year] ??= []).push(memory);
    return acc;
  }, {});
  const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a));
  const hasActiveFilters = typeFilter !== 'all' || Boolean(yearFilter || personFilter || moodFilter || tagFilter);
  const emptyText = hasActiveFilters ? '没有符合这些筛选的记忆。' : emptyStates.timeline;
  let renderedCardIndex = 0;

  const resetFilters = () => {
    void selectionFeedback();
    setTypeFilter('all');
    setYearFilter(null);
    setPersonFilter(null);
    setMoodFilter(null);
    setTagFilter(null);
  };

  const selectTypeFilter = (next: MemoryTypeFilter) => {
    if (typeFilter !== next) void selectionFeedback();
    setTypeFilter(next);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>从前</Text>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="打开日历视图"
              onPress={() => {
                void selectionFeedback();
                router.push('/calendar');
              }}
              style={styles.iconButton}
            >
              <CalendarDays size={18} color={colors.textSecondary} />
            </Pressable>
            {hasActiveFilters ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="清空时间线筛选"
                onPress={resetFilters}
                style={styles.resetButton}
              >
                <X size={14} color={colors.textSecondary} />
                <Text style={styles.resetText}>清空</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.filterBlock}>
          <View style={styles.filterRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`显示全部记忆，共${visibleMemories.length}条`}
              accessibilityState={{ selected: typeFilter === 'all' }}
              onPress={() => selectTypeFilter('all')}
              style={[styles.filterChip, typeFilter === 'all' && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, typeFilter === 'all' && styles.filterTextActive]}>
                全部 {visibleMemories.length}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`只显示照片记忆，共${photoMemories.length}条`}
              accessibilityState={{ selected: typeFilter === 'photos' }}
              onPress={() => selectTypeFilter('photos')}
              style={[styles.filterChip, typeFilter === 'photos' && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, typeFilter === 'photos' && styles.filterTextActive]}>
                照片 {photoMemories.length}
              </Text>
            </Pressable>
            {canRevealPrivate && privateMemories.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`只显示私密记忆，共${privateMemories.length}条`}
                accessibilityState={{ selected: typeFilter === 'private' }}
                onPress={() => selectTypeFilter('private')}
                style={[styles.filterChip, typeFilter === 'private' && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, typeFilter === 'private' && styles.filterTextActive]}>
                  私密 {privateMemories.length}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {yearOptions.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalFilters}
              contentContainerStyle={styles.filterScroller}
            >
              {yearOptions.map((year) => {
                const selected = yearFilter === year;
                return (
                  <Pressable
                    key={year}
                    accessibilityRole="button"
                    accessibilityLabel={`${selected ? '取消' : '选择'}${year}年筛选`}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      void selectionFeedback();
                      setYearFilter((current) => (current === year ? null : year));
                    }}
                    style={[styles.filterChip, selected && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterText, selected && styles.filterTextActive]}>{year}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {personOptions.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalFilters}
              contentContainerStyle={styles.filterScroller}
            >
              {personOptions.map((person) => {
                const selected = personFilter === person.id;
                return (
                  <Pressable
                    key={person.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${selected ? '取消' : '选择'}${person.name}筛选`}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      void selectionFeedback();
                      setPersonFilter((current) => (current === person.id ? null : person.id));
                    }}
                    style={[styles.filterChip, selected && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterText, selected && styles.filterTextActive]}>{person.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {moodOptions.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalFilters}
              contentContainerStyle={styles.filterScroller}
            >
              {moodOptions.map((mood) => {
                const selected = moodFilter === mood;
                return (
                  <Pressable
                    key={mood}
                    accessibilityRole="button"
                    accessibilityLabel={`${selected ? '取消' : '选择'}${mood}心情筛选`}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      void selectionFeedback();
                      setMoodFilter((current) => (current === mood ? null : mood));
                    }}
                    style={[styles.filterChip, selected && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterText, selected && styles.filterTextActive]}>{mood}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {tagOptions.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalFilters}
              contentContainerStyle={styles.filterScroller}
            >
              {tagOptions.map((tag) => {
                const selected = tagFilter === tag;
                return (
                  <Pressable
                    key={tag}
                    accessibilityRole="button"
                    accessibilityLabel={`${selected ? '取消' : '选择'}${tag}标记筛选`}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      void selectionFeedback();
                      setTagFilter((current) => (current === tag ? null : tag));
                    }}
                    style={[styles.filterChip, selected && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterText, selected && styles.filterTextActive]}>#{tag}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </View>

        {filteredMemories.length === 0 ? (
          <Text style={styles.empty}>{emptyText}</Text>
        ) : (
          years.map((year) => (
            <View key={year} style={styles.yearBlock}>
              <Text style={styles.year}>{year}</Text>
              {byYear[year].map((memory) => {
                const entranceDelay = renderedCardIndex < 6 ? renderedCardIndex * 40 : undefined;
                renderedCardIndex += 1;
                return <MemoryCard key={memory.id} memory={memory} people={visiblePeople} entranceDelay={entranceDelay} />;
              })}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.xl,
    gap: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.display,
    lineHeight: typography.lineHeights.display,
    fontWeight: '600',
    includeFontPadding: false,
  },
  resetButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bgSecondary,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    ...shadows.card,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    backgroundColor: colors.bgSecondary,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    ...shadows.card,
  },
  resetText: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    fontWeight: '500',
    includeFontPadding: false,
  },
  filterBlock: {
    width: '100%',
    maxWidth: '100%',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  horizontalFilters: {
    width: '100%',
    maxWidth: '100%',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterScroller: {
    gap: spacing.sm,
    paddingRight: spacing.xl,
  },
  filterChip: {
    minWidth: 74,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bgSecondary,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    ...shadows.card,
  },
  filterChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.stroke,
  },
  filterText: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    fontWeight: '500',
    lineHeight: typography.lineHeights.caption,
    includeFontPadding: false,
  },
  filterTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  empty: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    textAlign: 'center',
    marginTop: spacing.giant,
  },
  yearBlock: {
    width: '100%',
    maxWidth: '100%',
    gap: spacing.md,
  },
  year: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    letterSpacing: 0,
    textTransform: 'uppercase',
    fontWeight: '600',
    includeFontPadding: false,
  },
});
