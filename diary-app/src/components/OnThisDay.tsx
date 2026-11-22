import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from './text';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, History } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useStore } from '../store/store';
import { fmtMonthDay } from '../utils/date';
import { excerpt } from '../utils/text';
import { entryCover } from '../utils/video';
import { posterUri } from '../services/videoStore';
import { Photo } from './ui';
import { MoodIcon } from './MoodIcon';
import type { Entry } from '../store/types';

/**
 * 首页「那年今日」横排回忆条 —— Day One「On This Day」式：
 * 只取往年同月同日的日记，按年份倒序；有封面用封面，没封面用纸面摘录卡。
 * 没有可回看的年份时整条不渲染，不占用首页空间。
 */
export function OnThisDay() {
  const { c, t, fs } = useTheme();
  const entries = useStore(s => s.entries);
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(
    React.useCallback(() => {
      setNow(Date.now());
    }, []),
  );

  const items = useMemo(() => {
    const d = new Date(now);
    return entries
      .filter(e => {
        if (e.deletedAt || e.hidden || e.status !== 'published') return false;
        const ed = new Date(e.createdAt);
        return ed.getFullYear() < d.getFullYear() && ed.getMonth() === d.getMonth() && ed.getDate() === d.getDate();
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8);
  }, [entries, now]);

  if (!items.length) return null;

  return (
    <View style={{ marginBottom: 16 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="那年今日，查看更多回忆"
        onPress={() => router.push('/review' as any)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, marginBottom: 2, paddingHorizontal: 2 }}
      >
        <History size={14} color={c.primaryDark} />
        <Text style={[t.h2, { fontSize: fs(15), flex: 1 }]}>那年今日</Text>
        <Text style={{ fontSize: fs(11.5), color: c.textMuted }}>更多回忆</Text>
        <ChevronRight size={14} color={c.textMuted} />
      </Pressable>
      {items.length === 1 ? (
        <OnThisDaySingleCard entry={items[0]} now={now} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0, marginHorizontal: -20 }}
          contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}
        >
          {items.map(entry => (
            <OnThisDayCard key={entry.id} entry={entry} now={now} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function OnThisDaySingleCard({ entry, now }: { entry: Entry; now: number }) {
  const { c, t, fs, frame, r } = useTheme();
  const ed = new Date(entry.createdAt);
  const yearsAgo = new Date(now).getFullYear() - ed.getFullYear();
  const yearLabel = yearsAgo === 1 ? '去年今日' : `${yearsAgo} 年前`;
  const cover = entryCover(entry);
  const mood = entry.mood;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${yearsAgo} 年前的今天，${entry.title || '无题日记'}`}
      onPress={() => router.push({ pathname: '/memory/[id]', params: { id: entry.id } })}
      style={({ pressed }) => ({
        borderRadius: r(16),
        backgroundColor: c.card,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        ...frame,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      {cover.uri ? (
        <Photo
          uri={cover.isVideo ? posterUri(cover.uri) ?? cover.uri : cover.uri}
          style={{ width: 88, height: 88, flexShrink: 0 }}
          radius={r(12)}
        />
      ) : (
        <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: c.primary }} />
      )}
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ fontSize: fs(11.5), color: c.primaryDark, fontWeight: '600' }}>
            {yearLabel} · {fmtMonthDay(entry.createdAt)}
          </Text>
          {mood && <MoodIcon mood={mood} size={14} />}
        </View>
        <Text numberOfLines={1} style={[t.readingTitle, { fontSize: fs(15), lineHeight: fs(21) }]}>
          {entry.title || '无题日记'}
        </Text>
        <Text textRole="reading" numberOfLines={2} style={{ fontSize: fs(12.5), color: c.textSub, lineHeight: fs(12.5) * 1.5 }}>
          {excerpt(entry.body, 72) || '点开重温这一天的记录'}
        </Text>
      </View>
    </Pressable>
  );
}

function OnThisDayCard({ entry, now }: { entry: Entry; now: number }) {
  const { c, t, fs, frame, r } = useTheme();
  const ed = new Date(entry.createdAt);
  const yearsAgo = new Date(now).getFullYear() - ed.getFullYear();
  const yearLabel = yearsAgo === 1 ? '去年今日' : `${yearsAgo} 年前`;
  const cover = entryCover(entry);
  const mood = entry.mood;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${yearsAgo} 年前的今天，${entry.title || '无题日记'}`}
      onPress={() => router.push({ pathname: '/memory/[id]', params: { id: entry.id } })}
      style={({ pressed }) => ({
        width: 152,
        borderRadius: r(16),
        backgroundColor: c.card,
        overflow: 'hidden',
        ...frame,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      {cover.uri ? (
        <>
          <View style={{ width: '100%', height: 94, position: 'relative' }}>
            <Photo
              uri={cover.isVideo ? posterUri(cover.uri) ?? cover.uri : cover.uri}
              style={{ width: '100%', height: '100%' }}
              radius={0}
            />
            <LinearGradient
              colors={['transparent', 'rgba(18,16,14,0.45)']}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 42 }}
            />
            <Text style={{ position: 'absolute', left: 10, bottom: 7, fontSize: fs(10.5), color: '#FFFFFF', fontWeight: '600' }}>
              {yearLabel}
            </Text>
          </View>
          <View style={{ paddingHorizontal: 11, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text numberOfLines={1} style={[t.readingTitle, { fontSize: fs(13), lineHeight: fs(19), flex: 1 }]}>
              {entry.title || fmtMonthDay(entry.createdAt)}
            </Text>
            {mood && <MoodIcon mood={mood} size={14} />}
          </View>
        </>
      ) : (
        <>
          <View style={{ height: 94, backgroundColor: c.cardAlt, borderTopWidth: 3, borderTopColor: c.primarySoft, paddingHorizontal: 11, paddingVertical: 10, justifyContent: 'center' }}>
            <Text textRole="reading" numberOfLines={3} style={{ fontSize: fs(11.5), color: c.textSub, lineHeight: fs(11.5) * 1.55 }}>
              {excerpt(entry.body, 40) || entry.title || '无题日记'}
            </Text>
          </View>
          <View style={{ paddingHorizontal: 11, paddingVertical: 9 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: fs(10.5), color: c.primaryDark, fontWeight: '600' }}>
                {yearLabel}
              </Text>
              {mood && <MoodIcon mood={mood} size={13} />}
            </View>
            <Text numberOfLines={1} style={[t.readingTitle, { fontSize: fs(13), lineHeight: fs(19), marginTop: 2 }]}>
              {entry.title || fmtMonthDay(entry.createdAt)}
            </Text>
          </View>
        </>
      )}
    </Pressable>
  );
}
