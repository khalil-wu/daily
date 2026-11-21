import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Check, ChevronDown, ChevronRight, ChevronUp, Flame, RefreshCw, Sparkles } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useStore } from '../store/store';
import { DAILY_PROMPTS, MOODS } from '../data/constants';
import { fmtMonthDay, greetingFor, WEEK_CN } from '../utils/date';
import { computeDailyGoalProgress, computeTodaySummary } from '../utils/grouping';
import { fmtNumber } from '../utils/text';
import { Chip, haptic } from './ui';
import { MoodIcon } from './MoodIcon';
import { FadeIn, PressableScale } from './motion';
import { useTourTarget } from './tour';

/**
 * 首页「今日」卡片 —— 把原来分开的「今日灵感」和「写作目标」合成一张，
 * 并补上问候、连续天数和「点一个心情就开始写」的入口。
 * 今天写过之后自动收起为一行进度，把屏幕让给日记列表。
 *
 * 视觉来源：卡片 / 进度条沿用原首页两张卡片的样式，心情胶囊即筛选面板里的 Chip + MoodIcon。
 */
export function TodayCard() {
  const { c, t, fs, dark, look, r } = useTheme();
  const entries = useStore(s => s.entries);
  const goals = useStore(s => s.goals);
  const name = useStore(s => s.profile.name);
  const targetRef = useTourTarget('home.today');

  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
    }, []),
  );

  const summary = useMemo(() => computeTodaySummary(entries, now), [entries, now]);
  const goal = useMemo(
    () => (goals.enabled ? computeDailyGoalProgress(entries, goals.dailyWords, now) : null),
    [entries, goals.enabled, goals.dailyWords, now],
  );

  const [manual, setManual] = useState<boolean | null>(null);
  const expanded = manual ?? !summary.wroteToday;
  const [promptIdx, setPromptIdx] = useState(() => new Date().getDate() % DAILY_PROMPTS.length);
  const prompt = DAILY_PROMPTS[promptIdx] ?? DAILY_PROMPTS[0];

  const d = new Date(now);
  const dateText = `${fmtMonthDay(now)} ${WEEK_CN[d.getDay()]}`;
  // 字数已经在下方的目标进度里，这里只说「写没写」，保证一行放得下
  const statusText = summary.wroteToday
    ? `已记录 ${summary.count} 篇`
    : summary.words > 0
      ? `草稿 ${fmtNumber(summary.words)} 字，还没发布`
      : '今天还没有记录';

  return (
    <View
      ref={targetRef}
      collapsable={false}
      style={{
        backgroundColor: c.card,
        borderRadius: r(16),
        padding: 14,
        marginBottom: 14,
        borderWidth: look.flat ? 1 : dark ? 0 : StyleSheet.hairlineWidth,
        borderColor: look.flat ? c.border : c.divider,
        shadowColor: c.shadow,
        shadowOpacity: dark || look.flat ? 0 : 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
        elevation: dark || look.flat ? 0 : 1,
      }}
    >
      {/* 问候 + 今日状态 + 连续天数 */}
      <Pressable
        onPress={() => {
          haptic('light');
          setManual(!expanded);
        }}
        accessibilityLabel={expanded ? '收起今日卡片' : '展开今日卡片'}
        style={{ flexDirection: 'row', alignItems: 'center' }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[t.h3, { fontSize: fs(16) }]}>
            {greetingFor(d.getHours())}，{name}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: fs(12), color: c.textSub, marginTop: 4 }}>
            {dateText} · {statusText}
          </Text>
        </View>
        {summary.streak > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: c.primaryFaint, marginLeft: 8 }}>
            <Flame size={12} color={c.primaryDark} strokeWidth={1.9} />
            <Text style={{ fontSize: fs(11), color: c.primaryDark, fontWeight: '600', fontVariant: ['tabular-nums'] }}>连续 {summary.streak} 天</Text>
          </View>
        )}
        <View style={{ marginLeft: 6 }}>
          {expanded ? <ChevronUp size={16} color={c.textMuted} /> : <ChevronDown size={16} color={c.textMuted} />}
        </View>
      </Pressable>

      {expanded && (
        <FadeIn dy={6} duration={220}>
          {/* 点一个心情，直接开始写 */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, marginTop: 12, marginHorizontal: -14 }}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 14 }}
          >
            {MOODS.map(m => (
              <Chip
                key={m.key}
                label={m.label}
                icon={<MoodIcon mood={m.key} size={15} />}
                onPress={() => {
                  haptic('light');
                  router.push({ pathname: '/write', params: { mood: m.key } });
                }}
              />
            ))}
          </ScrollView>

          {/* 今日灵感 */}
          <PressableScale
            scaleTo={0.985}
            onPress={() => router.push({ pathname: '/write', params: { prompt: prompt.id } })}
            accessibilityLabel={`用今日灵感写一篇：${prompt.title}`}
            style={{ marginTop: 10, backgroundColor: dark ? c.cardAlt : c.primaryFaint, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Sparkles size={12} color={c.primaryDark} />
                <Text style={{ fontSize: fs(11.5), color: c.primaryDark, fontWeight: '600' }}>今日灵感 · {prompt.category}</Text>
              </View>
              <Pressable
                hitSlop={10}
                onPress={() => {
                  haptic('light');
                  setPromptIdx(i => (i + 1) % DAILY_PROMPTS.length);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
              >
                <RefreshCw size={11} color={c.textSub} />
                <Text style={{ fontSize: fs(11.5), color: c.textSub }}>换一题</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 }}>
              <Text numberOfLines={2} style={[t.h3, { fontSize: fs(14), flex: 1, lineHeight: fs(14) * 1.5 }]}>{prompt.title}</Text>
              <ChevronRight size={16} color={c.primaryDark} />
            </View>
          </PressableScale>
        </FadeIn>
      )}

      {/* 今日写作目标 */}
      {goal && (
        <Pressable
          onPress={() => router.push('/settings/goals')}
          hitSlop={6}
          accessibilityLabel="写作目标设置"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}
        >
          <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: c.bgDeep, overflow: 'hidden' }}>
            <View style={{ width: `${goal.percent}%`, height: '100%', borderRadius: 3, backgroundColor: goal.achieved ? c.success : c.primary }} />
          </View>
          {goal.achieved ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Check size={11} color={c.success} strokeWidth={3} />
              <Text style={{ fontSize: fs(11), color: c.success, fontWeight: '600' }}>目标达成</Text>
            </View>
          ) : (
            <Text style={{ fontSize: fs(11), color: c.textMuted, fontVariant: ['tabular-nums'] }}>
              {goal.written} / {goal.target} 字
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}
