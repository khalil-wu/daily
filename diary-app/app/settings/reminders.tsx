import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions, useStore } from '../../src/store/store';
import { Button, Card, Group, NavBar, Row, Screen, Switch } from '../../src/components/ui';
import { useFeedback } from '../../src/components/feedback';
import { pad2 } from '../../src/utils/date';
import { rescheduleDailyReminder } from '../../src/utils/notifications';

const REPEAT_LABEL = {
  daily: '每天',
  weekday: '周一至周五',
  weekend: '周末',
  custom: '自定义',
} as const;

/** 4. 提醒设置（1:1 复刻设计稿3 #4） */
export default function RemindersScreen() {
  const { c, fs } = useTheme();
  const { toast } = useFeedback();
  const rem = useStore(s => s.reminders);

  const toggleDaily = (v: boolean) => {
    const next = { ...rem, daily: v };
    actions.setReminders({ daily: v });
    void rescheduleDailyReminder(next).then(status => {
      if (status === 'denied') toast('未开启通知权限，提醒可能无法送达', { type: 'warning' });
    });
    toast(v ? `已开启每日 ${pad2(rem.hour)}:${pad2(rem.minute)} 提醒` : '已关闭每日提醒');
  };

  const chooseMethod = () => {
    const next = rem.method === 'notify_sound' ? 'notify' : 'notify_sound';
    actions.setReminders({ method: next });
    toast(next === 'notify_sound' ? '提醒方式已设为：通知 + 声音' : '提醒方式已设为：仅通知');
  };

  const testNotify = async () => {
    if (Platform.OS === 'web') {
      toast('提醒预览', { type: 'info', message: rem.text });
      return;
    }
    try {
      const perm = await Notifications.requestPermissionsAsync();
      if (!perm.granted) {
        toast('请先允许通知权限', { type: 'denied' });
        return;
      }
      await Notifications.scheduleNotificationAsync({
        content: { title: '记得日记', body: rem.text, sound: rem.method === 'notify_sound' },
        trigger: null,
      });
    } catch {
      toast('提醒预览', { type: 'info', message: rem.text });
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar variant="large" title="提醒设置" />
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}>
        <Group>
          <Row
            title="每日提醒"
            subtitle="培养记录习惯，别忘了写日记"
            right={<Switch value={rem.daily} onChange={toggleDaily} />}
          />
          <Row
            title="提醒时间"
            value={`${pad2(rem.hour)}:${pad2(rem.minute)} · ${REPEAT_LABEL[rem.repeat]}`}
            onPress={() => router.push('/settings/reminder-time')}
          />
        </Group>

        <Text style={{ fontSize: fs(13), color: c.textSub, marginBottom: 8, marginLeft: 4, fontWeight: '500' }}>自定义提醒文案</Text>
        <Card style={{ marginBottom: 14, padding: 14 }}>
          <TextInput
            value={rem.text}
            onChangeText={text => actions.setReminders({ text })}
            multiline
            placeholder="输入你想看到的每日提醒语…"
            placeholderTextColor={c.textMuted}
            style={{
              fontSize: fs(14),
              color: c.text,
              lineHeight: fs(14) * 1.6,
              minHeight: 54,
              backgroundColor: c.inputBg,
              borderRadius: 12,
              padding: 12,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: c.divider,
              outlineStyle: 'none',
            } as any}
          />
        </Card>

        <Group>
          <Row
            title="重要事项提醒"
            subtitle="为标记的重要事项提供提醒"
            right={<Switch value={rem.important} onChange={v => actions.setReminders({ important: v })} />}
          />
          <Row
            title="提醒方式"
            value={rem.method === 'notify_sound' ? '通知 + 声音' : '仅通知'}
            onPress={chooseMethod}
          />
        </Group>

        <View style={{ marginTop: 8 }}>
          <Button title="预览一次提醒" variant="soft" onPress={() => void testNotify()} />
        </View>
      </ScrollView>
    </Screen>
  );
}
