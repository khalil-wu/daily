import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../src/components/text';
import { router, useLocalSearchParams } from 'expo-router';
import { Award, CheckCircle2, ChevronLeft, ChevronRight, FileText, Flame, MapPin, Search } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useBookEntries, useStore } from '../../src/store/store';
import { ScreenTitle, useOpenSearch } from '../../src/components/BookScope';
import { Button, Card, EmptyState, IconButton, Photo, Screen, Segmented, haptic, webSpaceAction } from '../../src/components/ui';
import { useFeedback } from '../../src/components/feedback';
import { BottomSheet, FadeIn, useCountUp } from '../../src/components/motion';
import { MoodIcon } from '../../src/components/MoodIcon';
import { MoodTrendChart, TimeOfDayChart } from '../../src/components/Charts';
import { MOODS, moodMeta, moodTint } from '../../src/data/constants';
import { computeInsights, computeStreaks, earliestOffset, type DayCell, type PeriodInsights, type PeriodKind } from '../../src/utils/insights';
import { computeMilestones, computeStats, findThrowbacks, type ThrowbackRange } from '../../src/utils/stats';
import { excerpt, fmtNumber } from '../../src/utils/text';
import { fmtFullDate, fmtMonthDay, fmtTime } from '../../src/utils/date';
import { MIN_REVIEW_ENTRIES } from '../../src/utils/ai/review';
import { aiErrorMessage } from '../../src/utils/ai/client';
import { useAIStatus, writeReview } from '../../src/services/ai';
import type { Entry, PeriodReview } from '../../src/store/types';

const KIND_ITEMS: { key: PeriodKind; label: string }[] = [
  { key: 'week', label: '周' },
  { key: 'month', label: '月' },
  { key: 'year', label: '年' },
];
const PREV_LABEL: Record<PeriodKind, string> = { week: '上一周', month: '上个月', year: '上一年' };
const CURRENT_LABEL: Record<PeriodKind, string> = { week: '本周', month: '本月', year: '今年' };
const isKind = (v: unknown): v is PeriodKind => v === 'week' || v === 'month' || v === 'year';

/**
 * 回顾：把「统计」和「回顾」合成一页。
 * 先选看多长（周 / 月 / 年），再左右翻期；首屏是这段时间最关心的三个数字，
 * 往下依次是哪几天写了、心情怎样、写了什么、什么时候写——年视图就是年度报告。
 */
