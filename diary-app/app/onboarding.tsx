import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../src/components/text';
import { router } from 'expo-router';
import { useIllustrations, useTheme } from '../src/theme/ThemeProvider';
import { Button, Screen } from '../src/components/ui';
import { MoodIcon } from '../src/components/MoodIcon';
import { Jelly, ND, PressableScale, SPRING, useReducedMotion } from '../src/components/motion';
import type { MoodKey } from '../src/store/types';

const PAGES = [
  {
    key: 'daily',
    title: '记录日常生活',
    desc: '把生活里的小事、想法和感受\n都写下来，留住真实的日常。',
    art: 'onboardWrite',
    cta: '下一步',
  },
  {
    key: 'mood',
    title: '记录心情与思考',
    desc: '不仅记录发生了什么，\n也记得当下的情绪、感受与思考，\n更好地理解自己。',
    art: 'memorySticker',
    cta: '下一步',
  },
  {
    key: 'review',
    title: '回看记忆与成长',
    desc: '随时回翻过去的日记，\n看见情绪的变化、生活的轨迹，\n和一点点成长。',
    art: 'onboardMemory',
    cta: '开始使用',
  },
] as const;

const PREVIEW_MOODS: MoodKey[] = ['happy', 'calm', 'tired', 'down', 'anxious'];

/** 每页插画的固定小倾角，像贴在手账上的明信片 */
const POSTCARD_ROT = [-1.5, 1.2, -0.8];

