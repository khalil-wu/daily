import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../src/components/text';
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
  const [scheduling, setScheduling] = useState(false);

  const updateReminder = async (patch: Partial<typeof rem>) => {
    if (scheduling) return;
    const next = { ...rem, ...patch };
    actions.setReminders(patch);
    setScheduling(true);
    const status = await rescheduleDailyReminder(next);
    setScheduling(false);
    if (status === 'web') toast('偏好已保存；网页不支持后台定时提醒', { type: 'info' });
    else if (status === 'denied') toast('未获得通知权限，提醒尚未生效', { type: 'warning' });
    else if (status === 'error') toast('提醒设置已保留，但系统未完成安排，请重试', { type: 'error' });
    else toast(next.daily ? `提醒已按${REPEAT_LABEL[next.repeat]} ${pad2(next.hour)}:${pad2(next.minute)} 安排` : '已关闭每日提醒');
  };

  const chooseMethod = () => {
    const next = rem.method === 'notify_sound' ? 'notify' : 'notify_sound';
    void updateReminder({ method: next });
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
      toast('系统未能发送提醒，请检查通知权限后重试', { type: 'error' });
    }
  };

  return (
    <Screen enter="page" edges={['top', 'bottom']}>
      <NavBar variant="large" title="提醒设置" />
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}>
        {Platform.OS === 'web' && <Text style={{ fontSize: fs(13), color: c.textSub, lineHeight: fs(20), marginBottom: 16 }}>当前网页不支持后台定时通知。这里保存 App 的提醒偏好，预览仅在页面内显示。</Text>}
        <Group>
          <Row
            title={Platform.OS === 'web' ? 'App 每日提醒' : '每日提醒'}
            subtitle="按所选时间和重复规则提醒"
            right={<Switch value={rem.daily} disabled={scheduling} onChange={value => void updateReminder({ daily: value })} />}
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
            onBlur={() => void updateReminder({ text: actions.snapshot().reminders.text })}
            accessibilityLabel="提醒文案"
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
          {Platform.OS === 'android' && <Row
            title="优先提醒"
            subtitle="提高 Android 通知优先级，实际呈现由系统设置决定"
            right={<Switch value={rem.important} disabled={scheduling} onChange={value => void updateReminder({ important: value })} />}
          />}
          <Row
            title="提醒方式"
            value={rem.method === 'notify_sound' ? '通知 + 声音' : '仅通知'}
            onPress={chooseMethod}
            disabled={scheduling}
          />
        </Group>

        <View style={{ marginTop: 8 }}>
          <Button title="预览一次提醒" variant="soft" onPress={() => void testNotify()} />
        </View>
      </ScrollView>
    </Screen>
  );
}
