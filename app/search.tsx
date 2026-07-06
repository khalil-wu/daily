import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Search, X } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { MemoryCard } from '@/src/components/memory/MemoryCard';
import { Avatar } from '@/src/components/person/Avatar';
import { Screen } from '@/src/components/ui/Screen';
import { SectionCard } from '@/src/components/ui/SectionCard';
import { selectionFeedback } from '@/src/motion';
import { useVisibleDiaryData } from '@/src/privacy/useVisibleDiaryData';
import { colors, radius, shadows, spacing, strokeWidth, typography } from '@/src/theme';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const { visiblePeople, visibleMemories } = useVisibleDiaryData();
  const keyword = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!keyword) return { people: [], memories: [] };

    return {
      people: visiblePeople.filter((person) => (
        `${person.name} ${person.relation} ${person.note}`.toLowerCase().includes(keyword)
      )),
      memories: visibleMemories.filter((memory) => (
        `${memory.title} ${memory.content} ${memory.mood} ${memory.date} ${(memory.tags ?? []).join(' ')}`.toLowerCase().includes(keyword)
      )),
    };
  }, [keyword, visibleMemories, visiblePeople]);

  const hasQuery = keyword.length > 0;
  const isEmpty = hasQuery && results.people.length === 0 && results.memories.length === 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.searchRow}>
          <View style={styles.inputWrap}>
            <Search size={18} color={colors.textTertiary} strokeWidth={2.2} />
            <TextInput
              accessibilityLabel="搜索记忆和身边人"
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="找一个人，或一段从前"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
            />
            {query ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="清空搜索内容"
                onPress={() => {
                  void selectionFeedback();
                  setQuery('');
                }}
                hitSlop={10}
              >
                <X size={16} color={colors.textTertiary} strokeWidth={2.2} />
              </Pressable>
            ) : null}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="取消搜索" onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.cancel}>取消</Text>
          </Pressable>
        </View>

        {!hasQuery ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.empty}>那些名字和小事，都可以慢慢找回来。</Text>
          </View>
        ) : null}

        {results.people.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>身边人</Text>
            {results.people.map((person) => (
              <Pressable
                key={person.id}
                accessibilityRole="button"
                accessibilityLabel={`查看${person.name}的时间线`}
                onPress={() => {
                  void selectionFeedback();
                  router.push(`/person/${person.id}`);
                }}
              >
                <SectionCard>
                  <View style={styles.personRow}>
                    <Avatar name={person.name} size={44} highlighted={person.recent} avatarUri={person.avatarUri} />
                    <View style={styles.personText}>
                      <Text style={styles.personName}>{person.name}</Text>
                      <Text style={styles.personMeta}>
                        {person.relation} · {person.memoryCount} 条记忆
                      </Text>
                    </View>
                  </View>
                </SectionCard>
              </Pressable>
            ))}
          </View>
        ) : null}

        {results.memories.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>记忆</Text>
            {results.memories.map((memory) => (
              <MemoryCard key={memory.id} memory={memory} people={visiblePeople} />
            ))}
          </View>
        ) : null}

        {isEmpty ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.empty}>没有找到，换个词试试。</Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.xl,
    gap: spacing.xl,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  inputWrap: {
    flex: 1,
    height: 48,
    borderRadius: radius.button,
    backgroundColor: colors.bgSecondary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    ...shadows.card,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.body,
    paddingVertical: 0,
    includeFontPadding: false,
  },
  cancel: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.body,
    fontWeight: '600',
    includeFontPadding: false,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.accent,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: '700',
    includeFontPadding: false,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  personText: {
    flex: 1,
    gap: spacing.xs,
  },
  personName: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '700',
    lineHeight: typography.lineHeights.title,
    includeFontPadding: false,
  },
  personMeta: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    includeFontPadding: false,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: spacing.giant,
    gap: spacing.sm,
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
