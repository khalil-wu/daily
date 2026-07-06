import { useRef } from 'react';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/src/components/person/Avatar';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { Screen } from '@/src/components/ui/Screen';
import { SectionCard } from '@/src/components/ui/SectionCard';
import { PersonSummary } from '@/src/data/mock';
import { motion, selectionFeedback, useReducedMotion } from '@/src/motion';
import { useVisibleDiaryData } from '@/src/privacy/useVisibleDiaryData';
import { colors, radius, shadows, spacing, strokeWidth, typography } from '@/src/theme';

type PersonListItemProps = {
  person: PersonSummary;
};

function PersonListItem({ person }: PersonListItemProps) {
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const animateScale = (value: number) => {
    if (reducedMotion) return;
    Animated.spring(scale, {
      toValue: value,
      speed: 30,
      bounciness: 2,
      useNativeDriver: motion.useNativeDriver,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`查看${person.name}的时间线`}
        onPress={() => {
          void selectionFeedback();
          router.push(`/person/${person.id}`);
        }}
        onPressIn={() => animateScale(motion.cardPressScale)}
        onPressOut={() => animateScale(1)}
        style={({ pressed }) => pressed && styles.personPressed}
      >
        <SectionCard>
          <View style={styles.personRow}>
            <Avatar name={person.name} size={52} highlighted={person.recent} masked={person.isMasked} avatarUri={person.avatarUri} />
            <View style={styles.personInfo}>
              <Text style={styles.personName}>{person.name}</Text>
              <Text style={styles.personMeta}>
                {person.relation} · {person.memoryCount} 条记忆
              </Text>
              <Text style={styles.personNote}>{person.note}</Text>
            </View>
          </View>
        </SectionCard>
      </Pressable>
    </Animated.View>
  );
}

export default function PeopleScreen() {
  const { visiblePeople } = useVisibleDiaryData();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>身边人</Text>
            <Text style={styles.subtitle}>先记住人，再回头看时间。</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="新增身边人"
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
            onPress={() => {
              void selectionFeedback();
              router.push('/person/create');
            }}
          >
            <Plus color={colors.bgPaper} size={18} strokeWidth={2.4} />
          </Pressable>
        </View>

        {visiblePeople.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyTitle}>还没有记住的人</Text>
            <Text style={styles.emptyText}>从最重要的那个人开始，把名字留在这里。</Text>
            <PrimaryButton label="记住一个人" onPress={() => router.push('/person/create')} />
          </View>
        ) : (
          visiblePeople.map((person) => (
            <PersonListItem key={person.id} person={person} />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.titleLg,
    fontWeight: '500',
    lineHeight: typography.lineHeights.titleLg,
    includeFontPadding: false,
  },
  subtitle: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontSize: typography.caption,
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
  personPressed: {
    opacity: 0.82,
  },
  personRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'center',
  },
  personInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  personName: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '500',
    lineHeight: typography.lineHeights.title,
    includeFontPadding: false,
  },
  personMeta: {
    color: colors.textSecondary,
    fontSize: typography.caption,
  },
  personNote: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
  },
  emptyBlock: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.giant,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.titleLg,
    fontWeight: '600',
    lineHeight: typography.lineHeights.titleLg,
    includeFontPadding: false,
  },
  emptyText: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