export default function ReviewScreen() {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ scope?: string; year?: string }>();
  const entries = useBookEntries();
  const openSearch = useOpenSearch();
  const [kind, setKind] = useState<PeriodKind>(isKind(params.scope) ? params.scope : 'week');
  const [offset, setOffset] = useState(() => (params.scope === 'year' && params.year ? Number(params.year) - new Date().getFullYear() || 0 : 0));

  // 从「我的 · 年度回顾」等入口带着参数进来：切到对应视图
  useEffect(() => {
    if (!isKind(params.scope)) return;
    setKind(params.scope);
    setOffset(params.scope === 'year' && params.year ? Number(params.year) - new Date().getFullYear() || 0 : 0);
  }, [params.scope, params.year]);

  const published = useMemo(() => entries.filter(e => !e.deletedAt && !e.hidden && e.status === 'published'), [entries]);
  const minOffset = useMemo(() => Math.min(0, earliestOffset(published, kind)), [published, kind]);
  const data = useMemo(() => computeInsights(published, kind, offset), [published, kind, offset]);
  const streaks = useMemo(() => computeStreaks(published), [published]);

  const scrollRef = useRef<ScrollView>(null);
  const changeKind = (k: PeriodKind) => {
    setKind(k);
    setOffset(0);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  const step = (delta: number) => {
    const next = Math.min(0, Math.max(minOffset, offset + delta));
    if (next === offset) return;
    haptic('light');
    setOffset(next);
  };
  /** 年视图里点某个月：钻进那个月 */
  const openMonth = (month: number) => {
    const now = new Date();
    const year = new Date(data.period.from).getFullYear();
    haptic('light');
    setKind('month');
    setOffset((year - now.getFullYear()) * 12 + (month - 1 - now.getMonth()));
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <Screen edges={['top']}>
      <View style={{ height: 52, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <ScreenTitle title="回顾" />
        <IconButton icon={Search} label="搜索" onPress={openSearch} />
      </View>
      <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
        <Segmented value={kind} onChange={changeKind} items={KIND_ITEMS} />
      </View>

      {published.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            illustration="emptyBook"
            imageSize={160}
            title="还没有可以回顾的日记"
            desc="写下的每一天，都会在这里变成你的周记、月历和年度报告。"
            action="写一篇日记"
            onAction={() => router.push('/write')}
          />
        </View>
      ) : (
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          <PeriodNav
            label={data.period.rangeText}
            sub={data.period.isCurrent ? CURRENT_LABEL[kind] : undefined}
            canPrev={offset > minOffset}
            canNext={offset < 0}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            onReset={() => setOffset(0)}
            resetLabel={`回到${CURRENT_LABEL[kind]}`}
          />
          <FadeIn key={`${kind}:${offset}`} dy={8} duration={240} style={{ gap: 16 }}>
            <SummaryCard data={data} streak={data.period.isCurrent ? streaks.current : 0} longest={streaks.longest} />
            {data.count === 0 ? (
              <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
                <Text style={{ color: c.textSub, textAlign: 'center' }}>这段时间没有留下日记</Text>
                {data.period.isCurrent && (
                  <Button title="现在写一篇" variant="soft" size="sm" full={false} onPress={() => router.push('/write')} style={{ marginTop: 14 }} />
                )}
              </Card>
            ) : (
              <>
                <DaysCard data={data} entries={published} onOpenMonth={openMonth} />
                <MoodCard data={data} />
                {kind !== 'year' && <AIReviewCard kind={kind} offset={offset} data={data} />}
                {kind === 'year' && <MonthsCard data={data} onOpenMonth={openMonth} />}
                <TopicsCard data={data} />
                {kind !== 'week' && data.count >= 3 && <HabitsCard data={data} />}
                {kind !== 'week' && <HighlightsCard data={data} />}
                {kind !== 'week' && data.photoUris.length >= 3 && <PhotosCard data={data} />}
              </>
            )}
            {data.period.isCurrent && kind !== 'year' && <ThrowbackCard published={published} />}
            <MilestoneRow published={published} />
          </FadeIn>
        </ScrollView>
      )}
    </Screen>
  );
}

/* ---------------- 翻期 ---------------- */

function PeriodNav({ label, sub, canPrev, canNext, onPrev, onNext, onReset, resetLabel }: {
  label: string; sub?: string; canPrev: boolean; canNext: boolean; onPrev: () => void; onNext: () => void; onReset: () => void; resetLabel: string;
}) {
  const { c, t, fs } = useTheme();
  const arrow = (dir: 'prev' | 'next', enabled: boolean, onPress: () => void) => {
    const Icon = dir === 'prev' ? ChevronLeft : ChevronRight;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={dir === 'prev' ? '上一期' : '下一期'}
        accessibilityState={{ disabled: !enabled }}
        disabled={!enabled}
        onPress={onPress}
        hitSlop={6}
        style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: enabled ? (pressed ? 0.5 : 1) : 0.25 })}
      >
        <Icon size={22} color={c.text} strokeWidth={1.8} />
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }}>
      {arrow('prev', canPrev, onPrev)}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text accessibilityRole="header" style={[t.h2, { fontSize: fs(18) }]}>{label}</Text>
        {sub ? (
          <Text style={{ fontSize: fs(12), color: c.textMuted, marginTop: 2 }}>{sub}</Text>
        ) : (
          <Pressable accessibilityRole="button" onPress={onReset} hitSlop={8}>
            <Text style={{ fontSize: fs(12), color: c.primaryDark, marginTop: 2 }}>{resetLabel}</Text>
          </Pressable>
        )}
      </View>
      {arrow('next', canNext, onNext)}
    </View>
  );
}

/* ---------------- 首屏数字 ---------------- */

function BigNum({ value, unit, label }: { value: number; unit: string; label: string }) {
  const { c, fs } = useTheme();
  const v = useCountUp(value, 500);
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: fs(28), lineHeight: fs(34), color: c.text, fontWeight: '600', fontVariant: ['tabular-nums'], flexShrink: 1 }}>{fmtNumber(v)}</Text>
        <Text style={{ fontSize: fs(12), color: c.textSub }}>{unit}</Text>
      </View>
      <Text style={{ fontSize: fs(12), color: c.textMuted, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function SummaryCard({ data, streak, longest }: { data: PeriodInsights; streak: number; longest: number }) {
  const { c, fs } = useTheme();
  const diff = data.count - data.prevCount;
  const prev = PREV_LABEL[data.period.kind];
  const compare = diff > 0 ? `比${prev}多写了 ${diff} 篇` : diff < 0 ? `比${prev}少 ${-diff} 篇` : data.count ? `和${prev}一样多` : '';
  return (
    <Card style={{ paddingVertical: 18 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <BigNum value={data.count} unit="篇" label="日记" />
        <BigNum value={data.days} unit="天" label="记录天数" />
        <BigNum value={data.words} unit="字" label="写下文字" />
      </View>
      {(!!compare || streak > 0) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider, gap: 8 }}>
          <Text style={{ fontSize: fs(12.5), color: c.textSub, flexShrink: 1 }} numberOfLines={1}>{compare}</Text>
          {streak > 0 && (
            <View accessibilityLabel={`已连续记录 ${streak} 天，最长 ${longest} 天`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Flame size={14} color={c.warning} strokeWidth={2} />
              <Text style={{ fontSize: fs(12.5), color: c.text, fontWeight: '600', fontVariant: ['tabular-nums'] }}>连续 {streak} 天</Text>
            </View>
          )}
        </View>
      )}
    </Card>
  );
}

/* ---------------- 记录分布：周条 / 月历 / 年度像素 ---------------- */

function CardTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  const { t, fs } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, minHeight: 22 }}>
      <Text accessibilityRole="header" style={[t.h3, { fontSize: fs(15.5) }]}>{title}</Text>
      {right}
    </View>
  );
}

