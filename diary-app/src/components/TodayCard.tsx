import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, View } from 'react-native';
import { Text } from './text';
import { router, useFocusEffect } from 'expo-router';
import { Check, ChevronDown, ChevronUp, Flame } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useStore } from '../store/store';
import { MOODS, moodTint } from '../data/constants';
import { fmtMonthDay, greetingFor, WEEK_CN } from '../utils/date';
import { computeDailyGoalProgress, computeTodaySummary } from '../utils/grouping';
import { fmtNumber } from '../utils/text';
import { haptic } from './ui';
import { MoodIcon } from './MoodIcon';
import { FadeIn, ND, PressableScale, SPRING, useReducedMotion } from './motion';
import { IMAGES } from '../data/assets';
import { useTourTarget } from './tour';

/**
 * 首页「今日」卡片 —— 问候 + Diarly 式单排心情快开 + 目标进度。
 * 今天写过之后自动收起为一行进度，把屏幕让给日记列表。
 */
export function TodayCard() {
  const { c, t, fs, dark, frameInk, r, ink } = useTheme();
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

  const d = new Date(now);
  const dateText = `${fmtMonthDay(now)} ${WEEK_CN[d.getDay()]}`;
  const statusText = summary.wroteToday
    ? `已记录 ${summary.count} 篇`
    : summary.words > 0
      ? `草稿 ${fmtNumber(summary.words)} 字，还没发布`
      : '今天还没有记录';

  // 陪伴风：小鸟贴纸探出卡片上缘，挂载时轻轻一跳
  const reduced = useReducedMotion();
  const hop = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced || !ink.on) {
      hop.setValue(1);
      return;
    }
    const animation = Animated.spring(hop, { toValue: 1, useNativeDriver: ND, ...SPRING.pop });
    animation.start();
    return () => animation.stop();
  }, [hop, reduced, ink.on]);

  return (
    <View
      ref={targetRef}
      collapsable={false}
      style={{
        backgroundColor: c.card,
        borderRadius: r(18),
        padding: 16,
        marginTop: ink.on ? 30 : 0,
        marginBottom: 14,
        ...frameInk,
      }}
    >
      {ink.on && (
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -30,
            right: 14,
            opacity: hop,
            transform: [{ translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
          }}
        >
          <Image source={IMAGES.companionBird} style={{ width: 72, height: 68 }} resizeMode="contain" />
        </Animated.View>
      )}
      {/* 问候 + 今日状态 + 连续天数：问候可换两行，日期与连续天数整行排布，绝不截断 */}
      <Pressable
        onPress={() => {
          haptic('light');
          setManual(!expanded);
        }}
        accessibilityLabel={expanded ? '收起今日卡片' : '展开今日卡片'}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        aria-expanded={expanded}
      >
        <Text style={[t.h2, { fontSize: fs(17), lineHeight: fs(24), paddingRight: ink.on ? 76 : 0 }]}>
          {greetingFor(d.getHours())}，{name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
          <Text style={{ fontSize: fs(12), color: c.textSub }}>
            {dateText} · {statusText}
          </Text>
          {summary.streak > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: r(999), backgroundColor: c.primaryFaint, marginLeft: 8 }}>
              <Flame size={12} color={c.primaryDark} strokeWidth={1.9} />
              <Text style={{ fontSize: fs(11), color: c.primaryDark, fontWeight: '600', fontVariant: ['tabular-nums'] }}>连续 {summary.streak} 天</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <View style={{ marginLeft: 6 }}>
            {expanded ? <ChevronUp size={16} color={c.textMuted} /> : <ChevronDown size={16} color={c.textMuted} />}
          </View>
        </View>
      </Pressable>

      {expanded && (
        <FadeIn dy={6} duration={220}>
          {/* Diarly 式单排 6 表情均布条：点按即开写 */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, gap: 2 }}>
            {MOODS.map(m => (
              <PressableScale
                key={m.key}
                scaleTo={0.92}
                accessibilityLabel={`带着${m.label}的心情写日记`}
                onPress={() => {
                  haptic('light');
                  router.push({ pathname: '/write', params: { mood: m.key } });
                }}
                style={{ flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 5 }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: moodTint(m, dark), alignItems: 'center', justifyContent: 'center' }}>
                  <MoodIcon mood={m.key} size={24} />
                </View>
                <Text numberOfLines={1} style={{ fontSize: fs(11), color: c.textSub }}>{m.label}</Text>
              </PressableScale>
            ))}
          </View>

        </FadeIn>
      )}

      {/* 今日写作目标 */}
      {goal && (
        <Pressable
          onPress={() => router.push('/settings/goals')}
          accessibilityLabel="写作目标设置"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, marginTop: 2, marginBottom: -8 }}
        >
          <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: ink.on ? c.inputBg : c.bgDeep, borderWidth: ink.on ? 1 : 0, borderColor: ink.soft, overflow: 'hidden' }}>
            <View style={{ width: `${goal.percent}%`, height: '100%', borderRadius: 4, backgroundColor: c.primary }} />
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
