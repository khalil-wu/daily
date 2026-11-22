import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './text';
import { Image as ExpoImage } from 'expo-image';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { moodMeta } from '../data/constants';
import { layoutBeans } from '../utils/stats';
import { mixHex } from '../theme/palette';
import { IMAGES } from '../data/assets';
import { ND, SPRING, useReducedMotion } from './motion';
import { MoodIcon } from './MoodIcon';
import type { Entry, MoodKey } from '../store/types';

const JAR_W = 180;
const JAR_H = 170;
const BEAN_W = 146;
const BEAN_H = 92;

/** 掉落的心情豆：弹簧落罐，前 40 颗有掉落动画 */
function BeanDrop({ x, y, w, h, rotate, color, index, reduced }: { x: number; y: number; w: number; h: number; rotate: number; color: string; index: number; reduced: boolean }) {
  const animated = index < 40;
  const v = useRef(new Animated.Value(reduced || !animated ? 1 : 0)).current;
  useEffect(() => {
    if (reduced || !animated) {
      v.setValue(1);
      return;
    }
    const anim = Animated.sequence([
      Animated.delay(index * 30),
      Animated.spring(v, { toValue: 1, useNativeDriver: ND, damping: 16, stiffness: 200, mass: 0.7 }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [v, index, reduced, animated]);
  if (!animated) {
    // 超过 40 颗的直接在落豆结束后出现
    return <BeanAppear x={x} y={y} w={w} h={h} rotate={rotate} color={color} reduced={reduced} />;
  }
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-140, 0] }) }, { rotate: `${rotate}deg` }],
      }}
    >
      <BeanBody w={w} h={h} color={color} />
    </Animated.View>
  );
}

function BeanAppear({ x, y, w, h, rotate, color, reduced }: { x: number; y: number; w: number; h: number; rotate: number; color: string; reduced: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), reduced ? 0 : 40 * 30 + 200);
    return () => clearTimeout(t);
  }, [reduced]);
  if (!show) return null;
  return (
    <View style={{ position: 'absolute', left: x, top: y, width: w, height: h, transform: [{ rotate: `${rotate}deg` }] }}>
      <BeanBody w={w} h={h} color={color} />
    </View>
  );
}

function BeanBody({ w, h, color }: { w: number; h: number; color: string }) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: Math.min(w, h) / 2,
        backgroundColor: color,
        borderWidth: 1,
        borderColor: mixHex(color, '#000000', 0.25),
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={{ position: 'absolute', top: h * 0.18, left: w * 0.22, width: 4, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.75)' }} />
    </View>
  );
}

/** 本月心情罐：本月每篇有心情的日记 = 一颗豆子，点罐子切到情绪页 */
export function MoodJar({ monthEntries, onPress }: { monthEntries: Entry[]; onPress: () => void }) {
  const { c, fs, r, ink } = useTheme();
  const reduced = useReducedMotion();
  const mooded = useMemo(() => monthEntries.filter(e => e.mood), [monthEntries]);
  const beans = useMemo(
    () =>
      layoutBeans(
        mooded.map(e => e.id),
        BEAN_W,
        BEAN_H,
      ),
    [mooded],
  );
  const topMoods = useMemo(() => {
    const counts = new Map<MoodKey, number>();
    for (const e of mooded) counts.set(e.mood as MoodKey, (counts.get(e.mood as MoodKey) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [mooded]);
  const lineColor = ink.on ? ink.line : c.border;
  const count = mooded.length;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count ? `本月心情罐，${count} 颗心情，查看情绪统计` : '本月心情罐，还没有心情豆'}
      onPress={onPress}
      style={{ alignItems: 'center' }}
    >
      <View style={{ width: JAR_W, height: JAR_H }}>
        <Svg width={JAR_W} height={JAR_H} viewBox={`0 0 ${JAR_W} ${JAR_H}`} style={StyleSheet.absoluteFill}>
          {/* 罐身：瓶颈连着盖沿，圆肩收成宽身 */}
          <Path
            d="M42 24 L42 36 C42 52, 15 50, 15 68 L15 148 Q15 162, 29 162 L151 162 Q165 162, 165 148 L165 68 C165 50, 138 52, 138 36 L138 24 Z"
            fill={c.primaryFaint}
            fillOpacity={0.5}
            stroke={lineColor}
            strokeWidth={1.5}
          />
          {/* 盖子：贴在瓶颈上 */}
          <Rect x={37} y={10} width={106} height={14} rx={5} fill={c.primarySoft} stroke={lineColor} strokeWidth={1.5} />
          {/* 玻璃高光 */}
          <Path d="M22 62 Q18 100, 22 138" stroke="rgba(255,255,255,0.6)" strokeWidth={3} fill="none" strokeLinecap="round" />
        </Svg>
        {/* 豆子区（罐身内部，圆角裁剪） */}
        <View style={{ position: 'absolute', left: 17, top: 66, width: BEAN_W, height: BEAN_H, overflow: 'hidden' }}>
          {beans.map((b, i) => (
            <BeanDrop key={b.id} x={b.x} y={b.y} w={b.w} h={b.h} rotate={b.rotate} color={moodMeta((mooded.find(e => e.id === b.id)?.mood) as MoodKey | undefined)?.color ?? c.primary} index={i} reduced={reduced} />
          ))}
        </View>
      </View>
      {count === 0 ? (
        <Text style={{ fontSize: fs(11.5), color: c.textMuted, marginTop: 8, textAlign: 'center' }}>这个月还没有心情豆，写一篇就会掉进来一颗</Text>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {topMoods.map(([key, n]) => {
            const m = moodMeta(key)!;
            return (
              <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: r(999), backgroundColor: c.primaryFaint }}>
                <MoodIcon mood={key} size={16} />
                <Text style={{ fontSize: fs(11), color: c.primaryDark, fontWeight: '500' }}>{m.label} ×{n}</Text>
              </View>
            );
          })}
        </View>
      )}
    </Pressable>
  );
}