function useOpenDay(entries: Entry[]) {
  const { sheet } = useFeedback();
  return useCallback((cell: DayCell) => {
    if (!cell.count) return;
    haptic('light');
    if (cell.entryIds.length === 1) {
      router.push({ pathname: '/memory/[id]', params: { id: cell.entryIds[0] } });
      return;
    }
    const list = cell.entryIds.map(id => entries.find(e => e.id === id)).filter((e): e is Entry => !!e);
    sheet(
      list.map(e => ({ label: `${fmtTime(e.createdAt)}  ${e.title || excerpt(e.body, 14) || '无题日记'}`, icon: FileText, onPress: () => router.push({ pathname: '/memory/[id]', params: { id: e.id } }) })),
      fmtMonthDay(cell.date),
    );
  }, [entries, sheet]);
}

function DaysCard({ data, entries, onOpenMonth }: { data: PeriodInsights; entries: Entry[]; onOpenMonth: (month: number) => void }) {
  const openDay = useOpenDay(entries);
  const kind = data.period.kind;
  return (
    <Card>
      <CardTitle title={kind === 'year' ? '一年里的每一天' : '记录的日子'} right={<MoodLegendHint />} />
      {kind === 'week' && <WeekStrip cells={data.cells} onOpenDay={openDay} />}
      {kind === 'month' && <MonthGrid cells={data.cells} onOpenDay={openDay} />}
      {kind === 'year' && <YearRows cells={data.cells} onOpenMonth={onOpenMonth} />}
    </Card>
  );
}

