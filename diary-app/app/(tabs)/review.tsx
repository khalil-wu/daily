import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Award, CheckCircle2, Image as ImageIcon, Quote, RefreshCw, Search, Sparkles } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useStore } from '../../src/store/store';
import { Card, EmptyState, IconButton, Photo, Screen, Segmented } from '../../src/components/ui';
import { useFeedback } from '../../src/components/feedback';
import { FadeIn } from '../../src/components/motion';
import { MoodIcon } from '../../src/components/MoodIcon';
import { MonthlyBarChart } from '../../src/components/Charts';
import { computeMilestones, computeStats, findThrowbacks } from '../../src/utils/stats';
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
  const { c, t, fs } = useTheme();
  const { toast } = useFeedback();
  const entries = useStore(s => s.entries);
  const tags = useStore(s => s.tags);
  const people = useStore(s => s.people);
  const reviews = useStore(s => s.reviews);
  const aiStatus = useAIStatus();
  const [sub, setSub] = useState<ReviewTab>('period');
  const [periodSel, setPeriodSel] = useState<'week' | 'lastWeek' | 'month' | 'lastMonth'>('week');
  const [reviewBusy, setReviewBusy] = useState(false);

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
    const groups: { year: number; list: Entry[] }[] = [];
    for (const y of years) {
      const list = published.filter(e => new Date(e.createdAt).getFullYear() === y);
      if (list.length) groups.push({ year: y, list });
    }
    return groups;
  }, [published, years]);

  const yearEntries = useMemo(() => published.filter(e => new Date(e.createdAt).getFullYear() === activeYear), [published, activeYear]);
  const yearStats = useMemo(() => {
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
  }, [yearEntries, tags]);

  const statsAll = useMemo(() => computeStats(published), [published]);
  const milestones = useMemo(() => computeMilestones(published, statsAll), [published, statsAll]);
  const throwbacks = useMemo(() => findThrowbacks(published), [published]);

  return (
    <Screen edges={['top']}>
      <View style={{ height: 52, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[t.h1, { fontSize: fs(22) }]}>回顾</Text>
        <IconButton icon={Search} label="搜索" onPress={() => router.push('/search')} />
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
            image={IMAGES.emptyBook}
            imageSize={170}
            title="时光里还没有日记"
            desc="写下的每一天，都会在这里连成你的时间线。"
            action="写一篇日记"
            onAction={() => router.push('/write')}
          />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}>
          <FadeIn key={sub} dy={10} duration={300}>
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
                      style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 999, backgroundColor: on ? c.primaryFaint : c.card, borderWidth: on ? 1.2 : StyleSheet.hairlineWidth, borderColor: on ? c.primary : c.divider }}
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

          {sub === 'timeline' && (
            <View style={{ paddingTop: 4 }}>
              {byYear.map(grp => (
                <View key={grp.year} style={{ marginBottom: 22 }}>
                  <Text style={[t.h2, { fontSize: fs(19), marginBottom: 14 }]}>{grp.year}年</Text>
                  <View style={{ paddingLeft: 18, borderLeftWidth: 1.5, borderLeftColor: c.divider, marginLeft: 6, gap: 18 }}>
                    {grp.list.map(e => {
                      const d = new Date(e.createdAt);
                      return (
                        <Pressable
                          key={e.id}
                          onPress={() => router.push({ pathname: '/memory/[id]', params: { id: e.id } })}
                          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                        >
                          {/* 时间线圆点 */}
                          <View style={{ position: 'absolute', left: -24, top: 4, width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary, borderWidth: 2, borderColor: c.bg }} />

                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: fs(12.5), color: c.textSub, fontWeight: '500' }}>
                              {d.getMonth() + 1}月{d.getDate()}日
                            </Text>
                            {e.mood && <MoodIcon mood={e.mood} size={16} />}
                          </View>

                          <Card style={{ padding: 14 }}>
                            <Text style={[t.h3, { fontSize: fs(15.5) }]} numberOfLines={1}>
                              {e.title || '无题日记'}
                            </Text>
                            {!!e.body.trim() && (
                              <Text style={{ fontSize: fs(13), color: c.textSub, marginTop: 6, lineHeight: fs(13) * 1.6 }} numberOfLines={3}>
                                {excerpt(e.body, 80)}
                              </Text>
                            )}
                            {e.photos.length > 0 && (
                              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                                {e.photos.slice(0, 3).map((p, i) => (
                                  <Photo key={p + i} uri={p} style={{ flex: 1, height: 76, maxWidth: e.photos.length === 1 ? '100%' : undefined }} radius={10} />
                                ))}
                              </View>
                            )}
                          </Card>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          )}

          {sub === 'year' && (
            <View style={{ gap: 14, paddingTop: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
                <Pressable hitSlop={12} disabled={yearIdx >= years.length - 1} onPress={() => setYearIdx(i => i + 1)}>
                  <Text style={{ fontSize: 18, color: yearIdx >= years.length - 1 ? c.textMuted : c.textSub }}>‹</Text>
                </Pressable>
                <Text style={[t.h2, { fontSize: fs(18) }]}>{activeYear} 年度回顾</Text>
                <Pressable hitSlop={12} disabled={yearIdx <= 0} onPress={() => setYearIdx(i => i - 1)}>
                  <Text style={{ fontSize: 18, color: yearIdx <= 0 ? c.textMuted : c.textSub }}>›</Text>
                </Pressable>
              </View>

              <Card style={{ backgroundColor: c.primaryFaint, borderColor: c.primarySoft }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[t.h3, { color: c.primaryDark }]}>这一年的足迹</Text>
                  <Pressable onPress={() => router.push({ pathname: '/annual-report', params: { year: String(activeYear) } })}>
                    <Text style={{ fontSize: fs(12.5), color: c.primaryDark, fontWeight: '600' }}>完整年度报告 ›</Text>
                  </Pressable>
                </View>
                <View style={{ flexDirection: 'row', marginTop: 14 }}>
                  {[
                    { label: '日记篇数', val: String(yearEntries.length) },
                    { label: '写下文字', val: fmtNumber(yearStats.words) },
                    { label: '影像瞬间', val: String(yearStats.photos.length) },
                  ].map(col => (
                    <View key={col.label} style={{ flex: 1 }}>
                      <Text style={{ fontSize: fs(22), color: c.text, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{col.val}</Text>
                      <Text style={{ fontSize: fs(12), color: c.textSub, marginTop: 2 }}>{col.label}</Text>
                    </View>
                  ))}
                </View>
              </Card>

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
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: c.primaryFaint }}
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
                    <Pressable onPress={() => router.push('/photos')}>
                      <Text style={{ fontSize: fs(12.5), color: c.primaryDark }}>查看全部 ›</Text>
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {yearStats.photos.slice(0, 6).map((p, idx) => (
                      <Photo key={p + idx} uri={p} style={{ width: '31.5%', aspectRatio: 1 }} radius={10} />
                    ))}
                  </View>
                </Card>
              )}
            </View>
          )}

          {sub === 'milestone' && (
            <View style={{ gap: 16, paddingTop: 4 }}>
              {throwbacks.length > 0 && (
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Sparkles size={16} color={c.primaryDark} />
                    <Text style={[t.h3, { fontSize: fs(15) }]}>记忆胶囊</Text>
                  </View>
                  <View style={{ gap: 10 }}>
                    {throwbacks.map(tb => (
                      <Card key={tb.entry.id} onPress={() => router.push({ pathname: '/memory/[id]', params: { id: tb.entry.id } })}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={{ fontSize: fs(12), color: c.primaryDark, fontWeight: '600' }}>{tb.label}</Text>
                          <Text style={{ fontSize: fs(12), color: c.textMuted }}>{fmtFullDate(tb.entry.createdAt)}</Text>
                        </View>
                        <Text style={[t.h3, { fontSize: fs(15) }]} numberOfLines={1}>{tb.entry.title || '无题日记'}</Text>
                        <Text style={[t.sub, { marginTop: 4 }]} numberOfLines={2}>{excerpt(tb.entry.body, 70)}</Text>
                      </Card>
                    ))}
                  </View>
                </View>
              )}

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
          </FadeIn>
        </ScrollView>
      )}
    </Screen>
  );
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
  const { c, t, fs } = useTheme();
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
            { val: String(stats.count), label: '篇日记' },
            { val: String(stats.days), label: '记录天数' },
            { val: fmtNumber(stats.words), label: '写下字数' },
          ].map(col => (
            <View key={col.label} style={{ flex: 1 }}>
              <Text style={{ fontSize: fs(20), color: c.text, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{col.val}</Text>
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
        <Card style={{ padding: 16, backgroundColor: c.primaryFaint, borderColor: c.primarySoft }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Sparkles size={14} color={c.primaryDark} />
              <Text style={[t.h3, { fontSize: fs(15), color: c.primaryDark }]}>记得的回看</Text>
            </View>
            <Pressable onPress={() => void onGenerate(kind, offset)} disabled={busy || !aiReady} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: busy || !aiReady ? 0.5 : 1 }}>
              {busy ? <ActivityIndicator size={11} color={c.primaryDark} /> : <RefreshCw size={11} color={c.primaryDark} />}
              <Text style={{ fontSize: fs(11.5), color: c.primaryDark }}>{busy ? '回看ing' : '重新回看'}</Text>
            </Pressable>
          </View>
          <Text style={{ fontSize: fs(14), color: c.text, lineHeight: fs(14) * 1.7, marginTop: 10 }}>{review.summary}</Text>
          {review.themes.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {review.themes.map(theme => (
                <View key={theme} style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: c.card }}>
                  <Text style={{ fontSize: fs(11.5), color: c.primaryDark }}>{theme}</Text>
                </View>
              ))}
            </View>
          )}
          {!!review.moodLine && <Text style={{ fontSize: fs(12.5), color: c.textSub, marginTop: 10, fontStyle: 'italic' }}>{review.moodLine}</Text>}
          {review.quote && (
            <Pressable onPress={() => onOpenEntry(review.quote!.entryId)} style={{ flexDirection: 'row', gap: 6, marginTop: 12, backgroundColor: c.card, borderRadius: 12, padding: 10 }}>
              <Quote size={13} color={c.textMuted} style={{ marginTop: 2 }} />
              <Text style={{ flex: 1, fontSize: fs(12.5), color: c.textSub, lineHeight: fs(12.5) * 1.6, fontStyle: 'italic' }}>
                {review.quote.text}
                <Text style={{ color: c.primaryDark }}>{'  '}摘自那天的日记 ›</Text>
              </Text>
            </Pressable>
          )}
          {!!review.question && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.primarySoft }}>
              <Text style={{ flex: 1, fontSize: fs(12.5), color: c.text, fontWeight: '500' }}>{review.question}</Text>
              <Pressable onPress={() => router.push({ pathname: '/write', params: { prompt: 'p8' } })} hitSlop={8}>
                <Text style={{ fontSize: fs(12), color: c.primaryDark }}>去写 ›</Text>
              </Pressable>
            </View>
          )}
        </Card>
      ) : (
        <Card style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Sparkles size={14} color={c.primaryDark} />
            <Text style={[t.h3, { fontSize: fs(15) }]}>记得的回看</Text>
          </View>
          {!enough ? (
            <Text style={{ fontSize: fs(12.5), color: c.textSub, marginTop: 10, lineHeight: fs(12.5) * 1.6 }}>
              {period.label}写了 {stats.count} 篇，写到 {MIN_REVIEW_ENTRIES} 篇就能让「记得」帮你回看这段时间。
            </Text>
          ) : !aiReady ? (
            <Pressable onPress={onOpenSettings} style={{ marginTop: 10 }}>
              <Text style={{ fontSize: fs(12.5), color: c.textSub, lineHeight: fs(12.5) * 1.6 }}>
                {period.label}写了 {stats.count} 篇日记。开启「记得」后，它会读完这段时间的日记，写一份回看——这段时间在经历什么、反复出现的主题、一句摘录，和一个留给下一段的问题。<Text style={{ color: c.primaryDark }}> 去开启 ›</Text>
              </Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => void onGenerate(kind, offset)} disabled={busy} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, opacity: busy ? 0.6 : 1 }}>
              {busy ? <ActivityIndicator size={13} color={c.primaryDark} /> : <Sparkles size={13} color={c.primaryDark} />}
              <Text style={{ fontSize: fs(13), color: c.primaryDark, fontWeight: '500' }}>{busy ? '记得正在读这段时间的日记…' : `让记得回看${period.label}`}</Text>
            </Pressable>
          )}
        </Card>
      )}
    </>
  );
}
