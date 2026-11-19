import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PenLine, Search } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useStore } from '../../src/store/store';
import { Button, Divider, IconButton, Screen } from '../../src/components/ui';
import { CalendarMonth } from '../../src/components/Charts';
import { EntryListCard } from '../../src/components/EntryCard';
import { FadeIn } from '../../src/components/motion';
import { MoodIcon } from '../../src/components/MoodIcon';
import { moodMeta } from '../../src/data/constants';
import { dayKey, fmtMonthDayWeek } from '../../src/utils/date';
import { fmtNumber, wordCount } from '../../src/utils/text';
import type { MoodKey } from '../../src/store/types';

/** 12. 日历页（1:1 复刻设计稿1 #12） */
export default function CalendarScreen() {
  const { c, t, fs } = useTheme();
  const entries = useStore(s => s.entries);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(now.getDate());

  const selectedDate = useMemo(() => new Date(year, month, selectedDay, 12, 0, 0, 0).getTime(), [year, month, selectedDay]);
  const selectedKey = dayKey(selectedDate);

  const dayEntries = useMemo(
    () =>
      entries
        .filter(e => !e.deletedAt && !e.hidden && e.status === 'published' && dayKey(e.createdAt) === selectedKey)
        .sort((a, b) => b.createdAt - a.createdAt),
    [entries, selectedKey],
  );

  const changeMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelectedDay(1);
  };

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
        <Text style={[t.h1, { fontSize: fs(22) }]}>日历</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {!isViewingToday && (
            <Pressable onPress={jumpToday} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: c.primaryFaint }}>
              <Text style={{ fontSize: fs(12), color: c.primaryDark }}>今天</Text>
            </Pressable>
          )}
          <IconButton icon={Search} label="搜索" onPress={() => router.push('/search')} />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 32 }}>
        <CalendarMonth
          year={year}
          month={month}
          selectedDay={selectedDay}
          entries={entries.filter(e => !e.hidden)}
          onSelectDay={setSelectedDay}
          onChangeMonth={changeMonth}
        />

        {/* 本月小结 */}
        <View
          style={{
            marginTop: 14,
            backgroundColor: c.card,
            borderRadius: 14,
            padding: 12,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: c.divider,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: fs(12.5), color: c.textSub, fontWeight: '500' }}>
              {month + 1}月小结
            </Text>
            {monthDomMood && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: monthDomMood.soft }}>
                <MoodIcon mood={monthDomMood.key} size={13} />
                <Text style={{ fontSize: fs(11), color: '#2F2A26' }}>主导 · {monthDomMood.label}</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row' }}>
            {[
              { label: '记录篇数', val: `${monthSummary.count} 篇` },
              { label: '记录天数', val: `${monthSummary.days} 天` },
              { label: '本月字数', val: `${fmtNumber(monthSummary.words)} 字` },
            ].map((col, idx) => (
              <View key={col.label} style={{ flex: 1, alignItems: 'center', borderLeftWidth: idx ? StyleSheet.hairlineWidth : 0, borderLeftColor: c.divider }}>
                <Text numberOfLines={1} style={{ fontSize: fs(14), color: c.text, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{col.val}</Text>
                <Text numberOfLines={1} style={{ fontSize: fs(11), color: c.textMuted, marginTop: 2 }}>{col.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <Divider style={{ marginVertical: 16 }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={[t.h3, { fontSize: fs(15) }]}>{fmtMonthDayWeek(selectedDate)}</Text>
          <Pressable
            onPress={() => router.push({ pathname: '/write', params: { date: String(selectedDate) } })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <PenLine size={14} color={c.primaryDark} />
            <Text style={{ fontSize: fs(13), color: c.primaryDark }}>写这一天</Text>
          </Pressable>
        </View>

        <FadeIn key={selectedKey} dy={8} duration={260}>
        {dayEntries.length === 0 ? (
          <View style={{ backgroundColor: c.card, borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider }}>
            <Text style={[t.sub, { textAlign: 'center' }]}>这一天还没有留下记录</Text>
            <Button
              title="补记这一天"
              variant="soft"
              size="sm"
              full={false}
              onPress={() => router.push({ pathname: '/write', params: { date: String(selectedDate) } })}
              style={{ marginTop: 14 }}
            />
          </View>
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
        </FadeIn>
      </ScrollView>
    </Screen>
  );
}
