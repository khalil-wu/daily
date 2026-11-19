import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { pad2 } from '../utils/date';
import { haptic } from './ui';

const ITEM_H = 44;
const VISIBLE = 5;

function WheelColumn({ items, selected, onSelect }: { items: number[]; selected: number; onSelect: (v: number) => void }) {
  const { c, fs } = useTheme();
  const ref = useRef<ScrollView>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const idx = Math.max(0, items.indexOf(selected));
    const t = setTimeout(() => {
      ref.current?.scrollTo({ y: idx * ITEM_H, animated: false });
    }, 30);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const snapToOffset = (y: number) => {
    const idx = Math.min(items.length - 1, Math.max(0, Math.round(y / ITEM_H)));
    const val = items[idx];
    if (val !== undefined && val !== selected) {
      haptic('light');
      onSelect(val);
    }
    ref.current?.scrollTo({ y: idx * ITEM_H, animated: true });
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => snapToOffset(y), 140);
  };

  const pad = ITEM_H * Math.floor(VISIBLE / 2);

  return (
    <ScrollView
      ref={ref}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      onScroll={onScroll}
      scrollEventThrottle={32}
      style={{ width: 80, height: ITEM_H * VISIBLE }}
      contentContainerStyle={{ paddingVertical: pad }}
    >
      {items.map((v, idx) => {
        const dist = Math.abs(v - selected);
        const on = v === selected;
        return (
          <Pressable
            key={v}
            onPress={() => {
              haptic('light');
              onSelect(v);
              ref.current?.scrollTo({ y: idx * ITEM_H, animated: true });
            }}
            style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text
              style={{
                fontSize: on ? fs(24) : dist === 1 ? fs(18) : fs(15),
                color: on ? c.text : dist === 1 ? c.textSub : c.textMuted,
                opacity: on ? 1 : dist === 1 ? 0.6 : 0.35,
                fontWeight: on ? '600' : '400',
                fontVariant: ['tabular-nums'],
              }}
            >
              {pad2(v)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

/** 滚轮时间选择器（1:1 复刻设计稿3 #5） */
export function WheelTimePicker({ hour, minute, onChange }: { hour: number; minute: number; onChange: (h: number, m: number) => void }) {
  const { c, fs } = useTheme();
  return (
    <View style={{ height: ITEM_H * VISIBLE, alignItems: 'center', justifyContent: 'center' }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 24,
          right: 24,
          height: ITEM_H,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderColor: c.divider,
          backgroundColor: c.primaryFaint,
          borderRadius: 12,
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <WheelColumn items={HOURS} selected={hour} onSelect={h => onChange(h, minute)} />
        <Text style={{ fontSize: fs(22), color: c.text, fontWeight: '600', marginBottom: 2 }}>:</Text>
        <WheelColumn items={MINUTES} selected={minute} onSelect={m => onChange(hour, m)} />
      </View>
    </View>
  );
}
