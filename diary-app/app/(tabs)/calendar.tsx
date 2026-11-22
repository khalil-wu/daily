import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../src/components/text';
import { router } from 'expo-router';
import { PenLine, Search } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useBookEntries } from '../../src/store/store';
import { ScreenTitle, useOpenSearch } from '../../src/components/BookScope';
import { Button, Card, Divider, IconButton, Screen } from '../../src/components/ui';
import { CalendarMonth } from '../../src/components/Charts';
import { EntryListCard } from '../../src/components/EntryCard';
import { useCountUp } from '../../src/components/motion';
import { MoodIcon } from '../../src/components/MoodIcon';
import { moodMeta, moodTint } from '../../src/data/constants';
import { dayKey, fmtMonthDayWeek } from '../../src/utils/date';
import { fmtNumber, wordCount } from '../../src/utils/text';
import type { MoodKey } from '../../src/store/types';
import { calendarEntryDate } from '../../src/utils/calendar';

/** 12. 日历页 */
export default function CalendarScreen() {
  const { c, t, fs, dark, r } = useTheme();
  const entries = useBookEntries();
  const openSearch = useOpenSearch();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(now.getDate());

  const selectedDate = useMemo(() => new Date(year, month, selectedDay, 12, 0, 0, 0).getTime(), [year, month, selectedDay]);
  const selectedKey = dayKey(selectedDate);
  const writeDate = calendarEntryDate(year, month, selectedDay, now.getTime());
  const visibleEntries = useMemo(() => entries.filter(e => !e.deletedAt && !e.hidden && e.status === 'published'), [entries]);

  const dayEntries = useMemo(
    () =>
      visibleEntries
        .filter(e => dayKey(e.createdAt) === selectedKey)
        .sort((a, b) => b.createdAt - a.createdAt),
    [visibleEntries, selectedKey],
  );

  const changeMonth = useCallback((delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelectedDay(1);
  }, [year, month]);

  const jumpToday = () => {
    const td = new Date();
    setYear(td.getFullYear());
    setMonth(td.getMonth());
    setSelectedDay(td.getDate());
  };

  const isViewingToday = year === now.getFullYear() && month === now.getMonth() && selectedDay === now.getDate();

  const monthSummary = useMemo(() => {
    let count = 0;
    let words = 0;
    const days = new Set<string>();
    const moodFreq = new Map<MoodKey, number>();
    for (const e of entries) {
      if (e.deletedAt || e.hidden || e.status !== 'published') continue;
      const d = new Date(e.createdAt);
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;
      count += 1;
      words += wordCount(e.title) + wordCount(e.body);
      days.add(dayKey(e.createdAt));
      if (e.mood) moodFreq.set(e.mood, (moodFreq.get(e.mood) ?? 0) + 1);
    }
    let domMood: MoodKey | undefined;
    let maxF = 0;
    moodFreq.forEach((f, mk) => {
      if (f > maxF) {
        maxF = f;
        domMood = mk;
      }
    });
    return { count, days: days.size, words, domMood };
  }, [entries, year, month]);
  const monthDomMood = moodMeta(monthSummary.domMood);

  return (
    <Screen edges={['top']}>
      <View style={{ height: 52, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <ScreenTitle title="日历" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {!isViewingToday && (
            <Pressable accessibilityRole="button" accessibilityLabel="回到今天" onPress={jumpToday} style={{ minHeight: 44, justifyContent: 'center' }}>
              <View style={{ height: 30, paddingHorizontal: 11, borderRadius: r(999), backgroundColor: c.primaryFaint, justifyContent: 'center' }}>
                <Text style={{ fontSize: fs(12), color: c.primaryDark, fontWeight: '500' }}>今天</Text>
              </View>
            </Pressable>
          )}
          <IconButton icon={Search} label="搜索" onPress={openSearch} />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 32 }}>
        <Card style={{ padding: 14 }}>
          <CalendarMonth
            year={year}
            month={month}
            selectedDay={selectedDay}
            entries={visibleEntries}
            onSelectDay={setSelectedDay}
            onChangeMonth={changeMonth}
          />
        </Card>

        {/* 本月小结 */}
        <Card style={{ marginTop: 14, padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ fontSize: fs(12.5), color: c.textSub, fontWeight: '500' }}>
              {month + 1}月小结
            </Text>
            {monthDomMood && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: r(999), backgroundColor: moodTint(monthDomMood, dark) }}>
                <MoodIcon mood={monthDomMood.key} size={13} />
                <Text style={{ fontSize: fs(11), color: c.text }}>主导 · {monthDomMood.label}</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row' }}>
            {[
              { label: '记录篇数', num: monthSummary.count, unit: '篇' },
              { label: '记录天数', num: monthSummary.days, unit: '天' },
              { label: '本月字数', num: monthSummary.words, unit: '字' },
            ].map((col, idx) => (
              <MonthStat key={col.label} label={col.label} num={col.num} unit={col.unit} divider={idx > 0} />
            ))}
          </View>
        </Card>

        <Divider style={{ marginVertical: 16 }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={[t.h3, { fontSize: fs(15) }]}>{fmtMonthDayWeek(selectedDate)}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={writeDate === null}
            onPress={() => writeDate !== null && router.push({ pathname: '/write', params: { date: String(writeDate) } })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 }}
          >
            <PenLine size={14} color={writeDate === null ? c.textMuted : c.primaryDark} />
            <Text style={{ fontSize: fs(13), color: writeDate === null ? c.textMuted : c.primaryDark }}>{writeDate === null ? '还没到这一天' : '写这一天'}</Text>
          </Pressable>
        </View>

        <View>
        {dayEntries.length === 0 ? (
          <Card style={{ padding: 24, alignItems: 'center' }}>
            <Text style={[t.sub, { textAlign: 'center' }]}>{writeDate === null ? '未来的故事，等那天再记录。' : '这一天还没有留下记录'}</Text>
            {writeDate !== null && <Button
              title="补记这一天"
              variant="soft"
              size="sm"
              full={false}
              onPress={() => router.push({ pathname: '/write', params: { date: String(writeDate) } })}
              style={{ marginTop: 14 }}
            />}
          </Card>
        ) : (
          dayEntries.map(e => (
            <EntryListCard
              key={e.id}
              entry={e}
              compactDate
              onPress={() => router.push({ pathname: '/memory/[id]', params: { id: e.id } })}
            />
          ))
        )}
        </View>
      </ScrollView>
    </Screen>
  );
}

/** 月小结数字：挂载/切换月份时滚动到位（减弱动态时直接显示） */
function MonthStat({ label, num, unit, divider }: { label: string; num: number; unit: string; divider: boolean }) {
  const { c, fs } = useTheme();
  const v = useCountUp(num, 500);
  return (
    <View style={{ flex: 1, alignItems: 'center', borderLeftWidth: divider ? StyleSheet.hairlineWidth : 0, borderLeftColor: c.divider }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
        <Text numberOfLines={1} style={{ fontSize: fs(18), color: c.text, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
          {fmtNumber(v)}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: fs(11.5), color: c.textMuted }}>{unit}</Text>
      </View>
      <Text numberOfLines={1} style={{ fontSize: fs(11), color: c.textMuted, marginTop: 3 }}>{label}</Text>
    </View>
  );
}