function MoodLegendHint() {
  const { c, fs } = useTheme();
  return <Text style={{ fontSize: fs(11.5), color: c.textMuted }}>颜色 = 当天心情</Text>;
}

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function WeekStrip({ cells, onOpenDay }: { cells: DayCell[]; onOpenDay: (c: DayCell) => void }) {
  const { c, fs, dark } = useTheme();
  const today = new Date().toDateString();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {cells.map((cell, i) => {
        const meta = moodMeta(cell.mood);
        const isToday = new Date(cell.date).toDateString() === today;
        return (
          <Pressable
            key={cell.key}
            disabled={!cell.count}
            onPress={() => onOpenDay(cell)}
            accessibilityRole="button"
            accessibilityLabel={`周${WEEK_LABELS[i]} ${fmtMonthDay(cell.date)}，${cell.count ? `${cell.count} 篇${meta ? `，${meta.label}` : ''}` : '没有记录'}`}
            style={{ flex: 1, alignItems: 'center', gap: 6 }}
          >
            <Text style={{ fontSize: fs(11.5), color: isToday ? c.primaryDark : c.textMuted, fontWeight: isToday ? '600' : '400' }}>{WEEK_LABELS[i]}</Text>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: cell.count ? (meta ? moodTint(meta, dark) : c.primaryFaint) : 'transparent',
                borderWidth: cell.count ? 0 : 1,
                borderStyle: cell.future ? 'dashed' : 'solid',
                borderColor: cell.future ? c.divider : c.border,
              }}
            >
              {cell.count ? (meta ? <MoodIcon mood={meta.key} size={26} /> : <CheckCircle2 size={18} color={c.primaryDark} />) : null}
            </View>
            <Text style={{ fontSize: fs(11), color: c.textSub, fontVariant: ['tabular-nums'] }}>{new Date(cell.date).getDate()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MonthGrid({ cells, onOpenDay }: { cells: DayCell[]; onOpenDay: (c: DayCell) => void }) {
  const { c, fs, r, dark } = useTheme();
  const lead = (new Date(cells[0].date).getDay() + 6) % 7;
  const slots: (DayCell | null)[] = [...Array.from({ length: lead }, () => null), ...cells];
  while (slots.length % 7) slots.push(null);
  const todayKey = cells.find(cell => new Date(cell.date).toDateString() === new Date().toDateString())?.key;
  return (
    <View>
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {WEEK_LABELS.map(l => (
          <Text key={l} style={{ flex: 1, textAlign: 'center', fontSize: fs(11), color: c.textMuted }}>{l}</Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {slots.map((cell, i) => {
          if (!cell) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
          const meta = moodMeta(cell.mood);
          const isToday = cell.key === todayKey;
          return (
            <Pressable
              key={cell.key}
              disabled={!cell.count}
              onPress={() => onOpenDay(cell)}
              accessibilityRole="button"
              accessibilityLabel={`${fmtMonthDay(cell.date)}，${cell.count ? `${cell.count} 篇${meta ? `，${meta.label}` : ''}` : '没有记录'}`}
              style={({ pressed }) => ({ width: `${100 / 7}%`, aspectRatio: 1, padding: 2.5, opacity: pressed ? 0.7 : 1 })}
            >
              <View
                style={{
                  flex: 1,
                  borderRadius: r(10),
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: cell.count ? (meta ? moodTint(meta, dark) : c.primaryFaint) : cell.future ? 'transparent' : c.bgDeep,
                  borderWidth: isToday ? 1.5 : 0,
                  borderColor: c.text,
                }}
              >
                <Text style={{ fontSize: fs(12.5), color: cell.future ? c.textMuted : c.text, fontWeight: cell.count ? '600' : '400', fontVariant: ['tabular-nums'] }}>{new Date(cell.date).getDate()}</Text>
                {meta && <View style={{ position: 'absolute', bottom: 5, width: 5, height: 5, borderRadius: 3, backgroundColor: meta.color }} />}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** 年度像素：每行一个月、每格一天；点一行钻进那个月 */
function YearRows({ cells, onOpenMonth }: { cells: DayCell[]; onOpenMonth: (month: number) => void }) {
  const { c, fs } = useTheme();
  const rows = useMemo(() => {
    const out: DayCell[][] = Array.from({ length: 12 }, () => []);
    for (const cell of cells) out[new Date(cell.date).getMonth()].push(cell);
    return out;
  }, [cells]);
  return (
    <View style={{ gap: 4 }}>
      {rows.map((row, m) => {
        const recorded = row.filter(cell => cell.count).length;
        return (
          <Pressable
            key={m}
            onPress={() => onOpenMonth(m + 1)}
            accessibilityRole="button"
            accessibilityLabel={`${m + 1}月，记录了 ${recorded} 天，查看这个月`}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.6 : 1, minHeight: 14 })}
          >
            <Text style={{ width: 30, fontSize: fs(10.5), color: c.textMuted, fontVariant: ['tabular-nums'] }}>{m + 1}月</Text>
            <View style={{ flex: 1, flexDirection: 'row', gap: 1.5 }}>
              {Array.from({ length: 31 }, (_, d) => {
                const cell = row[d];
                const meta = moodMeta(cell?.mood);
                const bg = !cell ? 'transparent' : cell.count ? meta?.color ?? c.primary : cell.future ? c.bg : c.bgDeep;
                return <View key={d} style={{ flex: 1, aspectRatio: 1, maxHeight: 12, borderRadius: 2, backgroundColor: bg }} />;
              })}
            </View>
          </Pressable>
        );
      })}
      <Text style={{ fontSize: fs(11), color: c.textMuted, marginTop: 8 }}>点任意一行，查看那个月的详细回顾</Text>
    </View>
  );
}

/* ---------------- 心情 ---------------- */

function MoodCard({ data }: { data: PeriodInsights }) {
  const { c, fs, r } = useTheme();
  const dom = moodMeta(data.dominantMood);
  const scored = data.trend.filter(p => p.score !== null).length;
  return (
    <Card>
      <CardTitle
        title="心情"
        right={dom ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: fs(12), color: c.textMuted }}>最常感到</Text>
            <MoodIcon mood={dom.key} size={16} />
            <Text style={{ fontSize: fs(12.5), color: c.text, fontWeight: '600' }}>{dom.label}</Text>
          </View>
        ) : undefined}
      />
      {data.moodTotal === 0 ? (
        <Text style={{ fontSize: fs(13), color: c.textMuted }}>这段时间的日记还没有标记心情。写日记时选一个心情，这里就会出现情绪变化。</Text>
      ) : (
        <>
          <View style={{ flexDirection: 'row', height: 10, borderRadius: r(999), overflow: 'hidden', gap: 2 }}>
            {data.moods.map(m => <View key={m.key} style={{ flex: m.count, backgroundColor: m.color }} />)}
          </View>
          <View style={{ marginTop: 12 }}>
            {data.moods.slice(0, 5).map(m => (
              <Pressable
                key={m.key}
                onPress={() => router.push({ pathname: '/search', params: { mood: m.key } })}
                accessibilityRole="button"
                accessibilityLabel={`${m.label} ${m.count} 篇，占 ${m.percent}%，查看这些日记`}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40, opacity: pressed ? 0.6 : 1 })}
              >
                <MoodIcon mood={m.key} size={22} />
                <Text style={{ flex: 1, fontSize: fs(14), color: c.text }}>{m.label}</Text>
                <Text style={{ fontSize: fs(13), color: c.textSub, fontVariant: ['tabular-nums'] }}>{m.count} 篇</Text>
                <Text style={{ width: 42, textAlign: 'right', fontSize: fs(13), color: c.textMuted, fontVariant: ['tabular-nums'] }}>{m.percent}%</Text>
              </Pressable>
            ))}
          </View>
          {data.period.kind === 'month' && scored >= 3 && (
            <View style={{ marginTop: 10, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider }}>
              <Text style={{ fontSize: fs(12.5), color: c.textSub, marginBottom: 4 }}>每日心情起伏</Text>
              <MoodTrendChart points={data.trend} height={124} />
            </View>
          )}
        </>
      )}
    </Card>
  );
}

/* ---------------- 「记得」写的回看（周 / 月） ---------------- */

function AIReviewCard({ kind, offset, data }: { kind: 'week' | 'month'; offset: number; data: PeriodInsights }) {
  const { c, t, fs, r } = useTheme();
  const { toast } = useFeedback();
  const reviews = useStore(s => s.reviews);
  const aiReady = useAIStatus() === 'ready';
  const [busy, setBusy] = useState(false);
  const review: PeriodReview | undefined = useMemo(() => reviews.find(rv => rv.kind === kind && rv.from === data.period.from), [reviews, kind, data.period.from]);
  const enough = data.count >= MIN_REVIEW_ENTRIES;
  const label = data.period.label;

  const generate = async () => {
    setBusy(true);
    try {
      await writeReview(kind, offset);
      toast('已写好这份回看');
    } catch (e) {
      toast(aiErrorMessage(e), { type: 'warning' });
    } finally {
      setBusy(false);
    }
  };

  if (!review && !enough) return null;

  return (
    <Card>
      <CardTitle title="这一程的回看" right={review ? <Text style={{ fontSize: fs(11.5), color: c.textMuted }}>由「记得」根据 {review.entryCount} 篇日记写成</Text> : undefined} />
      {review ? (
        <>
          <Text textRole="reading" style={{ fontSize: fs(15), lineHeight: fs(15) * 1.8, color: c.text }}>{review.summary}</Text>
          {review.themes.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {review.themes.map(theme => (
                <View key={theme} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: r(999), backgroundColor: c.primaryFaint }}>
                  <Text style={{ fontSize: fs(12), color: c.primaryDark }}>{theme}</Text>
                </View>
              ))}
            </View>
          )}
          {!!review.moodLine && <Text style={[t.sub, { marginTop: 12 }]}>{review.moodLine}</Text>}
          {review.quote && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="打开这句话所在的日记"
              onPress={() => router.push({ pathname: '/memory/[id]', params: { id: review.quote!.entryId } })}
              style={({ pressed }) => ({ marginTop: 12, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: c.primary, opacity: pressed ? 0.6 : 1 })}
            >
              <Text textRole="reading" style={{ fontSize: fs(14), lineHeight: fs(14) * 1.7, color: c.textSub }}>“{review.quote.text}”</Text>
            </Pressable>
          )}
          {!!review.question && (
            <View style={{ marginTop: 14, padding: 12, borderRadius: r(12), backgroundColor: c.cardAlt }}>
              <Text style={{ fontSize: fs(11.5), color: c.textMuted, marginBottom: 4 }}>留给下一段的问题</Text>
              <Text style={{ fontSize: fs(14), color: c.text, lineHeight: fs(22) }}>{review.question}</Text>
            </View>
          )}
          {aiReady && (
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void generate()} style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: 4, marginBottom: -10 }}>
              <Text style={{ fontSize: fs(13), color: busy ? c.textMuted : c.primaryDark }}>{busy ? '正在重新回看…' : '重新回看'}</Text>
            </Pressable>
          )}
        </>
      ) : (
        <>
          <Text style={[t.sub, { lineHeight: fs(22) }]}>
            {aiReady
              ? `${label}写了 ${data.count} 篇。让「记得」读完它们，写一份回看：经历了什么、反复出现的主题、一句摘录，和一个留给下一段的问题。`
              : `开启「记得」后，它会读完${label}的 ${data.count} 篇日记，写一份安静的回看。`}
          </Text>
          <Button
            title={aiReady ? (busy ? '正在读这段时间的日记…' : `回看${label}`) : '去开启'}
            variant="soft"
            size="sm"
            full={false}
            loading={busy}
            onPress={aiReady ? () => void generate() : () => router.push('/settings/ai')}
            style={{ marginTop: 14, alignSelf: 'flex-start' }}
          />
        </>
      )}
    </Card>
  );
}