/** 发芽的小叶子：从枝上弹出来 */
function SproutLeaf({ delay, up, reduced }: { delay: number; up: boolean; reduced: boolean }) {
  const { c, ink } = useTheme();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      v.setValue(1);
      return;
    }
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.spring(v, { toValue: 1, useNativeDriver: ND, damping: 12, stiffness: 260, mass: 0.5 }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [v, delay, reduced]);
  return (
    <Animated.View
      style={{
        width: 15,
        height: 10,
        backgroundColor: c.primary,
        borderWidth: ink.on ? 1 : 0,
        borderColor: ink.on ? ink.line : 'transparent',
        borderTopLeftRadius: 8,
        borderTopRightRadius: 2,
        borderBottomRightRadius: 8,
        borderBottomLeftRadius: 2,
        transform: [{ scale: v }, { rotate: up ? '-30deg' : '30deg' }],
      }}
    />
  );
}

/** 写作坚持的小枝：叶子 = 记录过的日子，花苞 = 漏掉的过去 */
export function StreakBranch({ weekChecked, style }: { weekChecked: boolean[]; style?: object }) {
  const { c, fs, ink } = useTheme();
  const reduced = useReducedMotion();
  const bird = useRef(new Animated.Value(0)).current;
  const todayIdx = (new Date().getDay() + 6) % 7;
  const lineColor = ink.on ? ink.line : c.textMuted;
  const recorded = weekChecked.filter(Boolean).length;
  const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const recordedDays = dayNames.filter((_, i) => weekChecked[i]);

  useEffect(() => {
    if (reduced || !ink.on) return;
    const anim = Animated.sequence([
      Animated.delay(700),
      Animated.spring(bird, { toValue: 1, useNativeDriver: ND, damping: 10, stiffness: 300, mass: 0.4 }),
      Animated.spring(bird, { toValue: 0, useNativeDriver: ND, damping: 14, stiffness: 260, mass: 0.5 }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [bird, reduced, ink.on]);

  let leafIdx = 0;
  return (
    <View
      style={[{ marginTop: 14, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: c.divider }, style]}
      accessibilityLabel={recorded ? `本周已记录 ${recorded} 天：${recordedDays.join('、')}` : '本周还没有记录'}
    >
      <View style={{ height: 46 }}>
        {/* 枝条 */}
        <Svg width="100%" height="100%" viewBox="0 0 700 46" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
          <Path d="M18 30 C 190 16, 500 40, 682 24" stroke={lineColor} strokeWidth={1.5} fill="none" strokeLinecap="round" />
        </Svg>
        {/* 7 个节点：叶 / 花苞 / 空 */}
        {weekChecked.map((on, i) => {
          const left = `${((i + 0.5) / 7) * 100}%` as const;
          const up = i % 2 === 0;
          if (on) {
            const d = leafIdx++ * 50;
            return (
              <View key={i} style={{ position: 'absolute', left, marginLeft: -8, top: up ? 2 : 26 }}>
                <SproutLeaf delay={d} up={up} reduced={reduced} />
              </View>
            );
          }
          if (i > todayIdx) return null;
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left,
                marginLeft: -3,
                top: 21,
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === todayIdx ? 'transparent' : c.border,
                borderWidth: i === todayIdx ? 1 : 0,
                borderStyle: i === todayIdx ? 'dashed' : 'solid',
                borderColor: c.textMuted,
              }}
            />
          );
        })}
        {/* 小鸟停在枝头（仅陪伴体） */}
        {ink.on && (
          <Animated.Image
            source={IMAGES.companionBird}
            style={{ position: 'absolute', right: 2, top: -4, width: 34, height: 34, transform: [{ translateY: bird.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] }}
            resizeMode="contain"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        )}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        {['一', '二', '三', '四', '五', '六', '日'].map(lbl => (
          <Text key={lbl} style={{ flex: 1, fontSize: fs(11), color: c.textMuted, textAlign: 'center' }}>{lbl}</Text>
        ))}
      </View>
    </View>
  );
}
