import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './text';
import { router, type Tabs } from 'expo-router';
import { AudioLines, BookOpen, CalendarDays, Camera, ChartNoAxesColumn, LayoutTemplate, Mic, Plus, UserRound, Video, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useStore } from '../store/store';
import { haptic } from './ui';
import { useFeedback } from './feedback';
import { ND, PressableScale, SPRING, useReducedMotion } from './motion';
import { useTourTarget } from './tour';
import { isDictationSupported } from '../utils/dictation';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const TAB_META: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: '日记', icon: BookOpen },
  calendar: { label: '日历', icon: CalendarDays },
  review: { label: '回顾', icon: ChartNoAxesColumn },
  profile: { label: '我的', icon: UserRound },
};

/** 写作按钮插在第几个标签之后：日记 · 日历 · ＋ · 回顾 · 我的 */
const WRITE_SLOT = 2;

const TabItem = React.memo(function TabItem({ name, focused, onPress, onLongPress }: { name: string; focused: boolean; onPress: () => void; onLongPress: () => void }) {
  const { c, fs } = useTheme();
  const reduced = useReducedMotion();
  const meta = TAB_META[name];
  const targetRef = useTourTarget(`tab.${name}`);
  const a = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      a.setValue(focused ? 1 : 0);
      return;
    }
    const animation = Animated.spring(a, { toValue: focused ? 1 : 0, useNativeDriver: ND, ...SPRING.pop });
    animation.start();
    return () => animation.stop();
  }, [a, focused, reduced]);

  if (!meta) return null;
  const color = focused ? c.primaryDark : c.textMuted;
  const Icon = meta.icon;

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
      style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 50, opacity: pressed ? 0.7 : 1 })}
    >
      <Animated.View style={{ transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }, { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) }] }}>
        <Icon size={22} color={color} strokeWidth={focused ? 2.1 : 1.7} />
      </Animated.View>
      <Text style={{ fontSize: fs(10.5), lineHeight: fs(14), marginTop: 3, color, fontWeight: focused ? '600' : '400' }}>{meta.label}</Text>
    </Pressable>
  );
});

/** 中间的写作按钮：点一下直接写进当前这本书，长按选模板 / 拍照 / 录音 */
function WriteButton() {
  const { c, dark } = useTheme();
  const { sheet } = useFeedback();
  const activeNotebook = useStore(s => s.activeNotebook);
  const targetRef = useTourTarget('tab.write');
  const base = activeNotebook ? { notebook: activeNotebook } : {};

  const write = (extra?: Record<string, string>) => router.push({ pathname: '/write', params: { ...base, ...extra } });
  const openMenu = () => {
    haptic('medium');
    sheet(
      [
        { label: '用模板开始', icon: LayoutTemplate, onPress: () => router.push('/templates') },
        { label: '拍照记录', icon: Camera, onPress: () => write({ action: 'photo' }) },
        { label: '录音记录', icon: Mic, onPress: () => write({ action: 'audio' }) },
        { label: '拍一段视频', icon: Video, onPress: () => write({ action: 'video' }) },
        ...(isDictationSupported() ? [{ label: '语音听写', icon: AudioLines, onPress: () => write({ action: 'dictate' }) }] : []),
      ],
      '换一种方式记录',
    );
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <View ref={targetRef} collapsable={false} style={{ borderRadius: 20 }}>
      <PressableScale
        scaleTo={0.9}
        onPress={() => {
          haptic('medium');
          write();
        }}
        onLongPress={openMenu}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityLabel="写日记"
        accessibilityHint="长按可以选择模板、拍照或录音"
        hitSlop={4}
        style={{
          width: 52,
          height: 40,
          borderRadius: 20,
          backgroundColor: c.primary,
          alignItems: 'center',
          justifyContent: 'center',
          ...(Platform.OS === 'web'
            ? ({ boxShadow: dark ? 'none' : `0 4px 12px ${c.primary}55` } as object)
            : { shadowColor: c.primary, shadowOpacity: dark ? 0 : 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: dark ? 0 : 3 }),
        }}
      >
        <Plus size={24} color={c.textOnPrimary} strokeWidth={2.4} />
      </PressableScale>
      </View>
    </View>
  );
}

/** 底部标签栏：日记 · 日历 · ＋ · 回顾 · 我的 */
export function JideTabBar({ state, navigation, insets }: TabBarProps) {
  const { c } = useTheme();
  const bottomPad = Math.max(insets.bottom - 8, 6);

  const items = state.routes.map((route, index) => {
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
  });
  items.splice(WRITE_SLOT, 0, <WriteButton key="__write" />);

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.card,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: c.divider,
        height: 56 + bottomPad,
        paddingBottom: bottomPad,
        paddingHorizontal: 4,
      }}
    >
      {items}
    </View>
  );
}
