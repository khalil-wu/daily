import React, { useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './text';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { ChevronRight, Heart, History } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useBookEntries } from '../store/store';
import { fmtMonthDay } from '../utils/date';
import { excerpt } from '../utils/text';
import { entryCover } from '../utils/video';
import { posterUri } from '../services/videoStore';
import { Photo, haptic } from './ui';
import { ND, useReducedMotion } from './motion';
import { MoodIcon } from './MoodIcon';
import type { Entry } from '../store/types';

/**
 * 首页「那年今日」横排回忆条 —— Day One「On This Day」式：
 * 只取往年同月同日的日记，按年份倒序；有封面用封面，没封面用纸面摘录卡。
 * 没有可回看的年份时整条不渲染，不占用首页空间。
 * 每封回忆先是一封信，拆开才露出卡片 —— 每日仪式，会话内记一次。
 */
export function OnThisDay() {
  const { c, t, fs } = useTheme();
  const entries = useBookEntries();
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
        <EnvelopeReveal entry={items[0]} now={now} radius={16}>
          <OnThisDaySingleCard entry={items[0]} now={now} />
        </EnvelopeReveal>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0, marginHorizontal: -20 }}
          contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}
        >
          {items.map(entry => (
            <EnvelopeReveal key={entry.id} entry={entry} now={now} radius={16}>
              <OnThisDayCard entry={entry} now={now} />
            </EnvelopeReveal>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/** 已拆开的信（按天 + 条目，仅本次会话，明天又是新的一封） */
const openedLetters = new Set<string>();

function EnvelopeReveal({ entry, now, radius, children }: { entry: Entry; now: number; radius: number; children: React.ReactNode }) {
  const { c, t, fs, r, ink, frame, frameInk } = useTheme();
  const reduced = useReducedMotion();
  const ed = new Date(entry.createdAt);
  const yearsAgo = new Date(now).getFullYear() - ed.getFullYear();
  const yearLabel = yearsAgo === 1 ? '去年' : `${yearsAgo} 年前`;
  const today = new Date(now);
  const key = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}:${entry.id}`;
  const [opened, setOpened] = useState(() => openedLetters.has(key));
  const flap = useRef(new Animated.Value(0)).current;
  const cardIn = useRef(new Animated.Value(0)).current;
  const envFade = useRef(new Animated.Value(1)).current;
  const [flapH, setFlapH] = useState(56);
  const [envH, setEnvH] = useState(0);
  // 矮卡用浅盖 + 小字，保证蜡封与文案不重叠
  const compact = envH > 0 && envH < 120;
  const flapRatio = compact ? 0.34 : 0.42;
  const sealBottom = flapRatio * envH + 13;

  const open = () => {
    if (opened) return;
    haptic('light');
    openedLetters.add(key);
    if (reduced) {
      setOpened(true);
      return;
    }
    Animated.parallel([
      Animated.timing(flap, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),
      Animated.sequence([Animated.delay(160), Animated.timing(cardIn, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: ND })]),
      Animated.sequence([Animated.delay(380), Animated.timing(envFade, { toValue: 0, duration: 140, useNativeDriver: ND })]),
    ]).start(({ finished }) => finished && setOpened(true));
  };

  const flapDeg = flap.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-180deg'] });
  const lineColor = ink.on ? ink.line : c.border;

  return (
    <View>
      {/* 信件底下的回忆卡：拆信时上浮淡入 */}
      <Animated.View
        style={{
          opacity: opened ? 1 : cardIn,
          transform: [{ translateY: opened ? 0 : cardIn.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        }}
      >
        {children}
      </Animated.View>

      {!opened && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: envFade }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`拆开${yearLabel}的信`}
            onPress={open}
            onLayout={e => setEnvH(e.nativeEvent.layout.height)}
            style={{ flex: 1, borderRadius: r(radius), backgroundColor: '#FFFDF8', overflow: 'hidden', ...(ink.on ? frameInk : frame) }}
          >
            {/* 信封下半 */}
            <Svg width="100%" height="100%" viewBox="0 0 100 60" preserveAspectRatio="none" style={StyleSheet.absoluteFill} pointerEvents="none">
              <Path d="M0 0 L50 34 L0 60 Z" fill="rgba(0,0,0,0.015)" />
              <Path d="M100 0 L50 34 L100 60 Z" fill="rgba(0,0,0,0.015)" />
              <Path d="M0 0 L50 34 L100 0" fill="none" stroke={lineColor} strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.35} />
            </Svg>
            {/* 顶盖三角（沿顶边翻开） */}
            <Animated.View
              onLayout={e => setFlapH(e.nativeEvent.layout.height)}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                height: `${flapRatio * 100}%`,
                backfaceVisibility: 'hidden',
                transform: [{ perspective: 900 }, { translateY: -flapH / 2 }, { rotateX: flapDeg }, { translateY: flapH / 2 }],
              }}
            >
              <Svg width="100%" height="100%" viewBox="0 0 100 55" preserveAspectRatio="none">
                <Path d="M0 0 L100 0 L50 55 Z" fill={c.primarySoft} stroke={lineColor} strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
              </Svg>
              {/* 蜡封 */}
              <Animated.View
                style={{
                  position: 'absolute',
                  bottom: -13,
                  alignSelf: 'center',
                  opacity: flap.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 0, 0] }),
                }}
              >
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.primary, borderWidth: 1.25, borderColor: lineColor, alignItems: 'center', justifyContent: 'center' }}>
                  <Heart size={11} color="#FFFDF8" fill="#FFFDF8" />
                </View>
              </Animated.View>
            </Animated.View>
            {/* 信封文案：蜡封下方剩余空间居中，永不与蜡封重叠 */}
            <View style={{ position: 'absolute', left: 10, right: 10, top: sealBottom + 10, bottom: 8, alignItems: 'center', justifyContent: 'center', gap: 3 }} pointerEvents="none">
              <Text numberOfLines={1} style={[t.h2, { fontSize: fs(compact ? 13 : 13.5), color: '#1F2528' }]}>一封来自{yearLabel}的信</Text>
              <Text style={{ fontSize: fs(10.5), color: '#545B60' }}>{fmtMonthDay(entry.createdAt)} · 轻点拆开</Text>
            </View>
          </Pressable>
        </Animated.View>
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
