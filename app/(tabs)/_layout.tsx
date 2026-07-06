import { Tabs } from 'expo-router';
import { Clock3, MessageCircle, Sparkles, UsersRound, UserRound } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { colors, shadows, typography } from '@/src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgSecondary,
          borderTopColor: colors.divider,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 76,
          paddingTop: 9,
          paddingBottom: 12,
          ...shadows.card,
        },
        tabBarLabelStyle: {
          fontFamily: typography.fontFamily.display,
          fontSize: 11,
          fontWeight: '500',
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        sceneStyle: { backgroundColor: colors.bgPrimary },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: '记得',
          tabBarIcon: ({ color, size }) => <Sparkles color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: '身边人',
          tabBarIcon: ({ color, size }) => <UsersRound color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          title: '从前',
          tabBarIcon: ({ color, size }) => <Clock3 color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: '灵感墙',
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: '我',
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
