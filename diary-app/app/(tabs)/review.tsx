import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, SectionList, StyleSheet, View } from 'react-native';
import { Text } from '../../src/components/text';
import { router } from 'expo-router';
import { Award, Bookmark, CheckCircle2, ChevronLeft, ChevronRight, Image as ImageIcon, Search } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useBookEntries, useStore } from '../../src/store/store';
import { ScreenTitle, useOpenSearch } from '../../src/components/BookScope';
import { Button, Card, EmptyState, IconButton, Photo, Screen, Segmented, webSpaceAction } from '../../src/components/ui';
import { useFeedback } from '../../src/components/feedback';
import { BottomSheet, useCountUp } from '../../src/components/motion';
import { MoodIcon } from '../../src/components/MoodIcon';
import { MonthlyBarChart } from '../../src/components/Charts';
import { fmtPostmarkRange, InkStampTag, NoteSlip, PostcardNote, QuoteSlip, YearbookFootprintPlate } from '../../src/components/stationery';
import { computeMilestones, computeStats, findThrowbacks, type ThrowbackRange } from '../../src/utils/stats';
import { excerpt, fmtNumber, wordCount } from '../../src/utils/text';
import { fmtFullDate, fmtMonthDay } from '../../src/utils/date';
import { MIN_REVIEW_ENTRIES, entriesInRange, periodRange, periodStats } from '../../src/utils/ai/review';
import { aiErrorMessage } from '../../src/utils/ai/client';
import { useAIStatus, writeReview } from '../../src/services/ai';
import { relationLabel } from '../../src/data/constants';
import { IMAGES } from '../../src/data/assets';
import type { Entry } from '../../src/store/types';

type ReviewTab = 'period' | 'timeline' | 'year' | 'milestone';

