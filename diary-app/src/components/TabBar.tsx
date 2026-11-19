import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Tabs } from 'expo-router';
import { BarChart2, BookOpen, Calendar, Clock, User, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { haptic } from './ui';
import { ND, SPRING, prefersReducedMotion } from './motion';
import { useTourTarget } from './tour';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const TAB_META: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: '日记', icon: BookOpen },
  calendar: { label: '日历', icon: Calendar },
  review: { label: '回顾', icon: Clock },
  stats: { label: '统计', icon: BarChart2 },
  me: { label: '我的', icon: User },
};

function TabItem({ name, focused, onPress, onLongPress }: { name: string; focused: boolean; onPress: () => void; onLongPress: () => void }) {
  const { c, fs } = useTheme();
  const meta = TAB_META[name];
  const targetRef = useTourTarget(`tab.${name}`);
  const a = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    if (prefersReducedMotion()) {
      a.setValue(focused ? 1 : 0);
      return;
    }
    Animated.spring(a, { toValue: focused ? 1 : 0, useNativeDriver: ND, ...SPRING.pop }).start();
  }, [a, focused]);

  if (!meta) return null;
  const Icon = meta.icon;
  const color = focused ? c.primaryDark : c.textMuted;

  return (
    <Pressable
      ref={targetRef}
      collapsable={false}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={meta.label}
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 4 }}
    >
      {/* 选中时图标轻轻弹起，外观与设计稿一致，只多了一点「被按到」的回应 */}
      <Animated.View
        style={{
          transform: [
            { scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
            { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5] }) },
          ],
        }}
      >
        <Icon size={22} color={color} strokeWidth={focused ? 1.9 : 1.7} />
      </Animated.View>
      <Text style={{ fontSize: fs(10.5), marginTop: 4, color, fontWeight: focused ? '600' : '400' }}>{meta.label}</Text>
    </Pressable>
  );
}

/** 底部标签栏：沿用设计稿的白底 + 细分隔线，高度跟随设备安全区 */
export function JideTabBar({ state, navigation, insets }: TabBarProps) {
  const { c } = useTheme();
  const bottomPad = Math.max(insets.bottom - 6, 6);

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: c.card,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: c.divider,
        height: 56 + bottomPad,
        paddingBottom: bottomPad,
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