/** 明信片外框：陪伴风给粗墨线 + 硬影，翻到该页时带轻微倾角回正 + 上浮 */
function Postcard({ idx, step, children }: { idx: number; step: number; children: React.ReactNode }) {
  const { ink } = useTheme();
  const reduced = useReducedMotion();
  const rot = POSTCARD_ROT[idx % POSTCARD_ROT.length];
  const a = useRef(new Animated.Value(1)).current;
  const prevActive = useRef(idx === step);
  const active = idx === step;
  useEffect(() => {
    if (active && !prevActive.current) {
      if (reduced) a.setValue(1);
      else {
        a.setValue(0);
        Animated.spring(a, { toValue: 1, useNativeDriver: ND, ...SPRING.pop }).start();
      }
    }
    prevActive.current = active;
  }, [active, a, reduced]);
  if (!ink.on) return <>{children}</>;
  return (
    <Animated.View
      style={{
        width: '100%',
        alignItems: 'center',
        transform: [
          { rotate: a.interpolate({ inputRange: [0, 1], outputRange: [`${rot + 3}deg`, `${rot}deg`] }) },
          { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** 页码指示点：当前页的点平滑拉长 */
function Dot({ on, color, onPress, label }: { on: boolean; color: string; onPress: () => void; label: string }) {
  const reduced = useReducedMotion();
  const w = useRef(new Animated.Value(on ? 18 : 6)).current;
  useEffect(() => {
    if (reduced) { w.setValue(on ? 18 : 6); return; }
    const animation = Animated.spring(w, { toValue: on ? 18 : 6, useNativeDriver: false, ...SPRING.slide });
    animation.start();
    return () => animation.stop();
  }, [on, w, reduced]);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} aria-pressed={on} onPress={onPress} hitSlop={8} style={{ minWidth: 28, minHeight: 28, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ width: w, height: 6, borderRadius: 3, backgroundColor: color }} />
    </Pressable>
  );
}

/** 2-4. 引导页 1-3（1:1 复刻设计稿1 #2-#4） */
export default function OnboardingScreen() {
  const { c, t, fs, dark, r, ink, frameInk } = useTheme();
  const pack = useIllustrations();
  const inkLook = ink.on;
  const reduced = useReducedMotion();
  const [pageW, setPageW] = useState(1);
  const scrollRef = useRef<ScrollView>(null);
  const [step, setStep] = useState(0);
  const [activeMood, setActiveMood] = useState<MoodKey>('happy');
  // 插画随翻页轻微位移与缩放，翻页不再是「整块平移」
  const scrollX = useRef(new Animated.Value(0)).current;
  const pageMotion = (idx: number) => {
    if (reduced) return { opacity: 1 };
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
    scrollRef.current?.scrollTo({ x: i * pageW, animated: !reduced });
  };

  // The carousel follows its actual content width, including desktop frames and rotation.
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    pending.current = stepRef.current;
    scrollRef.current?.scrollTo({ x: stepRef.current * pageW, animated: false });
  }, [pageW]);

  const next = () => {
    if (step < PAGES.length - 1) goPage(step + 1);
    else goChoose();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: 22, paddingTop: 10, alignItems: 'flex-end' }}>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={goChoose} style={{ minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' }}>
          <Text style={{ fontSize: fs(14), color: c.textSub }}>跳过</Text>
        </Pressable>
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        onLayout={event => setPageW(Math.max(1, event.nativeEvent.layout.width))}
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
          <View key={p.key} accessibilityElementsHidden={idx !== step} importantForAccessibility={idx === step ? 'auto' : 'no-hide-descendants'} aria-hidden={idx !== step} style={{ width: pageW, flexShrink: 0, paddingHorizontal: 28, justifyContent: 'center', gap: 20, paddingTop: 12, paddingBottom: 12 }}>
            <View>
              <Text style={[t.h1, { fontSize: fs(26), letterSpacing: 1 }]}>{p.title}</Text>
              <Text style={[t.sub, { fontSize: fs(14.5), marginTop: 12, lineHeight: fs(14.5) * 1.75 }]}>{p.desc}</Text>
            </View>

            <Animated.View style={[{ width: '100%', alignItems: 'center' }, pageMotion(idx)]}>
              {idx === 0 && (
                <Postcard idx={idx} step={step}>
                  <View
                    style={{
                      width: '100%',
                      maxWidth: 320,
                      maxHeight: 320,
                      aspectRatio: 1,
                      borderRadius: inkLook ? r(20) : 24,
                      overflow: 'hidden',
                      backgroundColor: '#FFFFFF',
                      ...(inkLook ? frameInk : { borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider }),
                    }}
                  >
                    <Image source={pack[p.art]} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  </View>
                </Postcard>
              )}

              {idx === 1 && (
                <View style={{ width: '100%', maxWidth: 320, alignItems: 'center' }}>
                  <Postcard idx={idx} step={step}>
                    <View
                      style={{
                        width: '100%',
                        maxHeight: 240,
                        aspectRatio: 1.32,
                        borderRadius: inkLook ? r(20) : 24,
                        overflow: 'hidden',
                        backgroundColor: dark ? 'rgba(236,246,247,0.94)' : c.cardAlt,
                        ...(inkLook ? frameInk : { borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider }),
                        padding: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                    <Image source={pack[p.art]} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                    </View>
                  </Postcard>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '96%', marginTop: 18 }}>
                    {PREVIEW_MOODS.map(m => {
                      const on = activeMood === m;
                      return (
                        <PressableScale
                          key={m}
                          scaleTo={0.86}
                          onPress={() => setActiveMood(m)}
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: on ? c.card : 'transparent',
                            borderWidth: 1.5,
                            borderColor: on ? (inkLook ? ink.line : c.primary) : 'transparent',
                            transform: [{ scale: on ? 1.1 : 1 }],
                          }}
                        >
                          <Jelly active={on}>
                            <MoodIcon mood={m} size={36} />
                          </Jelly>
                        </PressableScale>
                      );
                    })}
                  </View>
                </View>
              )}

              {idx === 2 && (
                <Postcard idx={idx} step={step}>
                  <View
                    style={{
                      width: '100%',
                      maxWidth: 320,
                      maxHeight: 320,
                      aspectRatio: 1,
                      borderRadius: inkLook ? r(20) : 24,
                      overflow: 'hidden',
                      ...(inkLook ? frameInk : { borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider }),
                    }}
                  >
                    <Image source={pack[p.art]} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  </View>
                </Postcard>
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
              label={`第 ${i + 1} 页：${p.title}`}
              on={i === step}
              color={i === step ? c.primary : c.primarySoft}
              onPress={() => goPage(i)}
            />
          ))}
        </View>

        <Button
          title={PAGES[step].cta}
          onPress={next}
        />
      </View>
    </Screen>
  );
}
