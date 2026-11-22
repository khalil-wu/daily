import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '../../src/components/text';
import { router } from 'expo-router';
import { Check, ChevronRight, Flame, MapPin, Search, Sparkles } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useStore } from '../../src/store/store';
import { Card, IconButton, Screen, Segmented } from '../../src/components/ui';
import { useCountUp } from '../../src/components/motion';
import { MoodIcon, WeatherIcon } from '../../src/components/MoodIcon';
import {
  ActivityHeatmap,
  LengthDistributionBar,
  MonthlyBarChart,
  MoodDonutChart,
  MoodTrendChart,
  TagMoodChart,
  TimeOfDayChart,
  WordCloud,
} from '../../src/components/Charts';
import { moodMeta } from '../../src/data/constants';
import { computeStats } from '../../src/utils/stats';
import { extractKeywords } from '../../src/utils/keywords';
import { fmtNumber } from '../../src/utils/text';

type StatsTab = 'overview' | 'mood' | 'writing';

/** 15. 统计页（概览 / 情绪 / 写作 - 对标 Daylio / Stoic / Day One 数据中台） */
export default function StatsScreen() {
  const { c, t, fs, r } = useTheme();
  const [chartWidth, setChartWidth] = useState(240);
  const entries = useStore(s => s.entries);
  const tags = useStore(s => s.tags);
  const [sub, setSub] = useState<StatsTab>('overview');
  const [range, setRange] = useState<7 | 30 | 0>(30);
  const [heatMode, setHeatMode] = useState<'heat' | 'mood'>('heat');

  const visibleEntries = useMemo(() => entries.filter(e => !e.hidden), [entries]);
  const stats = useMemo(() => computeStats(visibleEntries, sub === 'mood' ? range || undefined : 30), [visibleEntries, sub, range]);
  const topKeywords = useMemo(
    () =>
      sub === 'writing' ? extractKeywords(
        visibleEntries.filter(e => !e.deletedAt && e.status === 'published').map(e => `${e.title} ${e.body}`),
        20,
      ) : [],
    [visibleEntries, sub],
  );
  const currentYear = new Date().getFullYear();
  const weekLabels = ['一', '二', '三', '四', '五', '六', '日'];
  const domMood = moodMeta(stats.dominantMood);
  const topTagMood = stats.tagMoods[0];
  const topTagName = topTagMood ? tags.find(x => x.id === topTagMood.tagId)?.name : undefined;

  return (
    <Screen edges={['top']}>
      <View style={{ height: 52, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[t.h1, { fontSize: fs(22) }]}>统计</Text>
        <IconButton icon={Search} label="搜索" onPress={() => router.push('/search')} />
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <Segmented
          value={sub}
          onChange={setSub}
          items={[
            { key: 'overview', label: '概览' },
            { key: 'mood', label: '情绪' },
            { key: 'writing', label: '写作' },
          ]}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}>
        <View style={{ gap: 14 }}>
        {sub === 'overview' && (
          <>
            {/* 年度回顾入口卡 */}
            <Card
              onPress={() => router.push('/annual-report')}
              style={{ backgroundColor: c.primaryFaint, borderColor: c.primarySoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={18} color={c.primaryDark} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[t.h3, { fontSize: fs(14.5), color: c.primaryDark }]} numberOfLines={1}>
                    {currentYear} 年度回顾报告
                  </Text>
                  <Text style={{ fontSize: fs(11.5), color: c.textSub, marginTop: 2 }} numberOfLines={1}>
                    情绪像素、年度词云与高光时刻
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 8 }}>
                <Text style={{ fontSize: fs(12.5), color: c.primaryDark, fontWeight: '600' }}>查看</Text>
                <ChevronRight size={15} color={c.primaryDark} />
              </View>
            </Card>

            {/* 写作坚持卡片 */}
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ fontSize: fs(13), color: c.textSub }}>写作坚持</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
                    <Text style={{ fontSize: fs(14), color: c.text }}>连续记录</Text>
                    <Text style={{ fontSize: fs(26), color: c.text, fontWeight: '600', fontVariant: ['tabular-nums'] }}><CountText to={stats.currentStreak} /></Text>
                    <Text style={{ fontSize: fs(14), color: c.text }}>天</Text>
                  </View>
                  <Text style={{ fontSize: fs(12), color: c.textMuted, marginTop: 4 }}>最长连续 {stats.longestStreak} 天</Text>
                </View>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.primaryFaint, alignItems: 'center', justifyContent: 'center' }}>
                  <Flame size={28} color={c.primary} fill={c.primarySoft} />
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: c.divider }}>
                {weekLabels.map((lbl, idx) => {
                  const on = stats.weekChecked[idx];
                  return (
                    <View key={lbl} style={{ alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: fs(11), color: c.textMuted }}>{lbl}</Text>
                      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: on ? c.primary : c.bgDeep, alignItems: 'center', justifyContent: 'center' }}>
                        {on && <Check size={12} color={c.textOnPrimary} strokeWidth={2.8} />}
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>

            {/* 近 12 周像素热力矩阵（写作热度 / 心情像素切换） */}
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <Text style={[t.h3, { fontSize: fs(15) }]}>近 12 周记录像素</Text>
                <View style={{ flexDirection: 'row', backgroundColor: c.bgDeep, borderRadius: r(999), padding: 2 }}>
                  {[
                    { k: 'heat' as const, label: '热度' },
                    { k: 'mood' as const, label: '心情' },
                  ].map(item => {
                    const on = heatMode === item.k;
                    return (
                      <Pressable
                        key={item.k}
                        onPress={() => setHeatMode(item.k)}
                        style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: r(999), backgroundColor: on ? c.card : 'transparent' }}
                      >
                        <Text style={{ fontSize: fs(11.5), color: on ? c.primaryDark : c.textMuted, fontWeight: on ? '600' : '400' }}>{item.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <ActivityHeatmap cells={stats.heatmap84} mode={heatMode} />
            </Card>

            {/* 心情分布 (近30天) */}
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <Text style={[t.h3, { fontSize: fs(15) }]}>心情分布（近30天）</Text>
                {stats.moodTotal > 0 && (
                  <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: r(999), backgroundColor: c.primaryFaint }}>
                    <Text style={{ fontSize: fs(11.5), color: c.primaryDark }}>能量指数 {stats.moodScore}</Text>
                  </View>
                )}
              </View>
              <MoodDonutChart stats={stats.moodStats} />
            </Card>

            {/* 情绪趋势 (近30天) */}
            <Card>
              <Text style={[t.h3, { fontSize: fs(15), marginBottom: 12 }]}>情绪趋势（近30天）</Text>
              <View onLayout={event => setChartWidth(Math.max(1, event.nativeEvent.layout.width))}>
                <MoodTrendChart points={stats.trend30} width={chartWidth} />
              </View>
            </Card>
          </>
        )}

        {sub === 'mood' && (
          <>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { key: 7 as const, label: '近7天' },
                { key: 30 as const, label: '近30天' },
                { key: 0 as const, label: '全部' },
              ].map(opt => {
                const on = range === opt.key;
                return (
                  <Pressable
                    key={opt.label}
                    onPress={() => setRange(opt.key)}
                    style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: r(999), backgroundColor: on ? c.primary : c.card, borderWidth: 0.5, borderColor: on ? c.primary : c.divider }}
                  >
                    <Text style={{ fontSize: fs(13), color: on ? c.textOnPrimary : c.textSub }}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 情绪能量三格概览 */}
            <Card style={{ flexDirection: 'row', paddingVertical: 14 }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: fs(21), color: c.primaryDark, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{stats.moodScore}</Text>
                <Text style={{ fontSize: fs(11.5), color: c.textSub, marginTop: 3 }}>情绪指数</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center', borderLeftWidth: 0.5, borderLeftColor: c.divider }}>
                <Text style={{ fontSize: fs(21), color: c.text, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{stats.positiveRate}%</Text>
                <Text style={{ fontSize: fs(11.5), color: c.textSub, marginTop: 3 }}>正向占比</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center', borderLeftWidth: 0.5, borderLeftColor: c.divider }}>
                {domMood ? <MoodIcon mood={domMood.key} size={24} /> : <Text style={{ fontSize: fs(18), color: c.textMuted }}>—</Text>}
                <Text style={{ fontSize: fs(11.5), color: c.textSub, marginTop: 3 }}>{domMood ? `常感${domMood.label}` : '暂无主导'}</Text>
              </View>
            </Card>

            <Card>
              <Text style={[t.h3, { fontSize: fs(15), marginBottom: 14 }]}>心情比例</Text>
              <MoodDonutChart stats={stats.moodStats} />
            </Card>

            {/* 标签 × 情绪关联洞察（参考 Daylio） */}
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={[t.h3, { fontSize: fs(15) }]}>标签与情绪关联</Text>
                <Sparkles size={15} color={c.primaryDark} />
              </View>
              {topTagMood && topTagName && (
                <Text style={{ fontSize: fs(12.5), color: c.primaryDark, marginBottom: 12 }}>
                  当记录「#{topTagName}」时，正向情绪占比达 {topTagMood.positivePercent}%
                </Text>
              )}
              <TagMoodChart
                items={stats.tagMoods}
                tags={tags}
                onSelectTag={tagId => router.push({ pathname: '/search', params: { tag: tagId } })}
              />
            </Card>

            {/* 天气与心情关系 */}
            {stats.weatherMoods.length > 0 && (
              <Card>
                <Text style={[t.h3, { fontSize: fs(15), marginBottom: 12 }]}>天气与心情关系</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
                  {stats.weatherMoods.slice(0, 4).map(wm => (
                    <View key={wm.weather} style={{ width: '48.2%', backgroundColor: c.bgDeep, borderRadius: r(12), padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <WeatherIcon weather={wm.weather} size={20} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontSize: fs(12.5), color: c.text, fontWeight: '500' }}>{wm.label} · {wm.count}次</Text>
                        <Text numberOfLines={1} style={{ fontSize: fs(11), color: c.textSub, marginTop: 2 }}>平均愉悦 {wm.avgScore}/5</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </Card>
            )}

            <Card>
              <Text style={[t.h3, { fontSize: fs(15), marginBottom: 14 }]}>情绪明细（点击可筛选对应日记）</Text>
              {stats.moodStats.length === 0 ? (
                <Text style={{ fontSize: fs(13), color: c.textMuted }}>该时间段暂无记录心情的日记</Text>
              ) : (
                <View style={{ gap: 14 }}>
                  {stats.moodStats.map(ms => (
                    <Pressable key={ms.key} onPress={() => router.push({ pathname: '/search', params: { mood: ms.key } })} style={{ gap: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <MoodIcon mood={ms.key} size={22} />
                          <Text style={{ fontSize: fs(14), color: c.text }}>{ms.label}</Text>
                        </View>
                        <Text style={{ fontSize: fs(13), color: c.textSub }}>{ms.count} 篇 · {ms.percent}%</Text>
                      </View>
                      <View style={{ height: 8, borderRadius: 4, backgroundColor: c.bgDeep, overflow: 'hidden' }}>
                        <View style={{ width: `${ms.percent}%`, height: '100%', backgroundColor: ms.color, borderRadius: 4 }} />
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </Card>
          </>
        )}

        {sub === 'writing' && (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
              {[
                { label: '日记总篇数', num: stats.totalEntries, unit: '篇' },
                { label: '累计记录字数', num: stats.totalWords, unit: '字' },
                { label: '平均每篇字数', num: stats.avgWords, unit: '字' },
                { label: '照片与语音', val: `${stats.totalPhotos} / ${stats.totalAudios}`, unit: '条' },
              ].map(box => (
                <Card key={box.label} style={{ width: '48.2%' }}>
                  <Text numberOfLines={1} style={{ fontSize: fs(12), color: c.textSub }}>{box.label}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 8 }}>
                    <Text numberOfLines={1} style={{ fontSize: fs(21), color: c.text, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                      {box.num !== undefined ? <CountText to={box.num} /> : box.val}
                    </Text>
                    <Text style={{ fontSize: fs(12), color: c.textMuted }}>{box.unit}</Text>
                  </View>
                </Card>
              ))}
            </View>

            {/* 写作时段偏好 & 作者画像 */}
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={[t.h3, { fontSize: fs(15) }]}>写作时段偏好</Text>
                <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: r(999), backgroundColor: c.primaryFaint }}>
                  <Text style={{ fontSize: fs(11.5), color: c.primaryDark }}>{stats.writerPersona.title}</Text>
                </View>
              </View>
              <Text style={{ fontSize: fs(12), color: c.textSub, marginBottom: 6 }}>{stats.writerPersona.desc}</Text>
              <TimeOfDayChart slots={stats.timeSlots} />
            </Card>

            {/* 篇幅结构分布 */}
            <Card>
              <Text style={[t.h3, { fontSize: fs(15), marginBottom: 14 }]}>篇幅长度结构</Text>
              <LengthDistributionBar buckets={stats.lengthBuckets} />
            </Card>

            <Card>
              <Text style={[t.h3, { fontSize: fs(15), marginBottom: 4 }]}>近 6 个月写作趋势</Text>
              <MonthlyBarChart data={stats.monthlyCounts} />
            </Card>

            {/* 高频词云 */}
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={[t.h3, { fontSize: fs(15) }]}>高频词云</Text>
                <Text style={{ fontSize: fs(11), color: c.textMuted }}>点击词语搜索</Text>
              </View>
              <WordCloud
                items={topKeywords}
                onPressWord={word => router.push({ pathname: '/search', params: { q: word } })}
              />
            </Card>

            {/* 足迹与常去地点 */}
            {stats.placeCounts.length > 0 && (
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={[t.h3, { fontSize: fs(15) }]}>记录足迹</Text>
                  <Text style={{ fontSize: fs(12), color: c.textMuted }}>共 {stats.placeCounts.length} 处</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {stats.placeCounts.slice(0, 6).map(pl => (
                    <Pressable
                      key={pl.name}
                      onPress={() => router.push({ pathname: '/search', params: { q: pl.name.split('·')[0].trim() } })}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: r(999), backgroundColor: c.bgDeep }}
                    >
                      <MapPin size={12} color={c.primaryDark} />
                      <Text style={{ fontSize: fs(12.5), color: c.text }}>{pl.name}</Text>
                      <Text style={{ fontSize: fs(11), color: c.textMuted }}>{pl.count}</Text>
                    </Pressable>
                  ))}
                </View>
              </Card>
            )}

            <Card>
              <Text style={[t.h3, { fontSize: fs(15), marginBottom: 14 }]}>标签使用分布</Text>
              {stats.tagCounts.length === 0 ? (
                <Text style={{ fontSize: fs(13), color: c.textMuted }}>还没有使用标签，写日记时可以添加标签分类</Text>
              ) : (
                <View style={{ gap: 12 }}>
                  {stats.tagCounts.slice(0, 6).map(tc => {
                    const tag = tags.find(x => x.id === tc.id);
                    const pct = Math.round((tc.count / Math.max(1, stats.totalEntries)) * 100);
                    return (
                      <Pressable key={tc.id} onPress={() => router.push({ pathname: '/search', params: { tag: tc.id } })} style={{ gap: 5 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: fs(13.5), color: c.text }}>#{tag?.name ?? tc.id}</Text>
                          <Text style={{ fontSize: fs(12.5), color: c.textSub }}>{tc.count} 篇</Text>
                        </View>
                        <View style={{ height: 7, borderRadius: 4, backgroundColor: c.bgDeep }}>
                          <View style={{ width: `${Math.max(8, pct)}%`, height: '100%', backgroundColor: c.primary, borderRadius: 4 }} />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </Card>
          </>
        )}
        </View>
      </ScrollView>
    </Screen>
  );
}

/** 统计大数字：挂载/数值变化时滚动到位（减弱动态时直接显示） */
function CountText({ to }: { to: number }) {
  const v = useCountUp(to);
  return <>{fmtNumber(v)}</>;
}