/** 13. 回顾页（时间线 / 年度 / 里程碑 - 1:1 复刻设计稿1 #13） */
export default function ReviewScreen() {
  const { c, t, fs, r, dark } = useTheme();
  const { toast } = useFeedback();
  const entries = useBookEntries();
  const openSearch = useOpenSearch();
  const tags = useStore(s => s.tags);
  const people = useStore(s => s.people);
  const reviews = useStore(s => s.reviews);
  const aiStatus = useAIStatus();
  const [sub, setSub] = useState<ReviewTab>('period');
  const [periodSel, setPeriodSel] = useState<'week' | 'lastWeek' | 'month' | 'lastMonth'>('week');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [memorySettingsOpen, setMemorySettingsOpen] = useState(false);
  const [memoryRange, setMemoryRange] = useState<ThrowbackRange>('all');
  const [excludedTags, setExcludedTags] = useState<string[]>([]);
  const memoryTags = useMemo(() => tags.filter(tag => entries.some(entry => !entry.hidden && !entry.deletedAt && entry.status === 'published' && entry.tags.includes(tag.id))), [entries, tags]);

  const published = useMemo(
    () => entries.filter(e => !e.deletedAt && !e.hidden && e.status === 'published').sort((a, b) => b.createdAt - a.createdAt),
    [entries],
  );

  const years = useMemo(() => {
    const s = new Set<number>();
    published.forEach(e => s.add(new Date(e.createdAt).getFullYear()));
    if (!s.size) s.add(new Date().getFullYear());
    return Array.from(s).sort((a, b) => b - a);
  }, [published]);

  const [yearIdx, setYearIdx] = useState(0);
  const activeYear = years[Math.min(yearIdx, years.length - 1)] ?? new Date().getFullYear();

  const byYear = useMemo(() => {
    if (sub !== 'timeline') return [];
    const groups = new Map<number, Entry[]>();
    for (const entry of published) {
      const year = new Date(entry.createdAt).getFullYear();
      const list = groups.get(year) ?? [];
      list.push(entry);
      groups.set(year, list);
    }
    return Array.from(groups, ([year, data]) => ({ year, data }));
  }, [published, sub]);

  const yearEntries = useMemo(
    () => (sub === 'year' ? published.filter(e => new Date(e.createdAt).getFullYear() === activeYear) : []),
    [published, activeYear, sub],
  );
  const yearStats = useMemo(() => {
    if (sub !== 'year') {
      return {
        words: 0,
        photos: [] as string[],
        months: [] as { label: string; count: number }[],
        topTags: [] as { id: string; name: string; cnt: number }[],
      };
    }
    const words = yearEntries.reduce((sum, e) => sum + wordCount(e.title) + wordCount(e.body), 0);
    const photos = yearEntries.flatMap(e => e.photos);
    const months = Array.from({ length: 12 }, (_, m) => ({
      label: `${m + 1}`,
      count: yearEntries.filter(e => new Date(e.createdAt).getMonth() === m).length,
    }));
    const tagMap = new Map<string, number>();
    yearEntries.forEach(e => e.tags.forEach(id => tagMap.set(id, (tagMap.get(id) ?? 0) + 1)));
    const topTags = Array.from(tagMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, cnt]) => ({ id, name: tags.find(tg => tg.id === id)?.name ?? id, cnt }));
    return { words, photos, months, topTags };
  }, [yearEntries, tags, sub]);

  const milestones = useMemo(() => sub === 'milestone' ? computeMilestones(published, computeStats(published)) : [], [published, sub]);
  const throwbacks = useMemo(() => sub === 'milestone' ? findThrowbacks(published, Date.now(), { range: memoryRange, excludedTags }) : [], [published, sub, memoryRange, excludedTags]);
  const toggleMemoryTag = (id: string) => setExcludedTags(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);

  const renderTimelineEntry = useCallback(({ item: entry }: { item: Entry }) => (
    <View style={{ marginLeft: 6, paddingLeft: 18, paddingBottom: 18, borderLeftWidth: 1.5, borderLeftColor: c.divider }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${fmtMonthDay(entry.createdAt)}，${entry.title || '无题日记'}`}
        onPress={() => router.push({ pathname: '/memory/[id]', params: { id: entry.id } })}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
        <View style={{ position: 'absolute', left: -25, top: 3, width: 12, height: 12, borderRadius: 6, backgroundColor: c.primaryFaint, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.primary }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontSize: fs(12.5), color: c.textSub, fontWeight: '500' }}>{fmtMonthDay(entry.createdAt)}</Text>
          {entry.mood && <MoodIcon mood={entry.mood} size={16} />}
        </View>
        <Card style={{ padding: 14 }}>
          <Text style={[t.readingTitle, { fontSize: fs(15.5), lineHeight: fs(24) }]} numberOfLines={1}>{entry.title || '无题日记'}</Text>
          {!!entry.body.trim() && <Text textRole="reading" style={{ fontSize: fs(13), color: c.textSub, marginTop: 6, lineHeight: fs(13) * 1.6 }} numberOfLines={3}>{excerpt(entry.body, 80)}</Text>}
          {entry.photos.length > 0 && <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            {entry.photos.slice(0, 3).map((photo, i) => <Photo key={photo + i} uri={photo} style={{ flex: 1, height: 76 }} radius={r(10)} />)}
          </View>}
        </Card>
      </Pressable>
    </View>
  ), [c, fs, r, t.readingTitle]);

  return (
    <Screen edges={['top']}>
      <View style={{ height: 52, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <ScreenTitle title="回顾" />
        <IconButton icon={Search} label="搜索" onPress={openSearch} />
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <Segmented
          value={sub}
          onChange={setSub}
          items={[
            { key: 'period', label: '周记' },
            { key: 'timeline', label: '时间线' },
            { key: 'year', label: '年度' },
            { key: 'milestone', label: '里程碑' },
          ]}
        />
      </View>

      {published.length === 0 && sub !== 'period' ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            illustration="emptyBook"
            imageSize={170}
            title="时光里还没有日记"
            desc="写下的每一天，都会在这里连成你的时间线。"
            action="写一篇日记"
            onAction={() => router.push('/write')}
          />
        </View>
      ) : sub === 'timeline' ? (
        <SectionList
          sections={byYear}
          keyExtractor={entry => entry.id}
          renderItem={renderTimelineEntry}
          renderSectionHeader={({ section }) => <Text style={[t.h2, { fontSize: fs(19), paddingTop: 8, paddingBottom: 14 }]}>{section.year}年</Text>}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== 'web'}
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}>

          <View>
          {sub === 'period' && (
            <View style={{ gap: 14, paddingTop: 4 }}>
              {/* 时段选择 */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {([
                  { key: 'week', label: '本周' },
                  { key: 'lastWeek', label: '上周' },
                  { key: 'month', label: '本月' },
                  { key: 'lastMonth', label: '上月' },
                ] as const).map(p => {
                  const on = periodSel === p.key;
                  return (
                    <Pressable
                      key={p.key}
                      onPress={() => setPeriodSel(p.key)}
                      style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: r(999), backgroundColor: on ? c.primaryFaint : c.card, borderWidth: on ? 1.2 : StyleSheet.hairlineWidth, borderColor: on ? c.primary : c.divider }}
                    >
                      <Text style={{ fontSize: fs(13), color: on ? c.primaryDark : c.textSub, fontWeight: on ? '600' : '400' }}>{p.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <PeriodCard
                key={periodSel}
                sel={periodSel}
                entries={entries}
                people={people}
                reviews={reviews}
                aiReady={aiStatus === 'ready'}
                busy={reviewBusy}
                onGenerate={async (kind, offset) => {
                  setReviewBusy(true);
                  try {
                    await writeReview(kind, offset);
                    toast('已写好这份回看');
                  } catch (e) {
                    toast(aiErrorMessage(e), { type: 'warning' });
                  } finally {
                    setReviewBusy(false);
                  }
                }}
                onOpenSettings={() => router.push('/settings/ai')}
                onOpenEntry={(id: string) => router.push({ pathname: '/memory/[id]', params: { id } })}
              />
            </View>
          )}

          {sub === 'year' && (
            <View style={{ gap: 14, paddingTop: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
                <Pressable accessibilityRole="button" accessibilityLabel="上一年" disabled={yearIdx >= years.length - 1} onPress={() => setYearIdx(i => i + 1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center', opacity: yearIdx >= years.length - 1 ? 0.35 : 1 }}>
                    <ChevronLeft size={17} color={c.textSub} />
                  </View>
                </Pressable>
                <Text style={[t.h2, { fontSize: fs(18) }]}>{activeYear} 年度回顾</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="下一年" disabled={yearIdx <= 0} onPress={() => setYearIdx(i => i - 1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center', opacity: yearIdx <= 0 ? 0.35 : 1 }}>
                    <ChevronRight size={17} color={c.textSub} />
                  </View>
                </Pressable>
              </View>

              <YearbookFootprintPlate
                stats={[
                  { label: '日记篇数', val: String(yearEntries.length) },
                  { label: '写下文字', val: fmtNumber(yearStats.words) },
                  { label: '影像瞬间', val: String(yearStats.photos.length) },
                ]}
                onOpenReport={() => router.push({ pathname: '/annual-report', params: { year: String(activeYear) } })}
              />

              <Card>
                <Text style={[t.h3, { fontSize: fs(15), marginBottom: 4 }]}>月度记录分布</Text>
                <MonthlyBarChart data={yearStats.months} />
              </Card>

              {yearStats.topTags.length > 0 && (
                <Card>
                  <Text style={[t.h3, { fontSize: fs(15), marginBottom: 12 }]}>年度关键词</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {yearStats.topTags.map(tg => (
                      <Pressable
                        key={tg.id}
                        onPress={() => router.push({ pathname: '/search', params: { q: tg.name } })}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: r(999), backgroundColor: c.primaryFaint }}
                      >
                        <Text style={{ fontSize: fs(13), color: c.primaryDark }}>#{tg.name} · {tg.cnt}</Text>
                      </Pressable>
                    ))}
                  </View>
                </Card>
              )}

              {yearStats.photos.length > 0 && (
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <ImageIcon size={16} color={c.primaryDark} />
                      <Text style={[t.h3, { fontSize: fs(15) }]}>年度影像</Text>
                    </View>
                    <Pressable onPress={() => router.push('/photos')} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <Text style={{ fontSize: fs(12.5), color: c.primaryDark }}>查看全部</Text>
                      <ChevronRight size={14} color={c.primaryDark} />
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {yearStats.photos.slice(0, 6).map((p, idx) => (
                      <Photo key={p + idx} uri={p} style={{ width: '31.5%', aspectRatio: 1 }} radius={r(10)} />
                    ))}
                  </View>
                </Card>
              )}
            </View>
          )}

          {sub === 'milestone' && (
            <View style={{ gap: 16, paddingTop: 4 }}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Bookmark size={16} color={c.primaryDark} />
                    <Text style={[t.h3, { fontSize: fs(15), flex: 1 }]}>记忆胶囊</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel="设置回忆范围" onPress={() => setMemorySettingsOpen(true)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
                      <Text style={{ fontSize: fs(13), color: c.primaryDark }}>回忆范围</Text>
                    </Pressable>
                  </View>
                  <Text style={[t.caption, { marginBottom: 10 }]}>{memoryRange === 'past-year' ? '近一年' : memoryRange === 'earlier' ? '一年以前' : '全部往事'}{excludedTags.length ? ` · 已排除 ${excludedTags.length} 个标签` : ''} · 不含隐藏、已删与草稿</Text>
                  <View style={{ gap: 10 }}>
                    {throwbacks.map(tb => (
                      <Card key={tb.entry.id} onPress={() => router.push({ pathname: '/memory/[id]', params: { id: tb.entry.id } })}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={{ fontSize: fs(12), color: c.primaryDark, fontWeight: '600' }}>{tb.label}</Text>
                          <Text style={{ fontSize: fs(12), color: c.textMuted }}>{fmtFullDate(tb.entry.createdAt)}</Text>
                        </View>
                        <Text style={[t.readingTitle, { fontSize: fs(15), lineHeight: fs(23) }]} numberOfLines={1}>{tb.entry.title || '无题日记'}</Text>
                        <Text textRole="reading" style={{ fontSize: fs(13), color: c.textSub, lineHeight: fs(21), marginTop: 4 }} numberOfLines={2}>{excerpt(tb.entry.body, 70)}</Text>
                      </Card>
                    ))}
                    {!throwbacks.length && <Card><Text style={t.sub}>当前范围还没有可回看的往事。可以调整范围，或继续记录新的生活。</Text></Card>}
                  </View>
                </View>

              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <Award size={16} color={c.primaryDark} />
                  <Text style={[t.h3, { fontSize: fs(15) }]}>成长里程碑</Text>
                </View>
                <View style={{ gap: 10 }}>
                  {milestones.map(m => (
                    <Card key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, opacity: m.achieved ? 1 : 0.78 }}>
                      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: m.achieved ? c.primaryFaint : c.bgDeep, alignItems: 'center', justifyContent: 'center' }}>
                        {m.achieved ? <CheckCircle2 size={22} color={c.primary} /> : <Award size={20} color={c.textMuted} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[t.h3, { fontSize: fs(15) }]}>{m.title}</Text>
                        <Text style={[t.sub, { marginTop: 2 }]}>{m.desc}</Text>
                      </View>
                      <Text style={{ fontSize: fs(12), color: m.achieved ? c.primaryDark : c.textMuted, fontWeight: m.achieved ? '600' : '400' }}>
                        {m.achieved && m.date ? fmtMonthDay(m.date) : m.achieved ? '已达成' : m.progress}
                      </Text>
                    </Card>
                  ))}
                </View>
              </View>
            </View>
          )}
          </View>
        </ScrollView>
      )}
      <BottomSheet visible={memorySettingsOpen} onClose={() => setMemorySettingsOpen(false)} title="回忆范围">
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16, gap: 16 }}>
          <Text style={t.sub}>只调整本次记忆胶囊，原文、统计与 AI 周记的范围不受影响。</Text>
          <View style={{ gap: 8 }}>
            {([{ key: 'all', label: '全部往事' }, { key: 'past-year', label: '近一年' }, { key: 'earlier', label: '一年以前' }] as const).map(option => <Pressable key={option.key} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: memoryRange === option.key }} aria-checked={memoryRange === option.key} {...webSpaceAction(() => setMemoryRange(option.key))} onPress={() => setMemoryRange(option.key)} style={{ minHeight: 48, padding: 12, borderRadius: r(10), backgroundColor: memoryRange === option.key ? c.primaryFaint : c.card, borderWidth: 1, borderColor: memoryRange === option.key ? c.primary : c.divider }}>
              <Text style={{ color: memoryRange === option.key ? c.primaryDark : c.text, fontSize: fs(15) }}>{memoryRange === option.key ? '✓ ' : ''}{option.label}</Text>
            </Pressable>)}
          </View>
          {!!memoryTags.length && <>
            <Text style={t.h3}>不回顾这些标签</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {memoryTags.map(tag => <Pressable key={tag.id} accessibilityRole="checkbox" accessibilityLabel={`排除标签：${tag.name}`} accessibilityState={{ checked: excludedTags.includes(tag.id) }} aria-checked={excludedTags.includes(tag.id)} {...webSpaceAction(() => toggleMemoryTag(tag.id))} onPress={() => toggleMemoryTag(tag.id)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: r(10), backgroundColor: excludedTags.includes(tag.id) ? c.primaryFaint : c.card, borderWidth: 1, borderColor: excludedTags.includes(tag.id) ? c.primary : c.divider }}>
                <Text style={{ color: c.text, fontSize: fs(14) }}>{excludedTags.includes(tag.id) ? '✓ ' : ''}#{tag.name}</Text>
              </Pressable>)}
            </View>
          </>}
        </ScrollView>
        <Button title="完成" onPress={() => setMemorySettingsOpen(false)} />
      </BottomSheet>
    </Screen>
  );
}

function PeriodStatNum({ value }: { value: number }) {
  const v = useCountUp(value, 500);
  return <>{fmtNumber(v)}</>;
}

interface PeriodCardProps {
  sel: 'week' | 'lastWeek' | 'month' | 'lastMonth';
  entries: Entry[];
  people: { id: string; name: string }[];
  reviews: import('../../src/store/types').PeriodReview[];
  aiReady: boolean;
  busy: boolean;
  onGenerate: (kind: 'week' | 'month', offset: number) => Promise<void>;
  onOpenSettings: () => void;
  onOpenEntry: (id: string) => void;
}

/** 「周记」页：这段时间的本机统计 + 「记得」写的回看 */
function PeriodCard({ sel, entries, people, reviews, aiReady, busy, onGenerate, onOpenSettings, onOpenEntry }: PeriodCardProps) {
  const { c, t, fs, r, dark } = useTheme();
  const kind = sel === 'month' || sel === 'lastMonth' ? 'month' : 'week';
  const offset = sel === 'lastWeek' || sel === 'lastMonth' ? -1 : 0;
  const period = useMemo(() => periodRange(kind, offset), [kind, offset]);
  const stats = useMemo(() => periodStats(entries, period.from, period.to), [entries, period]);
  const review = useMemo(() => reviews.find(r => r.kind === kind && r.from === period.from), [reviews, kind, period]);
  const enough = stats.count >= MIN_REVIEW_ENTRIES;

  return (
    <>
      {/* 本机统计：不用 AI 也看得到 */}
      <Card style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[t.h3, { fontSize: fs(15) }]}>{period.label}</Text>
          <Text style={{ fontSize: fs(11.5), color: c.textMuted }}>
            {new Date(period.from).getMonth() + 1}月{new Date(period.from).getDate()}日 – {new Date(period.to - 1).getMonth() + 1}月{new Date(period.to - 1).getDate()}日
          </Text>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          {[
            { val: stats.count, label: '篇日记' },
            { val: stats.days, label: '记录天数' },
            { val: stats.words, label: '写下字数' },
          ].map(col => (
            <View key={col.label} style={{ flex: 1 }}>
              <Text style={{ fontSize: fs(20), color: c.text, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                <PeriodStatNum value={col.val} />
              </Text>
              <Text style={{ fontSize: fs(11.5), color: c.textSub, marginTop: 2 }}>{col.label}</Text>
            </View>
          ))}
        </View>
        {stats.moods.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <Text style={{ fontSize: fs(11.5), color: c.textMuted }}>心情</Text>
            {stats.moods.slice(0, 4).map(m => (
              <View key={m.mood} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <MoodIcon mood={m.mood} size={14} />
                <Text style={{ fontSize: fs(11.5), color: c.textSub }}>×{m.count}</Text>
              </View>
            ))}
          </View>
        )}
        {stats.people.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: fs(11.5), color: c.textMuted }}>写到</Text>
            {stats.people.slice(0, 4).map(p => {
              const person = people.find(x => x.id === p.id);
              return person ? (
                <Pressable key={p.id} onPress={() => router.push({ pathname: '/people/[id]', params: { id: p.id } })}>
                  <Text style={{ fontSize: fs(12), color: c.primaryDark }}>{person.name} ×{p.count}</Text>
                </Pressable>
              ) : null;
            })}
          </View>
        )}
      </Card>

      {/* 「记得」写的回看 */}
      {review ? (
        <PostcardNote
          salutation="这一程的回看"
          meta={`${period.label} · ${new Date(period.from).getMonth() + 1}月${new Date(period.from).getDate()}日 – ${new Date(period.to - 1).getMonth() + 1}月${new Date(period.to - 1).getDate()}日`}
          postmark={fmtPostmarkRange(period.from, period.to - 1)}
          body={review.summary}
          actionLabel="重新回看"
          actionBusy={busy}
          actionDisabled={!aiReady}
          onAction={aiReady ? () => void onGenerate(kind, offset) : undefined}
        >
          {review.themes.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {review.themes.map(theme => (
                <InkStampTag key={theme} label={theme} />
              ))}
            </View>
          )}
          {!!review.moodLine && (
            <Text
              textRole="reading"
              style={{
                fontFamily: t.bodySerif.fontFamily,
                fontSize: fs(13),
                lineHeight: Math.round(fs(13) * 1.65),
                color: '#655B50',
                marginTop: 10,
                fontStyle: 'italic',
              }}
            >
              {review.moodLine}
            </Text>
          )}
          {review.quote && (
            <View style={{ marginTop: 12 }}>
              <QuoteSlip
                text={review.quote.text}
                onPress={() => onOpenEntry(review.quote!.entryId)}
              />
            </View>
          )}
        </PostcardNote>
      ) : (
        <NoteSlip
          title="这一程的回看"
          body={
            !enough
              ? `${period.label}写了 ${stats.count} 篇，写到 ${MIN_REVIEW_ENTRIES} 篇就能让「记得」帮你回看这段时间。`
              : !aiReady
                ? `${period.label}写了 ${stats.count} 篇日记。开启「记得」后，它会读完这段时间的日记，写一份回看——这段时间在经历什么、反复出现的主题、一句摘录，和一个留给下一段的问题。`
                : `${period.label}已写下 ${stats.count} 篇日记，可以把这一程寄给「记得」，留一份安静的回看。`
          }
          actionLabel={
            !enough
              ? undefined
              : !aiReady
                ? '去开启 ›'
                : busy
                  ? '记得正在读这段时间的日记…'
                  : `让记得回看${period.label} ›`
          }
          busy={busy}
          onAction={!enough ? undefined : !aiReady ? onOpenSettings : () => void onGenerate(kind, offset)}
        />
      )}
    </>
  );
}
