import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/theme/ThemeProvider';
import { Button, Screen } from '../src/components/ui';
import { MoodIcon } from '../src/components/MoodIcon';
import { ND, PressableScale, SPRING } from '../src/components/motion';
import { IMAGES } from '../src/data/assets';
import type { MoodKey } from '../src/store/types';

const PAGES = [
  {
    key: 'daily',
    title: '记录日常生活',
    desc: '把生活里的小事、想法和感受\n都写下来，留住真实的日常。',
    image: IMAGES.onboardNotebook,
    cta: '下一步',
  },
  {
    key: 'mood',
    title: '记录心情与思考',
    desc: '不仅记录发生了什么，\n也记得当下的情绪、感受与思考，\n更好地理解自己。',
    image: IMAGES.onboardClouds,
    cta: '下一步',
  },
  {
    key: 'review',
    title: '回看记忆与成长',
    desc: '随时回翻过去的日记，\n看见情绪的变化、生活的轨迹，\n和一点点成长。',
    image: IMAGES.onboardPolaroid,
    cta: '开始使用',
  },
] as const;

const PREVIEW_MOODS: MoodKey[] = ['happy', 'calm', 'tired', 'down', 'anxious'];

/** 页码指示点：当前页的点平滑拉长 */
function Dot({ on, color, onPress }: { on: boolean; color: string; onPress: () => void }) {
  const w = useRef(new Animated.Value(on ? 18 : 6)).current;
  useEffect(() => {
    Animated.spring(w, { toValue: on ? 18 : 6, useNativeDriver: false, ...SPRING.slide }).start();
  }, [on, w]);
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Animated.View style={{ width: w, height: 6, borderRadius: 3, backgroundColor: color }} />
    </Pressable>
  );
}

/** 2-4. 引导页 1-3（1:1 复刻设计稿1 #2-#4） */
export default function OnboardingScreen() {
  const { c, t, fs } = useTheme();
  const { width } = useWindowDimensions();
  const pageW = Math.min(width, 420);
  const scrollRef = useRef<ScrollView>(null);
  const [step, setStep] = useState(0);
  const [activeMood, setActiveMood] = useState<MoodKey>('happy');
  // 插画随翻页轻微位移与缩放，翻页不再是「整块平移」
  const scrollX = useRef(new Animated.Value(0)).current;
  const pageMotion = (idx: number) => {
    const inputRange = [(idx - 1) * pageW, idx * pageW, (idx + 1) * pageW];
    return {
      opacity: scrollX.interpolate({ inputRange, outputRange: [0.35, 1, 0.35], extrapolate: 'clamp' }),
      transform: [
        { translateX: scrollX.interpolate({ inputRange, outputRange: [pageW * 0.14, 0, -pageW * 0.14], extrapolate: 'clamp' }) },
        { scale: scrollX.interpolate({ inputRange, outputRange: [0.94, 1, 0.94], extrapolate: 'clamp' }) },
      ],
    };
  };

  const goChoose = () => router.push('/auth/choose');

  // 点按钮 / 点指示点翻页时，滚动途中不让滚动位置把页码改回去
  const pending = useRef<number | null>(null);
  const goPage = (i: number) => {
    pending.current = i;
    setStep(i);
    scrollRef.current?.scrollTo({ x: i * pageW, animated: true });
  };

  const next = () => {
    if (step < PAGES.length - 1) goPage(step + 1);
    else goChoose();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: 22, paddingTop: 10, alignItems: 'flex-end' }}>
        <Pressable hitSlop={12} onPress={goChoose}>
          <Text style={{ fontSize: fs(14), color: c.textSub }}>跳过</Text>
        </Pressable>
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: ND,
          // Web 端没有 momentum 事件，这里顺便同步当前页
          listener: (e: any) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, pageW));
            const clamped = Math.min(PAGES.length - 1, Math.max(0, idx));
            if (pending.current != null) {
              if (clamped === pending.current) pending.current = null;
              return;
            }
            setStep(prev => (prev === clamped ? prev : clamped));
          },
        })}
        onScrollBeginDrag={() => {
          pending.current = null;
        }}
        onMomentumScrollEnd={e => {
          pending.current = null;
          const idx = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, pageW));
          setStep(Math.min(PAGES.length - 1, Math.max(0, idx)));
        }}
        style={{ flex: 1 }}
      >
        {PAGES.map((p, idx) => (
          <View key={p.key} style={{ width: pageW, flex: 1, paddingHorizontal: 28, justifyContent: 'space-between', paddingTop: 18, paddingBottom: 16 }}>
            <View>
              <Text style={[t.h1, { fontSize: fs(26), letterSpacing: 1 }]}>{p.title}</Text>
              <Text style={[t.sub, { fontSize: fs(14.5), marginTop: 14, lineHeight: fs(14.5) * 1.75 }]}>{p.desc}</Text>
            </View>

            <Animated.View style={[{ flex: 1, justifyContent: 'center', alignItems: 'center', marginVertical: 14 }, pageMotion(idx)]}>
              {idx === 0 && (
                <View style={{ width: '100%', aspectRatio: 0.92, borderRadius: 24, overflow: 'hidden', shadowColor: c.shadow, shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 }}>
                  <Image source={p.image} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                </View>
              )}

              {idx === 1 && (
                <View style={{ width: '100%', alignItems: 'center' }}>
                  <View style={{ width: '100%', aspectRatio: 1.32, borderRadius: 24, overflow: 'hidden', shadowColor: c.shadow, shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 }}>
                    <Image source={p.image} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '94%', marginTop: 22 }}>
                    {PREVIEW_MOODS.map(m => {
                      const on = activeMood === m;
                      return (
                        <PressableScale
                          key={m}
                          scaleTo={0.86}
                          onPress={() => setActiveMood(m)}
                          style={{
                            padding: 4,
                            borderRadius: 24,
                            backgroundColor: on ? c.card : 'transparent',
                            borderWidth: 1.5,
                            borderColor: on ? c.primarySoft : 'transparent',
                            transform: [{ scale: on ? 1.12 : 1 }],
                          }}
                        >
                          <MoodIcon mood={m} size={34} />
                        </PressableScale>
                      );
                    })}
                  </View>
                </View>
              )}

              {idx === 2 && (
                <View style={{ width: '100%', aspectRatio: 0.96, borderRadius: 24, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider }}>
                  <Image source={p.image} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                </View>
              )}
            </Animated.View>
          </View>
        ))}
      </Animated.ScrollView>

      <View style={{ paddingHorizontal: 28, paddingBottom: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
          {PAGES.map((p, i) => (
            <Dot
              key={p.key}
              on={i === step}
              color={i === step ? c.primary : c.primarySoft}
              onPress={() => goPage(i)}
            />
          ))}
        </View>

        <Button
          title={PAGES[step].cta}
          onPress={next}
          // 前两页的按钮略浅（设计稿），用主题色加透明度实现，换强调色时也协调
          style={step < PAGES.length - 1 ? { opacity: 0.78 } : undefined}
        />
      </View>
    </Screen>
  );
}
