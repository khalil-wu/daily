import React from 'react';
import { BackHandler, View } from 'react-native';
import { Tabs, useFocusEffect } from 'expo-router';
import { JideTabBar } from '../../src/components/TabBar';
import { BookSpine, leaveBook } from '../../src/components/BookScope';
import { hideCurtain } from '../../src/components/curtain';

export default function TabsLayout() {
  useFocusEffect(
    React.useCallback(() => {
      // 书内页面已经在纸幕下就绪：下一帧揭幕，纸淡成页面
      const raf = requestAnimationFrame(() => hideCurtain());
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        leaveBook();
        return true;
      });
      return () => { cancelAnimationFrame(raf); sub.remove(); };
    }, []),
  );

  return (
    <View style={{ flex: 1 }}>
    <Tabs screenOptions={{ headerShown: false, animation: 'fade', freezeOnBlur: true, lazy: true }} tabBar={props => <JideTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: '日记' }} />
      <Tabs.Screen name="calendar" options={{ title: '日历' }} />
      <Tabs.Screen name="review" options={{ title: '回顾' }} />
      <Tabs.Screen name="stats" options={{ title: '统计' }} />
    </Tabs>
    <BookSpine />
    </View>
  );
}
