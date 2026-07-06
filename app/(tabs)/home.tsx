import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Camera, LockKeyhole, Plus, Search, UsersRound } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { PersonSheet } from '@/src/components/person/PersonSheet';
import { StarMap } from '@/src/components/stargraph/StarMap';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { Screen } from '@/src/components/ui/Screen';
import { PersonSummary } from '@/src/data/mock';
import { getHomeHeadline } from '@/src/i18n/copy';
import { useVisibleDiaryData } from '@/src/privacy/useVisibleDiaryData';
import { colors, getContentWidth, getResponsiveColumnWidth, radius, shadows, spacing, strokeWidth, typography } from '@/src/theme';

export default function HomeScreen() {
  const { people, visibleMemories, visiblePeople } = useVisibleDiaryData();
  const [selected, setSelected] = useState<PersonSummary | null>(null);
  const { width } = useWindowDimensions();
  const photoCount = visibleMemories.filter((memory) => memory.hasMedia).length;
  const privateCount = visibleMemories.filter((memory) => memory.isPrivate).length;
  const unlockedPeopleCount = people.filter((person) => !person.isPrivate).length;
  const contentWidth = useMemo(() => getContentWidth(width), [width]);
  const metricCardWidth = useMemo(
    () => getResponsiveColumnWidth(contentWidth, { gap: spacing.md, minColumnWidth: 150 }),
    [contentWidth],
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{getHomeHeadline()}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="搜索记忆"
            style={({ pressed }) => [styles.searchButton, pressed && styles.searchButtonPressed]}
            onPress={() => router.push('/search')}
          >
            <Search color={colors.textSecondary} size={18} strokeWidth={2.2} />
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Text style={styles.heroHint}>点一颗星，回到那个人身边</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="记下一条新记忆"
              onPress={() => router.push('/memory/create')}
              style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
            >
              <Plus color={colors.bgPaper} size={22} strokeWidth={2.4} />
            </Pressable>
          </View>
          <StarMap
            people={visiblePeople}
            onPressPerson={setSelected}
            onPressSelf={() => router.push('/(tabs)/timeline')}
            focusedId={selected?.id ?? null}
            entering={selected !== null}
          />
        </View>

        <View style={styles.metricRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`查看全部人物，共${unlockedPeopleCount}人`}
            onPress={() => router.push('/(tabs)/people')}
            style={({ pressed }) => [styles.metricCard, { width: metricCardWidth }, pressed && styles.metricPressed]}
          >
            <View style={styles.metricIconWrap}>
              <UsersRound color={colors.accent} size={18} strokeWidth={2.2} />
            </View>
            <View style={styles.metricCopy}>
              <Text style={styles.metricValue}>{unlockedPeopleCount}</Text>
              <Text style={styles.metricLabel}>位身边人</Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`查看全部记忆，共${visibleMemories.length}条`}
            onPress={() => router.push('/(tabs)/timeline')}
            style={({ pressed }) => [styles.metricCard, { width: metricCardWidth }, pressed && styles.metricPressed]}
          >
            <View style={styles.metricIconWrap}>
              <Text style={styles.metricIconText}>记</Text>
            </View>
            <View style={styles.metricCopy}>
              <Text style={styles.metricValue}>{visibleMemories.length}</Text>
              <Text style={styles.metricLabel}>段记忆</Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`查看照片记忆，共${photoCount}条`}
            onPress={() => router.push({ pathname: '/(tabs)/timeline', params: { type: 'photos' } })}
            style={({ pressed }) => [styles.metricCard, { width: metricCardWidth }, pressed && styles.metricPressed]}
          >
            <View style={styles.metricIconWrap}>
              <Camera color={colors.accent} size={18} strokeWidth={2.2} />
            </View>
            <View style={styles.metricCopy}>
              <Text style={styles.metricValue}>{photoCount}</Text>
              <Text style={styles.metricLabel}>张照片</Text>
            </View>
          </Pressable>
        </View>

        {privateCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`管理私密记忆，共${privateCount}条`}
            onPress={() => router.push('/settings/privacy')}
            style={({ pressed }) => [styles.privateStrip, pressed && styles.privateStripPressed]}
          >
            <LockKeyhole size={15} color={colors.textTertiary} strokeWidth={2.2} />
            <Text style={styles.privateStripText}>{privateCount} 段私密记忆，应用锁保护着</Text>
          </Pressable>
        ) : null}

        {people.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyText}>先记住一个重要的人吧。</Text>
            <PrimaryButton label="记住一个人" onPress={() => router.push('/person/create')} />
          </View>
        ) : null}

        <PrimaryButton label="记下" onPress={() => router.push('/memory/create')} style={styles.bottomCta} />
      </ScrollView>

      <PersonSheet person={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.giant,
    gap: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.lg,
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.display,
    lineHeight: typography.lineHeights.display,
    fontWeight: '600',
    letterSpacing: 0,
    includeFontPadding: false,
  },
  searchButton: {
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
  searchButtonPressed: {
    backgroundColor: colors.bgElevated,
  },
  heroCard: {
    width: '100%',
    borderRadius: radius.card,
    borderWidth: strokeWidth.card,
    borderColor: colors.stroke,
    backgroundColor: colors.surfaceMint,
    padding: spacing.lg,
    paddingTop: spacing.lg,
    ...shadows.card,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    marginBottom: spacing.xs,
  },
  heroHint: {
    flex: 1,
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: '500',
    includeFontPadding: false,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderWidth: strokeWidth.button,
    borderColor: colors.stroke,
    ...shadows.accent,
  },
  addButtonPressed: {
    backgroundColor: colors.accentDim,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metricCard: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.card,
    borderWidth: strokeWidth.card,
    borderColor: colors.stroke,
    backgroundColor: colors.bgSecondary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    ...shadows.card,
  },
  metricPressed: {
    backgroundColor: colors.bgElevated,
  },
  metricIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgWash,
  },
  metricIconText: {
    color: colors.accent,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.body,
    fontWeight: '600',
    includeFontPadding: false,
  },
  metricCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  metricValue: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.titleLg,
    lineHeight: typography.lineHeights.titleLg,
    fontWeight: '600',
    includeFontPadding: false,
  },
  metricLabel: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    includeFontPadding: false,
  },
  privateStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.bgWash,
  },
  privateStripPressed: {
    backgroundColor: colors.bgElevated,
  },
  privateStripText: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    includeFontPadding: false,
  },
  emptyBlock: {
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: -spacing.xxl,
  },
  emptyText: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    includeFontPadding: false,
  },
  bottomCta: {
    alignSelf: 'center',
  },
});
