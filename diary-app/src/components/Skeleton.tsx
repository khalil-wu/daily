import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from './motion';

const USE_NATIVE = Platform.OS !== 'web';

/** 首页加载骨架屏 */
export function HomeSkeleton() {
  const { c, dark } = useTheme();
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (reduced) { pulse.setValue(0.7); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.92, duration: 750, useNativeDriver: USE_NATIVE, isInteraction: false }),
        Animated.timing(pulse, { toValue: 0.45, duration: 750, useNativeDriver: USE_NATIVE, isInteraction: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced]);

  const blockBg = c.bgDeep;

  return (
    <Animated.View accessibilityLabel="正在加载日记" accessibilityState={{ busy: true }} style={{ flex: 1, paddingHorizontal: 20, paddingTop: 14, gap: 12, opacity: pulse }}>
      {/* 灵感骨架卡 */}
      <View
        style={{
          backgroundColor: c.card,
          borderRadius: 16,
          padding: 14,
          borderWidth: dark ? 0 : StyleSheet.hairlineWidth,
          borderColor: c.divider,
          gap: 10,
        }}
      >
        <View style={{ width: 96, height: 12, borderRadius: 6, backgroundColor: blockBg }} />
        <View style={{ width: '78%', height: 15, borderRadius: 7, backgroundColor: blockBg }} />
        <View style={{ width: '56%', height: 12, borderRadius: 6, backgroundColor: blockBg }} />
      </View>

      {[0, 1, 2, 3].map(idx => (
        <View
          key={idx}
          style={{
            flexDirection: 'row',
            backgroundColor: c.card,
            borderRadius: 16,
            paddingHorizontal: 12,
            paddingVertical: 14,
            borderWidth: dark ? 0 : StyleSheet.hairlineWidth,
            borderColor: c.divider,
            gap: 10,
          }}
        >
          <View style={{ width: 32, alignItems: 'center', gap: 6, paddingTop: 2 }}>
            <View style={{ width: 20, height: 10, borderRadius: 5, backgroundColor: blockBg }} />
            <View style={{ width: 24, height: 22, borderRadius: 6, backgroundColor: blockBg }} />
            <View style={{ width: 20, height: 9, borderRadius: 4, backgroundColor: blockBg }} />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ width: '68%', height: 14, borderRadius: 7, backgroundColor: blockBg }} />
            <View style={{ width: '92%', height: 12, borderRadius: 6, backgroundColor: blockBg }} />
            <View style={{ width: '44%', height: 12, borderRadius: 6, backgroundColor: blockBg, marginTop: 4 }} />
          </View>
          <View style={{ width: 62, height: 62, borderRadius: 10, backgroundColor: blockBg }} />
        </View>
      ))}
    </Animated.View>
  );
}
