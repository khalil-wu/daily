import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './text';
import type { Tabs } from 'expo-router';
import { useTheme } from '../theme/ThemeProvider';
import { NAV_ICONS } from '../data/assets';
import { AssetIcon } from './AssetIcon';
import { haptic } from './ui';
import { ND, SPRING, useReducedMotion } from './motion';
import { useTourTarget } from './tour';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const TAB_META: Record<string, { label: string }> = {
  index: { label: '日记' },
  calendar: { label: '日历' },
  review: { label: '回顾' },
  stats: { label: '统计' },
};

const TabItem = React.memo(function TabItem({ name, focused, onPress, onLongPress }: { name: string; focused: boolean; onPress: () => void; onLongPress: () => void }) {
  const { c, fs, r, ink, dark } = useTheme();
  const reduced = useReducedMotion();
  const meta = TAB_META[name];
  const iconSource = NAV_ICONS[name];
  const targetRef = useTourTarget(`tab.${name}`);
  const a = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      a.setValue(focused ? 1 : 0);
      return;
    }
    const animation = ink.on
      ? Animated.spring(a, { toValue: focused ? 1 : 0, useNativeDriver: ND, ...SPRING.pop })
      : Animated.timing(a, {
          toValue: focused ? 1 : 0,
          duration: 120,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: ND,
          isInteraction: false,
        });
    animation.start();
    return () => animation.stop();
  }, [a, focused, reduced, ink.on]);

  if (!meta || !iconSource) return null;
  const color = focused ? (ink.on ? (dark ? c.primaryDark : ink.line) : c.primaryDark) : c.textMuted;

  return (
    <Pressable
      ref={targetRef}
      collapsable={false}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      aria-selected={focused}
      accessibilityLabel={meta.label}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 4, minHeight: 52, opacity: pressed ? 0.78 : 1 })}
    >
      {/* 选中指示：52×30 柔和胶囊弹出，图标始终可见 */}
      <View style={{ width: 52, height: 30, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            borderRadius: r(15),
            backgroundColor: ink.on ? c.primarySoft : c.primaryFaint,
            opacity: a,
            transform: [
              { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
              { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, reduced ? 0 : -1] }) },
            ],
          }}
        />
        <Animated.View style={ink.on ? undefined : { transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, reduced ? 0 : -1] }) }] }}>
          <AssetIcon source={iconSource} size={21} color={color} />
        </Animated.View>
      </View>
      <Text style={{ fontSize: fs(11), lineHeight: fs(15), marginTop: 2, color, fontWeight: focused ? '600' : '400' }}>{meta.label}</Text>
    </Pressable>
  );
});

/** 底部标签栏：白底 + 细分隔线 + 轻弥散顶投影，高度跟随设备安全区 */
export function JideTabBar({ state, navigation, insets }: TabBarProps) {
  const { c, dark, look, ink } = useTheme();
  const bottomPad = Math.max(insets.bottom - 6, 6);

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: c.card,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: c.divider,
        height: 58 + bottomPad,
        paddingBottom: bottomPad,
        ...(!dark && !look.flat && !ink.on
          ? { shadowColor: c.shadow, shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: -3 }, elevation: 4 }
          : {}),
      }}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        return (
          <TabItem
            key={route.key}
            name={route.name}
            focused={focused}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                haptic('light');
                navigation.navigate(route.name, route.params);
              }
            }}
            onLongPress={() => {
              navigation.emit({ type: 'tabLongPress', target: route.key });
            }}
          />
        );
      })}
    </View>
  );
}
