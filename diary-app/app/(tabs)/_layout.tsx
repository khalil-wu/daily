import React from 'react';
import { BackHandler } from 'react-native';
import { Tabs, useFocusEffect } from 'expo-router';
import { JideTabBar } from '../../src/components/TabBar';
import { leaveBook } from '../../src/components/BookScope';

export default function TabsLayout() {
  useFocusEffect(
    React.useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        leaveBook();
        return true;
      });
      return () => sub.remove();
    }, []),
  );

  return (
    <Tabs screenOptions={{ headerShown: false, animation: 'none', freezeOnBlur: true, lazy: true }} tabBar={props => <JideTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: '日记' }} />
      <Tabs.Screen name="calendar" options={{ title: '日历' }} />
      <Tabs.Screen name="review" options={{ title: '回顾' }} />
      <Tabs.Screen name="stats" options={{ title: '统计' }} />
    </Tabs>
  );
}
