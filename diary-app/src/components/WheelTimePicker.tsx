import React, { useEffect, useRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Text } from './text';
import { useTheme } from '../theme/ThemeProvider';
import { pad2 } from '../utils/date';
import { haptic } from './ui';
import { useReducedMotion } from './motion';

const VISIBLE = 5;
function WheelColumn({ label, items, selected, itemHeight, onSelect }: { label: string; items: number[]; selected: number; itemHeight: number; onSelect: (v: number) => void }) {
  const { c, fs } = useTheme();
  const reduced = useReducedMotion();
  const ref = useRef<ScrollView>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRef = useRef(selected);
  const internalSelection = useRef<number | null>(null);
  const selectRef = useRef(onSelect);
  selectedRef.current = selected;
  selectRef.current = onSelect;
  const clearSnap = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => () => clearSnap(), []);

  const choose = (value: number, animated = !reduced) => {
    clearSnap();
    const index = Math.min(items.length - 1, Math.max(0, items.indexOf(value)));
    if (items[index] !== selectedRef.current) { internalSelection.current = items[index]; haptic('light'); selectRef.current(items[index]); }
    ref.current?.scrollTo({ y: index * itemHeight, animated });
  };
  useEffect(() => {
    if (internalSelection.current === selected) { internalSelection.current = null; return; }
    ref.current?.scrollTo({ y: Math.max(0, items.indexOf(selected)) * itemHeight, animated: false });
  }, [selected, itemHeight, items]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = ref.current?.getScrollableNode() as HTMLElement | undefined;
    const key = (event: KeyboardEvent) => {
      const delta = event.key === 'ArrowUp' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowDown' || event.key === 'ArrowLeft' ? -1 : 0;
      if (!delta && event.key !== 'Home' && event.key !== 'End') return;
      event.preventDefault();
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : Math.min(items.length - 1, Math.max(0, items.indexOf(selectedRef.current) + delta));
      choose(items[index]);
    };
    node?.addEventListener('keydown', key);
    return () => node?.removeEventListener('keydown', key);
  }, [items, itemHeight, reduced]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    clearSnap();
    timer.current = setTimeout(() => {
      timer.current = null;
      const index = Math.min(items.length - 1, Math.max(0, Math.round(y / itemHeight)));
      if (items[index] !== selectedRef.current) { internalSelection.current = items[index]; haptic('light'); selectRef.current(items[index]); }
      if (Math.abs(y - index * itemHeight) > 0.5) ref.current?.scrollTo({ y: index * itemHeight, animated: !reduced });
    }, 140);
  };

  return (
    <ScrollView
      ref={ref} accessible accessibilityRole="adjustable" accessibilityLabel={label}
      accessibilityValue={{ min: items[0], max: items[items.length - 1], now: selected, text: `${selected}${label === '小时' ? '时' : '分'}` }}
      aria-valuemin={items[0]} aria-valuemax={items[items.length - 1]} aria-valuenow={selected} tabIndex={0}
      accessibilityActions={[{ name: 'increment', label: '增加' }, { name: 'decrement', label: '减少' }]}
      onAccessibilityAction={event => choose(Math.min(items[items.length - 1], Math.max(items[0], selected + (event.nativeEvent.actionName === 'increment' ? 1 : -1))))}
      onLayout={() => ref.current?.scrollTo({ y: Math.max(0, items.indexOf(selectedRef.current)) * itemHeight, animated: false })}
      showsVerticalScrollIndicator={false} snapToInterval={itemHeight} decelerationRate="fast" onScroll={onScroll} scrollEventThrottle={32}
      style={{ width: 80, height: itemHeight * VISIBLE }} contentContainerStyle={{ paddingVertical: itemHeight * Math.floor(VISIBLE / 2) }}
    >
      {items.map(v => {
        const dist = Math.abs(v - selected);
        const on = v === selected;
        return <Pressable key={v} accessible={false} focusable={false} tabIndex={-1} onPress={() => choose(v)} style={{ height: itemHeight, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: on ? fs(24) : dist === 1 ? fs(18) : fs(15), color: on ? c.text : dist === 1 ? c.textSub : c.textMuted, opacity: on ? 1 : dist === 1 ? 0.75 : 0.5, fontWeight: on ? '600' : '400', fontVariant: ['tabular-nums'] }}>{pad2(v)}</Text>
        </Pressable>;
      })}
    </ScrollView>
  );
}
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

export function WheelTimePicker({ hour, minute, onChange }: { hour: number; minute: number; onChange: (h: number, m: number) => void }) {
  const { c, fs, r } = useTheme();
  const itemHeight = Math.max(44, Math.ceil(fs(24) * 1.5));
  return <View style={{ height: itemHeight * VISIBLE, alignItems: 'center', justifyContent: 'center' }}>
    <View pointerEvents="none" style={{ position: 'absolute', left: 24, right: 24, height: itemHeight, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.divider, backgroundColor: c.primaryFaint, borderRadius: r(12) }} />
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <WheelColumn label="小时" items={HOURS} selected={hour} itemHeight={itemHeight} onSelect={h => onChange(h, minute)} />
      <Text style={{ fontSize: fs(22), color: c.text, fontWeight: '600', marginBottom: 2 }}>:</Text>
      <WheelColumn label="分钟" items={MINUTES} selected={minute} itemHeight={itemHeight} onSelect={m => onChange(hour, m)} />
    </View>
  </View>;
}
