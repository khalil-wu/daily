import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './text';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import type { Entry, Tag } from '../store/types';
import { useTheme } from '../theme/ThemeProvider';
import { MOODS, moodMeta, moodTint } from '../data/constants';
import { dayKey, daysInMonth, fmtMonthDay, startOfDay, WEEK_SHORT } from '../utils/date';
import type { HeatmapCell, LengthBucket, MoodStat, TagMoodCorrelation, TimeSlotStat, TrendPoint } from '../utils/stats';
import type { KeywordCount } from '../utils/keywords';
import { MoodIcon } from './MoodIcon';
import { Photo } from './ui';
import { entryCover } from '../utils/video';
import { posterUri } from '../services/videoStore';

/* ============ 1. 心情分布环形图（1:1 复刻设计稿1 #15） ============ */

export function MoodDonutChart({ stats, size = 128 }: { stats: MoodStat[]; size?: number }) {
  const { c, fs } = useTheme();
  const r = 44;
  const stroke = 20;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  const total = stats.reduce((a, b) => a + b.count, 0);

  let offset = 0;
  const segments = stats.map(s => {
    const frac = total > 0 ? s.count / total : 0;
    const len = frac * C;
    const seg = { ...s, len, dashoffset: -offset };
    offset += len;
    return seg;
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle cx={cx} cy={cy} r={r} stroke={c.divider} strokeWidth={stroke} fill="none" />
          {segments.map(seg => (
            <Circle
              key={seg.key}
              cx={cx}
              cy={cy}
              r={r}
              stroke={seg.color}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${seg.len} ${C}`}
              strokeDashoffset={seg.dashoffset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          ))}
        </Svg>
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          <Text style={{ fontSize: fs(17), fontWeight: '600', color: c.text, fontVariant: ['tabular-nums'] }}>{total}</Text>
          <Text style={{ fontSize: fs(10), color: c.textMuted }}>条情绪</Text>
        </View>
      </View>

      <View style={{ flex: 1, gap: 8 }}>
        {stats.length === 0 ? (
          <Text style={{ fontSize: fs(13), color: c.textMuted }}>暂无心情记录</Text>
        ) : (
          stats.map(s => (
            <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: s.color, marginRight: 8 }} />
              <Text style={{ flex: 1, fontSize: fs(13), color: c.text }}>{s.label}</Text>
              <Text style={{ fontSize: fs(12), color: c.textMuted, marginRight: 8, fontVariant: ['tabular-nums'] }}>{s.count} 篇</Text>
              <Text style={{ fontSize: fs(13), color: c.textSub, fontVariant: ['tabular-nums'], minWidth: 34, textAlign: 'right' }}>{s.percent}%</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

/* ============ 2. 情绪趋势平滑折线图（1:1 复刻设计稿1 #15） ============ */

export function MoodTrendChart({ points, width = 290, height = 136 }: { points: TrendPoint[]; width?: number; height?: number }) {
  const { c, fs } = useTheme();
  const [boxW, setBoxW] = useState(width);
  const w = Math.max(200, boxW);
  const padL = 32;
  const padR = 12;
  const padT = 18;
  const padB = 24;
  const plotW = Math.max(120, w - padL - padR);
  const plotH = height - padT - padB;

  const valid = points
    .map((p, idx) => ({ ...p, idx }))
    .filter(p => p.score !== null) as (TrendPoint & { idx: number; score: number })[];

  const coords = valid.map(p => {
    const score = Math.min(5, Math.max(1, p.score));
    const x = padL + (points.length > 1 ? (p.idx / (points.length - 1)) * plotW : plotW / 2);
    const y = padT + (1 - (score - 1) / 4) * plotH;
    return { x, y, label: p.label, score };
  });

  let linePath = '';
  let areaPath = '';
  if (coords.length === 1) {
    linePath = `M ${coords[0].x} ${coords[0].y} L ${coords[0].x + 1} ${coords[0].y}`;
  } else if (coords.length > 1) {
    linePath = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const a = coords[i];
      const b = coords[i + 1];
      const cx = (a.x + b.x) / 2;
      linePath += ` C ${cx} ${a.y}, ${cx} ${b.y}, ${b.x} ${b.y}`;
    }
    const baseY = padT + plotH;
    areaPath = `${linePath} L ${coords[coords.length - 1].x} ${baseY} L ${coords[0].x} ${baseY} Z`;
  }

  const tickIdx = [0, 7, 14, 21, 28].filter(i => i < points.length);

  return (
    <View onLayout={e => { const nw = Math.round(e.nativeEvent.layout.width); if (nw > 80 && nw !== boxW) setBoxW(nw); }}>
      <Svg width={w} height={height}>
        <Defs>
          <LinearGradient id="moodArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.primary} stopOpacity="0.28" />
            <Stop offset="1" stopColor={c.primary} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>
        {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
          const y = padT + r * plotH;
          return <Path key={i} d={`M ${padL} ${y} L ${w - padR} ${y}`} stroke={c.divider} strokeWidth={1} strokeDasharray="3 3" />;
        })}
        {areaPath ? <Path d={areaPath} fill="url(#moodArea)" /> : null}
        {linePath ? <Path d={linePath} stroke={c.primary} strokeWidth={2.4} fill="none" strokeLinecap="round" /> : null}
        {coords.map((pt, i) => (
          <Circle key={i} cx={pt.x} cy={pt.y} r={3.6} fill={c.card} stroke={c.primary} strokeWidth={2} />
        ))}
      </Svg>

      {/* Y 轴刻度和 X 轴日期 */}
      <View style={{ position: 'absolute', left: 0, top: padT - 6, height: plotH + 12, justifyContent: 'space-between' }}>
        {['愉悦', '4', '平稳', '2', '低落'].map(n => (
          <Text key={n} style={{ fontSize: 9.5, color: c.textMuted, width: 26, textAlign: 'right' }}>{n}</Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: padL, paddingRight: padR, marginTop: -18 }}>
        {tickIdx.map(i => (
          <Text key={i} style={{ fontSize: fs(10.5), color: c.textMuted }}>{points[i]?.label}</Text>
        ))}
      </View>
      {coords.length === 0 && (
        <Text style={{ textAlign: 'center', fontSize: fs(12), color: c.textMuted, marginTop: 8 }}>记录带心情的日记后，这里将展示情绪变化曲线</Text>
      )}
    </View>
  );
}

/* ============ 3. 月度写作柱状图 ============ */

export function MonthlyBarChart({ data }: { data: { label: string; count: number }[] }) {
  const { c, fs, r } = useTheme();
  const max = Math.max(1, ...data.map(d => d.count));
  const dense = data.length > 8;
  const barW = dense ? 12 : 22;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120, paddingTop: 18 }}>
      {data.map((item, i) => {
        const h = Math.max(6, Math.round((item.count / max) * 76));
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: fs(dense ? 9.5 : 10.5), color: item.count ? c.textSub : c.textMuted, marginBottom: 4 }}>{item.count}</Text>
            <View style={{ width: barW, height: h, borderRadius: r(dense ? 5 : 7), backgroundColor: item.count ? c.primary : c.divider, opacity: item.count ? 0.9 : 0.6 }} />
            <Text style={{ fontSize: fs(dense ? 10 : 11), color: c.textSub, marginTop: 6 }}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

/* ============ 4. 日历月视图组件（1:1 复刻设计稿1 #12） ============ */

interface CalProps {
  year: number;
  month: number; // 0-11
  selectedDay: number;
  entries: Entry[];
  onSelectDay: (day: number) => void;
  onChangeMonth: (delta: number) => void;
  /** 可选：最晚可选的时间（写作页选日期时不能选未来） */
  maxTs?: number;
}

export const CalendarMonth = React.memo(function CalendarMonth({ year, month, selectedDay, entries, onSelectDay, onChangeMonth, maxTs }: CalProps) {
  const { c, t, fs, dark, r } = useTheme();
  const todayKey = dayKey(Date.now());
  const maxDay = maxTs != null ? startOfDay(maxTs) : null;
  const maxDate = maxTs != null ? new Date(maxTs) : null;
  const nextDisabled = !!maxDate && (year > maxDate.getFullYear() || (year === maxDate.getFullYear() && month >= maxDate.getMonth()));

  const { cells, entryMap } = useMemo(() => {
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // 周一 = 0
    const total = daysInMonth(year, month);
    const list: (number | null)[] = Array(firstDow).fill(null);
    for (let d = 1; d <= total; d++) list.push(d);
    while (list.length % 7 !== 0) list.push(null);

    const map = new Map<string, Entry[]>();
    for (const e of entries) {
      if (e.deletedAt || e.status !== 'published') continue;
      const k = dayKey(e.createdAt);
      const arr = map.get(k) ?? [];
      arr.push(e);
      map.set(k, arr);
    }
    return { cells: list, entryMap: map };
  }, [year, month, entries]);

  const weekOrder = [...WEEK_SHORT.slice(1), WEEK_SHORT[0]]; // 一 二 三 四 五 六 日

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 14, gap: 20 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="上个月" onPress={() => onChangeMonth(-1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={17} color={c.textSub} />
          </View>
        </Pressable>
        <Text style={[t.h2, { fontSize: fs(17), minWidth: 112, textAlign: 'center' }]}>
          {year}年{month + 1}月
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="下个月" disabled={nextDisabled} onPress={() => onChangeMonth(1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: nextDisabled ? 0.3 : 1 }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronRight size={17} color={c.textSub} />
          </View>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        {weekOrder.map(w => (
          <View key={w} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: fs(12), color: c.textMuted }}>{w}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((day, idx) => {
          if (!day) return <View key={idx} style={{ width: '14.2857%', height: 48 }} />;
          const ts = startOfDay(new Date(year, month, day));
          const k = dayKey(ts);
          const list = entryMap.get(k) ?? [];
          const isSelected = day === selectedDay;
          const isToday = k === todayKey;
          const isFuture = maxDay != null && ts > maxDay;
          const firstMood = list.find(e => e.mood)?.mood;
          const mMeta = moodMeta(firstMood);
          // 照片日历格：当天日记有封面照片时照片铺底，没有则心情色底 + 小圆点
          const coverEntry = list.find(e => !!entryCover(e).uri);
          const cover = coverEntry ? entryCover(coverEntry) : null;
          const coverUri = cover?.uri ? (cover.isVideo ? posterUri(cover.uri) ?? cover.uri : cover.uri) : null;
          const moodBg =
            !isSelected && list.length > 0 && !coverUri
              ? mMeta
                ? moodTint(mMeta, dark)
                : c.primaryFaint
              : 'transparent';

          return (
            <Pressable
              key={idx}
              disabled={isFuture}
              onPress={() => onSelectDay(day)}
              accessibilityLabel={`${month + 1}月${day}日${list.length ? `，${list.length} 篇日记` : ''}`}
              accessibilityState={{ selected: isSelected, disabled: isFuture }}
              style={{ width: '14.2857%', height: 48, alignItems: 'center', justifyContent: 'center', opacity: isFuture ? 0.3 : 1 }}
            >
              <View
                style={{
                  width: coverUri && isSelected ? 44 : 40,
                  height: coverUri && isSelected ? 44 : 40,
                  borderRadius: r(coverUri && isSelected ? 13 : 11),
                  padding: coverUri && isSelected ? 2 : 0,
                  borderWidth: coverUri && isSelected ? 2 : !isSelected && isToday ? 1.5 : 0,
                  borderColor: c.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: r(coverUri && isSelected ? 9 : 11),
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    backgroundColor: isSelected && !coverUri ? c.primary : moodBg,
                  }}
                >
                  {coverUri && (
                    <>
                      <Photo uri={coverUri} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} radius={0} />
                      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isSelected ? 'rgba(18,16,14,0.46)' : 'rgba(18,16,14,0.34)' }} />
                    </>
                  )}
                  <Text
                    style={{
                      fontSize: fs(13.5),
                      color: coverUri ? '#FFFFFF' : isSelected ? c.textOnPrimary : isToday ? c.primaryDark : c.text,
                      fontWeight: isSelected || isToday || list.length > 0 ? '600' : '400',
                      fontVariant: ['tabular-nums'],
                      ...(coverUri ? { textShadowColor: 'rgba(18,16,14,0.65)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 } : {}),
                    }}
                  >
                    {day}
                  </Text>
                  {!coverUri && list.length > 0 && (
                    <View style={{ width: 4, height: 4, borderRadius: 2, marginTop: 2, backgroundColor: isSelected ? c.textOnPrimary : mMeta?.color ?? c.primary }} />
                  )}
                  {list.length > 1 && (
                    <View style={{ position: 'absolute', top: 2, right: 2, minWidth: 13, height: 13, borderRadius: 6.5, paddingHorizontal: 3, backgroundColor: coverUri ? 'rgba(18,16,14,0.6)' : c.card, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 8.5, lineHeight: 11, color: coverUri ? '#FFFFFF' : c.textSub, fontVariant: ['tabular-nums'] }}>{list.length}</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

/* ============ 5. 近 12 周记录与心情像素热力矩阵（参考 Daylio / GitHub） ============ */

export function ActivityHeatmap({
  cells,
  mode,
}: {
  cells: HeatmapCell[];
  mode: 'heat' | 'mood';
}) {
  const { c, fs } = useTheme();
  const [picked, setPicked] = useState<HeatmapCell | null>(null);

  // 拆分为 12 列（每周一列，每列 7 天：周一..周日）
  const weeks = useMemo(() => {
    const out: HeatmapCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      out.push(cells.slice(i, i + 7));
    }
    return out;
  }, [cells]);

  const heatColor = (lvl: 0 | 1 | 2 | 3 | 4, future?: boolean) => {
    if (future) return 'transparent';
    if (lvl === 0) return c.bgDeep;
    if (lvl === 1) return c.primaryFaint;
    if (lvl === 2) return c.primarySoft;
    if (lvl === 3) return c.primary;
    return c.primaryDark;
  };

  const cellColor = (cell: HeatmapCell) => {
    if (cell.future) return 'transparent';
    if (mode === 'mood') {
      if (cell.mood) return moodMeta(cell.mood)?.color ?? c.primary;
      return cell.count > 0 ? c.primarySoft : c.bgDeep;
    }
    return heatColor(cell.level, cell.future);
  };

  const rowLabels = ['一', '二', '三', '四', '五', '六', '日'];

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ gap: 4, marginRight: 2 }}>
          {rowLabels.map((lbl, idx) => (
            <View key={lbl} style={{ height: 15, justifyContent: 'center' }}>
              <Text style={{ fontSize: 9.5, color: idx % 2 === 0 ? c.textMuted : 'transparent' }}>{lbl}</Text>
            </View>
          ))}
        </View>

        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', gap: 3 }}>
          {weeks.map((wk, wIdx) => (
            <View key={wIdx} style={{ flex: 1, gap: 4 }}>
              {wk.map(cell => {
                const isSelected = picked?.key === cell.key;
                return (
                  <Pressable
                    key={cell.key}
                    disabled={cell.future}
                    onPress={() => setPicked(cur => (cur?.key === cell.key ? null : cell))}
                    style={{
                      width: '100%',
                      aspectRatio: 1,
                      maxHeight: 17,
                      borderRadius: 4,
                      backgroundColor: cellColor(cell),
                      borderWidth: isSelected ? 1.5 : cell.future ? 0.5 : 0,
                      borderColor: isSelected ? c.text : c.divider,
                      opacity: cell.future ? 0.3 : 1,
                    }}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {/* 图例或选中提示 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        {picked ? (
          <Text style={{ fontSize: fs(11.5), color: c.textSub }}>
            {fmtMonthDay(picked.date)}：{picked.count ? `${picked.count} 篇 · ${picked.words} 字${picked.mood ? ` · ${moodMeta(picked.mood)?.label}` : ''}` : '未记录'}
          </Text>
        ) : (
          <Text style={{ fontSize: fs(11), color: c.textMuted }}>
            {mode === 'heat' ? '点击方块查看当日字数' : '点击方块查看当日心情'}
          </Text>
        )}

        {mode === 'heat' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text style={{ fontSize: 10, color: c.textMuted, marginRight: 2 }}>少</Text>
            {([0, 1, 2, 3, 4] as const).map(lvl => (
              <View key={lvl} style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: heatColor(lvl) }} />
            ))}
            <Text style={{ fontSize: 10, color: c.textMuted, marginLeft: 2 }}>多</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {MOODS.slice(0, 5).map(m => (
              <View key={m.key} style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: m.color }} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

/* ============ 6. 标签 × 情绪关联洞察（参考 Daylio 活动相关性） ============ */

export function TagMoodChart({
  items,
  tags,
  onSelectTag,
}: {
  items: TagMoodCorrelation[];
  tags: Tag[];
  onSelectTag?: (tagId: string) => void;
}) {
  const { c, fs } = useTheme();
  if (items.length === 0) {
    return <Text style={{ fontSize: fs(13), color: c.textMuted }}>同时添加标签和心情后，将自动发现影响情绪的习惯线索</Text>;
  }
  return (
    <View style={{ gap: 12 }}>
      {items.slice(0, 5).map(it => {
        const tag = tags.find(x => x.id === it.tagId);
        const pct = Math.round((it.avgScore / 5) * 100);
        const dom = moodMeta(it.dominantMood);
        return (
          <Pressable key={it.tagId} onPress={() => onSelectTag?.(it.tagId)} style={{ gap: 5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                <MoodIcon mood={it.dominantMood} size={20} />
                <Text numberOfLines={1} style={{ fontSize: fs(13), color: c.text, fontWeight: '500', flexShrink: 1 }}>#{tag?.name ?? it.tagId}</Text>
                <Text style={{ fontSize: fs(11), color: c.textMuted, flexShrink: 0 }}>{it.count}次</Text>
              </View>
              <Text numberOfLines={1} style={{ fontSize: fs(11.5), color: c.primaryDark, flexShrink: 0 }}>
                {it.avgScore}/5 · 正向 {it.positivePercent}%
              </Text>
            </View>
            <View style={{ height: 7, borderRadius: 4, backgroundColor: c.bgDeep, overflow: 'hidden' }}>
              <View style={{ width: `${Math.max(12, pct)}%`, height: '100%', backgroundColor: dom?.color ?? c.primary, borderRadius: 4 }} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ============ 7. 写作时段偏好图 ============ */

export function TimeOfDayChart({ slots }: { slots: TimeSlotStat[] }) {
  const { c, fs, r } = useTheme();
  const max = Math.max(1, ...slots.map(s => s.count));
  const peak = Math.max(...slots.map(s => s.count));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 118, paddingTop: 14 }}>
      {slots.map(slot => {
        const isPeak = peak > 0 && slot.count === peak;
        const barH = Math.max(6, Math.round((slot.count / max) * 60));
        return (
          <View key={slot.key} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: fs(10.5), color: isPeak ? c.primaryDark : c.textMuted, fontWeight: isPeak ? '600' : '400', marginBottom: 4 }}>
              {slot.count}
            </Text>
            <View
              style={{
                width: 24,
                height: barH,
                borderRadius: r(8),
                backgroundColor: isPeak ? c.primary : slot.count ? c.primarySoft : c.divider,
              }}
            />
            <Text style={{ fontSize: fs(11.5), color: isPeak ? c.text : c.textSub, fontWeight: isPeak ? '600' : '400', marginTop: 6 }}>
              {slot.label}
            </Text>
            <Text style={{ fontSize: 9.5, color: c.textMuted }}>{slot.range}</Text>
          </View>
        );
      })}
    </View>
  );
}

/* ============ 8. 篇幅结构分布条 ============ */

export function LengthDistributionBar({ buckets }: { buckets: LengthBucket[] }) {
  const { c, fs } = useTheme();
  const palette = [c.primarySoft, c.primary, c.primaryDark];
  const total = buckets.reduce((a, b) => a + b.count, 0);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ height: 12, borderRadius: 6, backgroundColor: c.bgDeep, flexDirection: 'row', overflow: 'hidden', gap: 2 }}>
        {total === 0 ? (
          <View style={{ flex: 1, backgroundColor: c.divider }} />
        ) : (
          buckets.map((b, i) =>
            b.count > 0 ? (
              <View key={b.label} style={{ flex: b.count, backgroundColor: palette[i % palette.length] }} />
            ) : null,
          )
        )}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
        {buckets.map((b, i) => (
          <View key={b.label} style={{ flex: 1, minWidth: 0, alignItems: i === 0 ? 'flex-start' : i === 2 ? 'flex-end' : 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette[i % palette.length] }} />
              <Text numberOfLines={1} style={{ fontSize: fs(12), color: c.text }}>{b.label}</Text>
            </View>
            <Text numberOfLines={1} style={{ fontSize: fs(10.5), color: c.textMuted, marginTop: 2 }}>
              {b.desc}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: fs(10.5), color: c.textSub, marginTop: 1 }}>
              {b.count}篇 · {b.percent}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ============ 9. 流式高频词云 ============ */

export function WordCloud({
  items,
  onPressWord,
}: {
  items: KeywordCount[];
  onPressWord?: (word: string) => void;
}) {
  const { c, fs } = useTheme();
  if (!items.length) {
    return (
      <Text style={{ fontSize: fs(13), color: c.textMuted, textAlign: 'center', paddingVertical: 14 }}>
        多记录几篇日记后，这里会自动浮现你的高频心声词云
      </Text>
    );
  }

  const max = items[0].count;
  const min = items[items.length - 1].count;
  const span = Math.max(1, max - min);

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
      {items.map((it, idx) => {
        const ratio = (it.count - min) / span;
        const tier = ratio >= 0.72 ? 3 : ratio >= 0.42 ? 2 : ratio >= 0.18 ? 1 : 0;
        const size = tier === 3 ? fs(18) : tier === 2 ? fs(15.5) : tier === 1 ? fs(13.5) : fs(12);
        const color =
          tier === 3
            ? c.primaryDark
            : tier === 2
              ? c.primary
              : tier === 1
                ? c.text
                : c.textSub;
        const bg =
          tier === 3
            ? c.primaryFaint
            : tier === 2
              ? c.cardAlt
              : 'transparent';
        return (
          <Pressable
            key={`${it.word}_${idx}`}
            onPress={() => onPressWord?.(it.word)}
            style={({ pressed }) => ({
              paddingHorizontal: tier >= 2 ? 10 : 6,
              paddingVertical: tier >= 2 ? 5 : 3,
              borderRadius: 999,
              backgroundColor: bg,
              opacity: pressed ? 0.65 : tier === 0 ? 0.8 : 1,
            })}
          >
            <Text style={{ fontSize: size, color, fontWeight: tier >= 2 ? '600' : '400' }}>
              {it.word}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
