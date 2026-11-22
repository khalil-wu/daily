import React from 'react';
import { Tabs } from 'expo-router';
import { JideTabBar } from '../../src/components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, animation: 'none', freezeOnBlur: true, lazy: true }} tabBar={props => <JideTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: '日记' }} />
      <Tabs.Screen name="calendar" options={{ title: '日历' }} />
      <Tabs.Screen name="review" options={{ title: '回顾' }} />
      <Tabs.Screen name="stats" options={{ title: '统计' }} />
      <Tabs.Screen name="me" options={{ title: '我的' }} />
    </Tabs>
  );
}
