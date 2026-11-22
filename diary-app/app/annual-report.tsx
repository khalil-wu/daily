import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../src/components/text';
import { router, useLocalSearchParams } from 'expo-router';
import { Award, Calendar, ChevronLeft, ChevronRight, Flame, MapPin, Moon, Sparkles, Sunrise } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeProvider';
import { useStore } from '../src/store/store';
import { Card, EmptyState, NavBar, Screen, Segmented, haptic, webSpaceAction } from '../src/components/ui';
import { BottomSheet } from '../src/components/motion';
import { MoodIcon } from '../src/components/MoodIcon';
import { MonthlyBarChart, MoodDonutChart, WordCloud } from '../src/components/Charts';
import { MOODS, moodMeta } from '../src/data/constants';
import { computeAnnualReport, getAvailableYears, type YearPixel } from '../src/utils/annual';
import { dayKey, fmtFullDate, fmtTime } from '../src/utils/date';
import { excerpt, fmtNumber, wordCount } from '../src/utils/text';
import { IMAGES } from '../src/data/assets';

/** 年度时光报告（Year in Pixels + 月度分布 + 情绪环形图 + 词云 + 年度之最） */
export default function AnnualReportScreen() {
  const params = useLocalSearchParams<{ year?: string }>();
  const { c, t, fs, dark, r, look } = useTheme();
  const entries = useStore(s => s.entries);
  const tags = useStore(s => s.tags);

  const years = useMemo(() => {
    const avail = getAvailableYears(entries);
    return avail.length ? avail : [new Date().getFullYear()];
  }, [entries]);

  const initialIdx = useMemo(() => {
    const py = params.year ? Number(params.year) : NaN;
    if (Number.isFinite(py)) {
      const idx = years.indexOf(py);
      if (idx >= 0) return idx;
    }
    return 0;
  }, [params.year, years]);

  const [yearIdx, setYearIdx] = useState(initialIdx);
  const safeIdx = Math.min(yearIdx, years.length - 1);
  const activeYear = years[safeIdx] ?? new Date().getFullYear();

  const report = useMemo(() => computeAnnualReport(entries, activeYear), [entries, activeYear]);
  const [selectedPixel, setSelectedPixel] = useState<YearPixel | null>(null);
  const [calendarView, setCalendarView] = useState<'pixels' | 'days'>('pixels');
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);
  const recordedDays = useMemo(() => report.pixels.filter(pixel => pixel.month === calendarMonth && pixel.count > 0), [report.pixels, calendarMonth]);
  const selectedEntries = useMemo(() => selectedPixel ? entries.filter(entry => !entry.hidden && !entry.deletedAt && entry.status === 'published' && dayKey(entry.createdAt) === selectedPixel.dateKey).sort((a, b) => a.createdAt - b.createdAt) : [], [entries, selectedPixel]);

  const pixelLookup = useMemo(() => {
    const m = new Map<string, YearPixel>();
    for (const p of report.pixels) m.set(`${p.month}_${p.day}`, p);
    return m;
  }, [report.pixels]);

  const domMood = moodMeta(report.dominantMood);
  const dayRows = useMemo(() => Array.from({ length: 31 }, (_, i) => i + 1), []);
  const monthCols = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  const changeYear = (delta: number) => {
    haptic('light');
    setSelectedPixel(null);
    setYearIdx(idx => Math.min(years.length - 1, Math.max(0, idx + delta)));
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar title="年度回顾" />

      {/* 年份切换栏 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, paddingBottom: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="上一年" disabled={safeIdx >= years.length - 1} onPress={() => changeYear(1)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center', opacity: safeIdx >= years.length - 1 ? 0.35 : 1 }}>
            <ChevronLeft size={17} color={c.textSub} />
          </View>
        </Pressable>
        <Text style={[t.h2, { fontSize: fs(18), minWidth: 96, textAlign: 'center' }]}>{activeYear} 年</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="下一年" disabled={safeIdx <= 0} onPress={() => changeYear(-1)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center', opacity: safeIdx <= 0 ? 0.35 : 1 }}>
            <ChevronRight size={17} color={c.textSub} />
          </View>
        </Pressable>
      </View>

      {report.totalEntries === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 40 }}>
          <EmptyState
            image={IMAGES.emptyBook}
            imageSize={175}
            title={`${activeYear} 年还没有日记`}
            desc="切换其他年份看看，或现在就开始记录当下的生活。"
            action="写一篇日记"
            onAction={() => router.push('/write')}
          />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40, gap: 14 }}>
          {/* 1. 年度封面大数字摘要卡 */}
          <Card style={{ backgroundColor: dark ? c.cardAlt : c.primaryFaint, borderColor: c.primarySoft }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Sparkles size={15} color={c.primaryDark} />
                <Text style={[t.h3, { color: c.primaryDark, fontSize: fs(15) }]}>{activeYear} 时光年鉴</Text>
              </View>
              <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: r(999), backgroundColor: c.card }}>
                <Text style={{ fontSize: fs(11), color: c.primaryDark, fontWeight: '600' }}>{report.writerPersona.title}</Text>
              </View>
            </View>
            <Text style={{ fontSize: fs(12), color: c.textSub, marginBottom: 14 }}>{report.writerPersona.desc}</Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
              {[
                { label: '写下日记', val: String(report.totalEntries), unit: '篇' },
                { label: '累计文字', val: fmtNumber(report.totalWords), unit: '字' },
                { label: '记录天数', val: String(report.recordDays), unit: '天' },
                { label: '最长连续', val: String(report.longestStreak), unit: '天' },
              ].map(box => (
                <View
                  key={box.label}
                  style={{
                    width: '48.2%',
                    backgroundColor: c.card,
                    borderRadius: r(12),
                    padding: 12,
                    borderWidth: look.flat ? 1 : dark ? 0 : StyleSheet.hairlineWidth,
                    borderColor: look.flat ? c.border : c.divider,
                  }}
                >
                  <Text numberOfLines={1} style={{ fontSize: fs(11.5), color: c.textSub }}>{box.label}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 4 }}>
                    <Text numberOfLines={1} style={{ fontSize: fs(20), color: c.text, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{box.val}</Text>
                    <Text style={{ fontSize: fs(11.5), color: c.textMuted }}>{box.unit}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>

          {/* 2. Year in Pixels 情绪年历（12列 x 31行） */}
          <Card>
            <View style={{ marginBottom: 12, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Calendar size={15} color={c.primaryDark} />
                <Text style={[t.h3, { fontSize: fs(15) }]}>情绪年历 · Year in Pixels</Text>
              </View>
              <Text style={t.caption}>点选日期查看原文；日期列表提供更大的操作区域。</Text>
              <Segmented value={calendarView} onChange={setCalendarView} items={[{ key: 'pixels', label: '像素图' }, { key: 'days', label: '日期列表' }]} />
            </View>

            {calendarView === 'pixels' ? <>
            {/* 月份列头 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
              <View style={{ width: 18 }} />
              {monthCols.map(m => (
                <View key={m} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: fs(12), color: c.textSub, fontVariant: ['tabular-nums'] }}>{m}</Text>
                </View>
              ))}
            </View>

            {/* 31 天像素矩阵 */}
            <View style={{ gap: 2.5 }}>
              {dayRows.map(day => (
                <View key={day} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 18 }}>
                    {(day === 1 || day === 10 || day === 20 || day === 30) && (
                      <Text style={{ fontSize: fs(11), color: c.textSub, fontVariant: ['tabular-nums'] }}>{day}</Text>
                    )}
                  </View>
                  {monthCols.map(m => {
                    const p = pixelLookup.get(`${m}_${day}`);
                    if (!p) return <View key={m} style={{ flex: 1, alignItems: 'center' }} />;
                    const mColor = p.mood ? moodMeta(p.mood)?.color : undefined;
                    const bg = p.count > 0 ? mColor ?? c.primary : c.bgDeep;
                    const isSel = selectedPixel?.dateKey === p.dateKey;
                    return (
                      <Pressable
                        key={m}
                        accessibilityRole="button"
                        accessibilityLabel={`${p.dateKey}，${p.count} 篇日记`}
                        onPress={() => {
                          haptic('light');
                          setSelectedPixel(p);
                        }}
                        style={{ flex: 1, alignItems: 'center' }}
                      >
                        <View
                          style={{
                            width: '78%',
                            maxWidth: 14,
                            aspectRatio: 1,
                            borderRadius: 2.5,
                            backgroundColor: bg,
                            opacity: p.count > 0 ? 1 : dark ? 0.45 : 0.85,
                            borderWidth: isSel ? 1.5 : 0,
                            borderColor: c.text,
                          }}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>

            </> : <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {monthCols.map(month => <Pressable key={month} accessibilityRole="radio" accessibilityLabel={`${month}月`} accessibilityState={{ checked: calendarMonth === month }} aria-checked={calendarMonth === month} {...webSpaceAction(() => setCalendarMonth(month))} onPress={() => setCalendarMonth(month)} style={{ minWidth: 48, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: r(10), backgroundColor: calendarMonth === month ? c.primaryFaint : c.cardAlt, borderWidth: 1, borderColor: calendarMonth === month ? c.primary : c.divider }}>
                  <Text style={{ fontSize: fs(13), color: calendarMonth === month ? c.primaryDark : c.text }}>{month}月</Text>
                </Pressable>)}
              </View>
              {!recordedDays.length && <Text style={[t.sub, { paddingVertical: 12 }]}>这个月没有已发布的日记，可以选择其他月份。</Text>}
              {recordedDays.map(pixel => <Pressable key={pixel.dateKey} accessibilityRole="button" accessibilityLabel={`查看 ${pixel.dateKey} 的 ${pixel.count} 篇日记`} onPress={() => setSelectedPixel(pixel)} style={{ minHeight: 52, paddingVertical: 12, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.divider }}>
                <Text style={t.body}>{pixel.dateKey}　{pixel.mood ? moodMeta(pixel.mood)?.label : '未记录心情'}</Text>
                <Text style={t.caption}>{pixel.count} 篇 · {pixel.words} 字　查看原文 ›</Text>
              </Pressable>)}
            </>}

            {/* 心情色标图例 */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 12 }}>
              {MOODS.map(m => (
                <View key={m.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: m.color }} />
                  <Text style={{ fontSize: fs(12), color: c.textSub }}>{m.label}</Text>
                </View>
              ))}
            </View>

          </Card>

          {/* 3. 月度记录分布 */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={[t.h3, { fontSize: fs(15) }]}>月度写作分布</Text>
              {report.busiestMonth && (
                <Text style={{ fontSize: fs(11.5), color: c.primaryDark }}>
                  {report.busiestMonth.month}月最勤快 ({report.busiestMonth.count}篇)
                </Text>
              )}
            </View>
            <MonthlyBarChart data={report.monthlyCounts} />
          </Card>

          {/* 4. 年度情绪环形图 */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={[t.h3, { fontSize: fs(15) }]}>年度情绪光谱</Text>
              {domMood && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 3, borderRadius: r(999), backgroundColor: c.primaryFaint }}>
                  <MoodIcon mood={domMood.key} size={13} />
                  <Text style={{ fontSize: fs(12), color: c.primaryDark }}>最常记录 · {domMood.label}</Text>
                </View>
              )}
            </View>
            <MoodDonutChart stats={report.moodStats} />
          </Card>

          {/* 5. 年度词云 */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={[t.h3, { fontSize: fs(15) }]}>年度高频词云</Text>
              <Text style={{ fontSize: fs(11), color: c.textMuted }}>点击词语搜索</Text>
            </View>
            <WordCloud
              items={report.keywords}
              onPressWord={word => router.push({ pathname: '/search', params: { q: word } })}
            />
          </Card>

          {/* 6. 高频标签 & 常去足迹 */}
          {(report.topTags.length > 0 || report.topPlaces.length > 0) && (
            <Card style={{ gap: 14 }}>
              {report.topTags.length > 0 && (
                <View>
                  <Text style={[t.h3, { fontSize: fs(14.5), marginBottom: 10 }]}>年度关心话题</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {report.topTags.map(tg => {
                      const meta = tags.find(x => x.id === tg.id);
                      return (
                        <Pressable
                          key={tg.id}
                          onPress={() => router.push({ pathname: '/search', params: { tag: tg.id } })}
                          style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: r(999), backgroundColor: c.primaryFaint }}
                        >
                          <Text style={{ fontSize: fs(12.5), color: c.primaryDark }}>#{meta?.name ?? tg.id} · {tg.count}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {report.topPlaces.length > 0 && (
                <View>
                  <Text style={[t.h3, { fontSize: fs(14.5), marginBottom: 10 }]}>常去记录地点</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {report.topPlaces.map(pl => (
                      <Pressable
                        key={pl.name}
                        onPress={() => router.push({ pathname: '/search', params: { q: pl.name.split('·')[0].trim() } })}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: r(999), backgroundColor: c.bgDeep }}
                      >
                        <MapPin size={12} color={c.primaryDark} />
                        <Text style={{ fontSize: fs(12), color: c.text }}>{pl.name}</Text>
                        <Text style={{ fontSize: fs(11), color: c.textMuted }}>{pl.count}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </Card>
          )}

          {/* 7. 年度之最 */}
          <Card style={{ gap: 12 }}>
            <Text style={[t.h3, { fontSize: fs(15) }]}>年度之最</Text>

            {[
              report.firstEntry && {
                badge: '年度第一篇',
                icon: Sunrise,
                entry: report.firstEntry,
                meta: fmtFullDate(report.firstEntry.createdAt),
              },
              report.longestEntry && {
                badge: '写得最认真',
                icon: Award,
                entry: report.longestEntry,
                meta: `${wordCount(report.longestEntry.title) + wordCount(report.longestEntry.body)} 字`,
              },
              report.latestNightEntry && {
                badge: '最晚的陪伴',
                icon: Moon,
                entry: report.latestNightEntry,
                meta: `${fmtFullDate(report.latestNightEntry.createdAt)} ${fmtTime(report.latestNightEntry.createdAt)}`,
              },
            ]
              .filter(Boolean)
              .map(item => {
                if (!item) return null;
                const Icon = item.icon;
                return (
                  <Pressable
                    key={item.badge}
                    onPress={() => router.push({ pathname: '/memory/[id]', params: { id: item.entry.id } })}
                    style={({ pressed }) => ({
                      backgroundColor: c.cardAlt,
                      borderRadius: r(12),
                      padding: 12,
                      borderWidth: look.flat ? 1 : StyleSheet.hairlineWidth,
                      borderColor: look.flat ? c.border : c.divider,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Icon size={13} color={c.primaryDark} />
                        <Text style={{ fontSize: fs(11.5), color: c.primaryDark, fontWeight: '600' }}>{item.badge}</Text>
                      </View>
                      <Text style={{ fontSize: fs(11), color: c.textMuted }}>{item.meta}</Text>
                    </View>
                    <Text numberOfLines={1} style={{ fontSize: fs(14), color: c.text, fontWeight: '500' }}>
                      {item.entry.title || '无题日记'}
                    </Text>
                  </Pressable>
                );
              })}
          </Card>

          {/* 8. 结尾寄语 */}
          <Card style={{ alignItems: 'center', paddingVertical: 20 }}>
            <Flame size={22} color={c.primary} />
            <Text style={[t.h3, { fontSize: fs(15.5), marginTop: 8, textAlign: 'center' }]}>
              感谢每一个真诚记录的瞬间
            </Text>
            <Text style={[t.sub, { textAlign: 'center', marginTop: 6 }]}>
              {activeYear} 年，你共定格了 {report.totalPhotos} 张影像，在 {report.recordDays} 个日子里与真实的自己相遇。
            </Text>
          </Card>
        </ScrollView>
      )}
      <BottomSheet visible={!!selectedPixel} onClose={() => setSelectedPixel(null)} title={selectedPixel ? `${selectedPixel.dateKey} 的日记` : '当日日记'}>
        <Text style={[t.sub, { marginBottom: 12 }]}>{selectedEntries.length ? `${selectedEntries.length} 篇 · 只展示未隐藏的已发布日记` : '这一天没有可查看的日记。'}</Text>
        <FlatList data={selectedEntries} keyExtractor={entry => entry.id} style={{ maxHeight: 360 }} initialNumToRender={6} maxToRenderPerBatch={6} windowSize={5} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`打开日记：${item.title || '无题日记'}`} onPress={() => { setSelectedPixel(null); router.push({ pathname: '/memory/[id]', params: { id: item.id } }); }} style={{ minHeight: 64, paddingVertical: 14, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.divider }}>
          <Text style={t.readingTitle}>{item.title || '无题日记'}</Text>
          <Text textRole="reading" numberOfLines={2} style={t.sub}>{excerpt(item.body, 70) || '多媒体日记'}</Text>
          <Text style={t.caption}>{fmtTime(item.createdAt)}</Text>
        </Pressable>} />
      </BottomSheet>
    </Screen>
  );
}