/* ---------------- 年视图：每月记录 ---------------- */

function MonthsCard({ data, onOpenMonth }: { data: PeriodInsights; onOpenMonth: (month: number) => void }) {
  const { c, fs, r } = useTheme();
  const max = Math.max(1, ...data.months.map(m => m.count));
  const busiest = data.months.reduce((a, b) => (b.count > a.count ? b : a), data.months[0]);
  return (
    <Card>
      <CardTitle title="每月记录" right={busiest?.count ? <Text style={{ fontSize: fs(12), color: c.textMuted }}>{busiest.month}月写得最多</Text> : undefined} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 132 }}>
        {data.months.map(m => {
          const h = m.count ? Math.max(6, Math.round((m.count / max) * 96)) : 3;
          const moodSum = m.moods.reduce((s, x) => s + x.count, 0);
          return (
            <Pressable
              key={m.month}
              onPress={() => onOpenMonth(m.month)}
              accessibilityRole="button"
              accessibilityLabel={`${m.month}月 ${m.count} 篇，查看这个月`}
              style={({ pressed }) => ({ flex: 1, alignItems: 'center', opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ fontSize: fs(10), color: m.count ? c.textSub : 'transparent', marginBottom: 4, fontVariant: ['tabular-nums'] }}>{m.count}</Text>
              <View style={{ width: '58%', height: h, borderRadius: r(4), overflow: 'hidden', backgroundColor: m.count ? c.primarySoft : c.divider, justifyContent: 'flex-end' }}>
                {m.count > 0 && m.moods.map(x => (
                  <View key={x.key} style={{ height: `${(x.count / m.count) * 100}%`, backgroundColor: moodMeta(x.key)?.color }} />
                ))}
                {m.count > 0 && moodSum < m.count && <View style={{ height: `${((m.count - moodSum) / m.count) * 100}%` }} />}
              </View>
              <Text style={{ fontSize: fs(10.5), color: c.textMuted, marginTop: 6, fontVariant: ['tabular-nums'] }}>{m.month}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
        {MOODS.filter(m => data.moods.some(x => x.key === m.key)).map(m => (
          <View key={m.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: m.color }} />
            <Text style={{ fontSize: fs(11), color: c.textSub }}>{m.label}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

/* ---------------- 写到了什么 ---------------- */

function TopicsCard({ data }: { data: PeriodInsights }) {
  const { c, fs, r } = useTheme();
  const tags = useStore(s => s.tags);
  const people = useStore(s => s.people);
  const tagItems = data.tags.slice(0, 8).map(x => ({ ...x, name: tags.find(tg => tg.id === x.id)?.name })).filter(x => x.name);
  const peopleItems = data.people.slice(0, 6).map(x => ({ ...x, name: people.find(p => p.id === x.id)?.name })).filter(x => x.name);
  const places = data.places.slice(0, 6);
  if (!tagItems.length && !peopleItems.length && !places.length) return null;

  const chip = (key: string, label: string, n: number, onPress: () => void, icon?: React.ReactNode) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}，${n} 篇`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, minHeight: 34, borderRadius: r(999), backgroundColor: c.cardAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider, opacity: pressed ? 0.6 : 1 })}
    >
      {icon}
      <Text style={{ fontSize: fs(13), color: c.text }}>{label}</Text>
      <Text style={{ fontSize: fs(12), color: c.textMuted, fontVariant: ['tabular-nums'] }}>{n}</Text>
    </Pressable>
  );
  const section = (title: string, children: React.ReactNode) => (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: fs(12), color: c.textMuted }}>{title}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
    </View>
  );

  return (
    <Card>
      <CardTitle title="写到的" />
      <View style={{ gap: 16 }}>
        {tagItems.length > 0 && section('标签', tagItems.map(x => chip(x.id, `#${x.name}`, x.count, () => router.push({ pathname: '/search', params: { tag: x.id } }))))}
        {peopleItems.length > 0 && section('身边的人', peopleItems.map(x => chip(x.id, x.name!, x.count, () => router.push({ pathname: '/people/[id]', params: { id: x.id } }))))}
        {places.length > 0 && section('去过的地方', places.map(x => chip(x.name, x.name, x.count, () => router.push({ pathname: '/search', params: { q: x.name.split('·')[0].trim() } }), <MapPin size={12} color={c.textMuted} />)))}
      </View>
    </Card>
  );
}

/* ---------------- 写作习惯 ---------------- */

function HabitsCard({ data }: { data: PeriodInsights }) {
  const { c, fs } = useTheme();
  const peak = [...data.timeSlots].sort((a, b) => b.count - a.count)[0];
  return (
    <Card>
      <CardTitle title="写作习惯" right={<Text style={{ fontSize: fs(12), color: c.textMuted }}>平均每篇 {fmtNumber(data.avgWords)} 字</Text>} />
      {peak?.count > 0 && <Text style={{ fontSize: fs(13), color: c.textSub }}>大多在<Text style={{ color: c.text, fontWeight: '600' }}>{peak.label}</Text>落笔，占 {peak.percent}%</Text>}
      <TimeOfDayChart slots={data.timeSlots} />
    </Card>
  );
}

/* ---------------- 值得再读的几篇 ---------------- */

function HighlightsCard({ data }: { data: PeriodInsights }) {
  const { c, fs } = useTheme();
  const rows = [
    data.first && { key: 'first', label: '第一篇', entry: data.first, meta: fmtMonthDay(data.first.createdAt) },
    data.longest && data.longest.id !== data.first?.id && { key: 'longest', label: '写得最长', entry: data.longest, meta: fmtMonthDay(data.longest.createdAt) },
    data.latestNight && { key: 'night', label: '最晚的一篇', entry: data.latestNight, meta: `${fmtMonthDay(data.latestNight.createdAt)} ${fmtTime(data.latestNight.createdAt)}` },
  ].filter(Boolean) as { key: string; label: string; entry: Entry; meta: string }[];
  if (!rows.length) return null;
  return (
    <Card style={{ paddingBottom: 6 }}>
      <CardTitle title="值得再读" />
      {rows.map((row, i) => (
        <Pressable
          key={row.key}
          onPress={() => router.push({ pathname: '/memory/[id]', params: { id: row.entry.id } })}
          accessibilityRole="button"
          accessibilityLabel={`${row.label}：${row.entry.title || '无题日记'}`}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: c.divider, opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={{ width: 64, fontSize: fs(12), color: c.textMuted }}>{row.label}</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text textRole="reading" numberOfLines={1} style={{ fontSize: fs(14.5), color: c.text, fontWeight: '600' }}>{row.entry.title || excerpt(row.entry.body, 18) || '无题日记'}</Text>
            <Text style={{ fontSize: fs(11.5), color: c.textMuted, marginTop: 2 }}>{row.meta}</Text>
          </View>
          <ChevronRight size={16} color={c.textMuted} />
        </Pressable>
      ))}
    </Card>
  );
}

function PhotosCard({ data }: { data: PeriodInsights }) {
  const { c, fs, r } = useTheme();
  return (
    <Card>
      <CardTitle
        title="影像"
        right={
          <Pressable accessibilityRole="button" onPress={() => router.push('/photos')} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: fs(12.5), color: c.primaryDark }}>全部 {data.photos}</Text>
            <ChevronRight size={14} color={c.primaryDark} />
          </Pressable>
        }
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {data.photoUris.slice(0, 6).map((p, i) => (
          <Photo key={p + i} uri={p} style={{ width: '32.2%', aspectRatio: 1 }} radius={r(10)} />
        ))}
      </View>
    </Card>
  );
}

/* ---------------- 往事 ---------------- */

function ThrowbackCard({ published }: { published: Entry[] }) {
  const { c, t, fs, r } = useTheme();
  const tags = useStore(s => s.tags);
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<ThrowbackRange>('all');
  const [excluded, setExcluded] = useState<string[]>([]);
  const items = useMemo(() => findThrowbacks(published, Date.now(), { range, excludedTags: excluded }), [published, range, excluded]);
  const usedTags = useMemo(() => tags.filter(tag => published.some(e => e.tags.includes(tag.id))), [tags, published]);
  const toggleTag = (id: string) => setExcluded(cur => (cur.includes(id) ? cur.filter(v => v !== id) : [...cur, id]));
  const rangeLabel = range === 'past-year' ? '近一年' : range === 'earlier' ? '一年以前' : '全部往事';

  return (
    <Card style={{ paddingBottom: items.length ? 6 : 16 }}>
      <CardTitle
        title="往事"
        right={
          <Pressable accessibilityRole="button" accessibilityLabel="设置回忆范围" onPress={() => setOpen(true)} hitSlop={10}>
            <Text style={{ fontSize: fs(12.5), color: c.primaryDark }}>{rangeLabel}{excluded.length ? ` · 排除 ${excluded.length}` : ''}</Text>
          </Pressable>
        }
      />
      {items.length === 0 ? (
        <Text style={{ fontSize: fs(13), color: c.textMuted }}>当前范围还没有可回看的往事。</Text>
      ) : items.slice(0, 3).map((tb, i) => (
        <Pressable
          key={tb.entry.id}
          onPress={() => router.push({ pathname: '/memory/[id]', params: { id: tb.entry.id } })}
          accessibilityRole="button"
          accessibilityLabel={`${tb.label}，${tb.entry.title || '无题日记'}`}
          style={({ pressed }) => ({ paddingVertical: 12, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: c.divider, opacity: pressed ? 0.6 : 1 })}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: fs(12), color: c.primaryDark, fontWeight: '600' }}>{tb.label}</Text>
            <Text style={{ fontSize: fs(12), color: c.textMuted }}>{fmtFullDate(tb.entry.createdAt)}</Text>
          </View>
          <Text textRole="reading" numberOfLines={1} style={{ fontSize: fs(15), color: c.text, fontWeight: '600' }}>{tb.entry.title || '无题日记'}</Text>
          {!!tb.entry.body.trim() && <Text textRole="reading" numberOfLines={2} style={{ fontSize: fs(13), color: c.textSub, lineHeight: fs(21), marginTop: 3 }}>{excerpt(tb.entry.body, 70)}</Text>}
        </Pressable>
      ))}

      <BottomSheet visible={open} onClose={() => setOpen(false)} title="回忆范围">
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16, gap: 16 }}>
          <Text style={t.sub}>只影响「往事」里出现哪些日记，不含隐藏、已删与草稿。</Text>
          <View style={{ gap: 8 }}>
            {([{ key: 'all', label: '全部往事' }, { key: 'past-year', label: '近一年' }, { key: 'earlier', label: '一年以前' }] as const).map(option => {
              const on = range === option.key;
              return (
                <Pressable key={option.key} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: on }} aria-checked={on} {...webSpaceAction(() => setRange(option.key))} onPress={() => setRange(option.key)} style={{ minHeight: 48, padding: 12, borderRadius: r(12), backgroundColor: on ? c.primaryFaint : c.card, borderWidth: 1, borderColor: on ? c.primary : c.divider }}>
                  <Text style={{ color: on ? c.primaryDark : c.text, fontSize: fs(15) }}>{on ? '✓ ' : ''}{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {usedTags.length > 0 && (
            <>
              <Text style={t.h3}>不回顾这些标签</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {usedTags.map(tag => {
                  const on = excluded.includes(tag.id);
                  return (
                    <Pressable key={tag.id} accessibilityRole="checkbox" accessibilityLabel={`排除标签：${tag.name}`} accessibilityState={{ checked: on }} aria-checked={on} {...webSpaceAction(() => toggleTag(tag.id))} onPress={() => toggleTag(tag.id)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: r(10), backgroundColor: on ? c.primaryFaint : c.card, borderWidth: 1, borderColor: on ? c.primary : c.divider }}>
                      <Text style={{ color: c.text, fontSize: fs(14) }}>{on ? '✓ ' : ''}#{tag.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
        <Button title="完成" onPress={() => setOpen(false)} />
      </BottomSheet>
    </Card>
  );
}

/* ---------------- 里程碑 ---------------- */

function MilestoneRow({ published }: { published: Entry[] }) {
  const { c, t, fs } = useTheme();
  const [open, setOpen] = useState(false);
  const milestones = useMemo(() => computeMilestones(published, computeStats(published)), [published]);
  const achieved = milestones.filter(m => m.achieved).length;
  return (
    <>
      <Card onPress={() => setOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
        <Award size={20} color={c.primaryDark} strokeWidth={1.8} />
        <Text style={[t.h3, { flex: 1, fontSize: fs(15) }]}>成长里程碑</Text>
        <Text style={{ fontSize: fs(13), color: c.textSub, fontVariant: ['tabular-nums'] }}>已达成 {achieved} / {milestones.length}</Text>
        <ChevronRight size={16} color={c.textMuted} />
      </Card>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title="成长里程碑">
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
          {milestones.map((m, i) => (
            <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: c.divider, opacity: m.achieved ? 1 : 0.7 }}>
              {m.achieved ? <CheckCircle2 size={22} color={c.primaryDark} /> : <Award size={22} color={c.textMuted} />}
              <View style={{ flex: 1 }}>
                <Text style={[t.h3, { fontSize: fs(15) }]}>{m.title}</Text>
                <Text style={[t.caption, { marginTop: 2 }]}>{m.desc}</Text>
              </View>
              <Text style={{ fontSize: fs(12), color: m.achieved ? c.primaryDark : c.textMuted, fontWeight: m.achieved ? '600' : '400' }}>
                {m.achieved && m.date ? fmtMonthDay(m.date) : m.achieved ? '已达成' : m.progress}
              </Text>
            </View>
          ))}
        </ScrollView>
      </BottomSheet>
    </>
  );
}
