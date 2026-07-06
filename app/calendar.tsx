import { useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MemoryCard } from '@/src/components/memory/MemoryCard';
import { Screen } from '@/src/components/ui/Screen';
import { parseMemoryDate } from '@/src/date/parseMemoryDate';
import { emptyStates } from '@/src/i18n/copy';
import { selectionFeedback } from '@/src/motion';
import { useVisibleDiaryData } from '@/src/privacy/useVisibleDiaryData';
import { colors, radius, shadows, spacing, strokeWidth, typography } from '@/src/theme';

const weekLabels = ['一', '二', '三', '四', '五', '六', '日'];
const ITEM_HEIGHT = 44;

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function mondayOffset(year: number, month: number): number {
  const day = new Date(year, month - 1, 1).getDay();
  return (day + 6) % 7;
}

// 近 10 年年份列表
function buildYearOptions(today: Date, span = 10): number[] {
  const years: number[] = [];
  for (let i = span; i >= 0; i -= 1) years.push(today.getFullYear() - i);
  return years;
}

export default function CalendarScreen() {
  const { visibleMemories, visiblePeople } = useVisibleDiaryData();
  const today = useMemo(() => new Date(), []);
  const yearOptions = useMemo(() => buildYearOptions(today), [today]);
  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 });
  const [selectedKey, setSelectedKey] = useState(dateKey(today.getFullYear(), today.getMonth() + 1, today.getDate()));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftYear, setDraftYear] = useState(cursor.year);
  const [draftMonth, setDraftMonth] = useState(cursor.month);
  const yearScrollRef = useRef<ScrollView>(null);
  const monthScrollRef = useRef<ScrollView>(null);
  const memoriesByDate = useMemo(() => {
    const map = new Map<string, typeof visibleMemories>();
    for (const memory of visibleMemories) {
      const parsed = parseMemoryDate(memory);
      if (!parsed) continue;
      const key = dateKey(parsed.year, parsed.month, parsed.day);
      map.set(key, [...(map.get(key) ?? []), memory]);
    }
    return map;
  }, [visibleMemories]);
  const cells = useMemo(() => {
    const blanks = Array.from({ length: mondayOffset(cursor.year, cursor.month) }, () => null);
    const days = Array.from({ length: daysInMonth(cursor.year, cursor.month) }, (_, index) => index + 1);
    return [...blanks, ...days];
  }, [cursor]);
  const monthKeys = useMemo(
    () => Array.from({ length: daysInMonth(cursor.year, cursor.month) }, (_, index) => dateKey(cursor.year, cursor.month, index + 1)),
    [cursor],
  );
  const monthHasMemories = monthKeys.some((key) => memoriesByDate.has(key));
  const selectedMemories = memoriesByDate.get(selectedKey) ?? [];

  const shiftMonth = (delta: number) => {
    void selectionFeedback();
    const next = new Date(cursor.year, cursor.month - 1 + delta, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() + 1 });
    setSelectedKey(dateKey(next.getFullYear(), next.getMonth() + 1, 1));
  };

  const openPicker = () => {
    void selectionFeedback();
    setDraftYear(cursor.year);
    setDraftMonth(cursor.month);
    setPickerOpen(true);
    // 等待 Modal 渲染后滚到当前年月
    setTimeout(() => {
      const yearIndex = yearOptions.indexOf(cursor.year);
      const monthIndex = cursor.month - 1;
      yearScrollRef.current?.scrollTo({ y: Math.max(0, yearIndex) * ITEM_HEIGHT, animated: false });
      monthScrollRef.current?.scrollTo({ y: monthIndex * ITEM_HEIGHT, animated: false });
    }, 50);
  };

  const confirmPicker = () => {
    void selectionFeedback();
    setCursor({ year: draftYear, month: draftMonth });
    setSelectedKey(dateKey(draftYear, draftMonth, 1));
    setPickerOpen(false);
  };

  const onYearScroll = (event: { nativeEvent: { contentOffset: { y: number } } }) => {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(yearOptions.length - 1, index));
    if (yearOptions[clamped] !== draftYear) setDraftYear(yearOptions[clamped]);
  };

  const onMonthScroll = (event: { nativeEvent: { contentOffset: { y: number } } }) => {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(11, index));
    if (clamped + 1 !== draftMonth) setDraftMonth(clamped + 1);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="返回" onPress={() => router.back()} style={styles.iconButton}>
            <ChevronLeft size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.title}>日历</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.monthCard}>
          <View style={styles.monthHeader}>
            <Pressable accessibilityRole="button" accessibilityLabel="上个月" onPress={() => shiftMonth(-1)} style={styles.monthButton}>
              <ChevronLeft size={18} color={colors.textSecondary} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`选择月份，当前${cursor.year}年${cursor.month}月`}
              onPress={openPicker}
              style={({ pressed }) => [styles.monthTitleButton, pressed && styles.monthTitleButtonPressed]}
            >
              <Text style={styles.monthTitle}>{cursor.year}年{cursor.month}月</Text>
              <ChevronDown size={16} color={colors.accent} strokeWidth={2.2} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="下个月" onPress={() => shiftMonth(1)} style={styles.monthButton}>
              <ChevronRight size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {weekLabels.map((label) => (
              <Text key={label} style={styles.weekLabel}>{label}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((day, index) => {
              if (day === null) return <View key={`blank-${index}`} style={styles.dayCell} />;
              const key = dateKey(cursor.year, cursor.month, day);
              const selected = selectedKey === key;
              const isToday = key === dateKey(today.getFullYear(), today.getMonth() + 1, today.getDate());
              const hasMemory = memoriesByDate.has(key);
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={`${cursor.month}月${day}日${hasMemory ? '有记忆' : '没有记忆'}`}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    void selectionFeedback();
                    setSelectedKey(key);
                  }}
                  style={[styles.dayCell, selected && styles.dayCellSelected, isToday && styles.dayCellToday]}
                >
                  <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{day}</Text>
                  {hasMemory && !selected ? <View style={styles.memoryDot} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {!monthHasMemories ? (
          <Text style={styles.empty}>{emptyStates.calendarMonth}</Text>
        ) : selectedMemories.length > 0 ? (
          <View style={styles.memoryList}>
            {selectedMemories.map((memory) => (
              <MemoryCard key={memory.id} memory={memory} people={visiblePeople} />
            ))}
          </View>
        ) : (
          <Text style={styles.empty}>这一天还很安静。</Text>
        )}
      </ScrollView>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.pickerSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>选择年月</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="关闭" onPress={() => setPickerOpen(false)} style={styles.pickerClose}>
                <ChevronDown size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.pickerWheels}>
              <View style={styles.pickerWheelWrap}>
                <View style={styles.pickerHighlight} pointerEvents="none" />
                <ScrollView
                  ref={yearScrollRef}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  decelerationRate="fast"
                  onScroll={onYearScroll}
                  scrollEventThrottle={16}
                  contentContainerStyle={styles.pickerList}
                >
                  <View style={{ height: ITEM_HEIGHT }} />
                  {yearOptions.map((year) => {
                    const active = year === draftYear;
                    return (
                      <View key={year} style={styles.pickerItem}>
                        <Text style={[styles.pickerItemText, active && styles.pickerItemTextActive]}>{year}年</Text>
                      </View>
                    );
                  })}
                  <View style={{ height: ITEM_HEIGHT }} />
                </ScrollView>
              </View>

              <View style={styles.pickerWheelWrap}>
                <View style={styles.pickerHighlight} pointerEvents="none" />
                <ScrollView
                  ref={monthScrollRef}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  decelerationRate="fast"
                  onScroll={onMonthScroll}
                  scrollEventThrottle={16}
                  contentContainerStyle={styles.pickerList}
                >
                  <View style={{ height: ITEM_HEIGHT }} />
                  {monthOptions.map((month) => {
                    const active = month === draftMonth;
                    return (
                      <View key={month} style={styles.pickerItem}>
                        <Text style={[styles.pickerItemText, active && styles.pickerItemTextActive]}>{month}月</Text>
                      </View>
                    );
                  })}
                  <View style={{ height: ITEM_HEIGHT }} />
                </ScrollView>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`确认选择${draftYear}年${draftMonth}月`}
              onPress={confirmPicker}
              style={({ pressed }) => [styles.pickerConfirm, pressed && styles.pickerConfirmPressed]}
            >
              <Check size={18} color={colors.bgPaper} strokeWidth={2.4} />
              <Text style={styles.pickerConfirmText}>就这个月</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: spacing.xl,
    gap: spacing.xl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  placeholder: {
    width: 44,
    height: 44,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.titleLg,
    lineHeight: typography.lineHeights.titleLg,
    fontWeight: '600',
    includeFontPadding: false,
  },
  monthTitleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.button,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    backgroundColor: colors.bgWash,
  },
  monthTitleButtonPressed: {
    backgroundColor: colors.surfaceMint,
  },
  monthCard: {
    borderRadius: radius.card,
    borderWidth: strokeWidth.card,
    borderColor: colors.stroke,
    backgroundColor: colors.bgPaper,
    padding: spacing.lg,
    gap: spacing.lg,
    ...shadows.card,
  },
  monthHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthButton: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgWash,
    borderWidth: strokeWidth.button,
    borderColor: colors.stroke,
  },
  monthTitle: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: '600',
    includeFontPadding: false,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekLabel: {
    flex: 1,
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: '600',
    textAlign: 'center',
    includeFontPadding: false,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.xs,
  },
  dayCell: {
    width: `${100 / 7}%`,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radius.button,
  },
  dayCellSelected: {
    backgroundColor: colors.accent,
    borderWidth: strokeWidth.button,
    borderColor: colors.stroke,
  },
  dayCellToday: {
    borderWidth: strokeWidth.button,
    borderColor: colors.accent,
    backgroundColor: colors.surfaceMint,
  },
  dayText: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: '600',
    includeFontPadding: false,
  },
  dayTextSelected: {
    color: colors.bgPaper,
    fontWeight: '700',
  },
  memoryDot: {
    width: 6,
    height: 6,
    borderRadius: radius.circle,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  memoryList: {
    gap: spacing.md,
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
  pickerBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: colors.scrim,
    padding: spacing.lg,
  },
  pickerSheet: {
    width: '100%',
    maxWidth: 480,
    borderRadius: radius.card,
    borderWidth: strokeWidth.card,
    borderColor: colors.stroke,
    backgroundColor: colors.bgPaper,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.sheet,
  },
  pickerHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerTitle: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: '700',
    includeFontPadding: false,
  },
  pickerClose: {
    width: 44,
    height: 44,
    borderRadius: radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgWash,
  },
  pickerWheels: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  pickerWheelWrap: {
    flex: 1,
    height: ITEM_HEIGHT * 5,
    borderRadius: radius.button,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    backgroundColor: colors.bgWash,
    overflow: 'hidden',
  },
  pickerHighlight: {
    position: 'absolute',
    top: ITEM_HEIGHT * 2,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: colors.surfaceMint,
    borderTopWidth: strokeWidth.input,
    borderTopColor: colors.stroke,
    borderBottomWidth: strokeWidth.input,
    borderBottomColor: colors.stroke,
  },
  pickerList: {
    paddingVertical: 0,
  },
  pickerItem: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerItemText: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: '500',
    includeFontPadding: false,
  },
  pickerItemTextActive: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: typography.title,
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
});
