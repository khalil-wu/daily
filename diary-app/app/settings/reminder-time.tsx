import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions, useStore } from '../../src/store/store';
import type { RepeatRule } from '../../src/store/types';
import { Card, NavBar, Radio, Screen, TextAction, goBack, haptic } from '../../src/components/ui';
import { WheelTimePicker } from '../../src/components/WheelTimePicker';
import { useFeedback } from '../../src/components/feedback';
import { pad2, WEEK_SHORT } from '../../src/utils/date';
import { rescheduleDailyReminder } from '../../src/utils/notifications';

const RULES: { key: RepeatRule; title: string; subtitle?: string }[] = [
  { key: 'daily', title: '每天' },
  { key: 'weekday', title: '周一至周五' },
  { key: 'weekend', title: '周末（周六、周日）' },
  { key: 'custom', title: '自定义', subtitle: '选择具体的星期' },
];

/** 5. 通知时间选择器 / 重复设置（1:1 复刻设计稿3 #5） */
export default function ReminderTimeScreen() {
  const { c, fs } = useTheme();
  const { toast } = useFeedback();
  const rem = useStore(s => s.reminders);

  const [hour, setHour] = useState(rem.hour);
  const [minute, setMinute] = useState(rem.minute);
  const [repeat, setRepeat] = useState<RepeatRule>(rem.repeat);
  const [days, setDays] = useState<number[]>(rem.days);

  const toggleDay = (d: number) => {
    haptic('light');
    setDays(cur => (cur.includes(d) ? (cur.length > 1 ? cur.filter(x => x !== d) : cur) : [...cur, d].sort()));
  };

  const save = () => {
    const patch = { hour, minute, repeat, days };
    actions.setReminders(patch);
    void rescheduleDailyReminder({ ...rem, ...patch });
    toast(`已设为 ${pad2(hour)}:${pad2(minute)}`);
    goBack();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar
        title="设置提醒时间"
        left={<TextAction label="取消" onPress={goBack} />}
        right={<TextAction label="确定" color={c.primaryDark} bold onPress={save} />}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 32 }}>
        <Card style={{ paddingVertical: 16, marginBottom: 20 }}>
          <WheelTimePicker
            hour={hour}
            minute={minute}
            onChange={(h, m) => {
              setHour(h);
              setMinute(m);
            }}
          />
        </Card>

        <Text style={{ fontSize: fs(13), color: c.textSub, marginBottom: 10, marginLeft: 4, fontWeight: '500' }}>重复设置</Text>
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {RULES.map((r, idx) => {
            const on = repeat === r.key;
            return (
              <Pressable
                key={r.key}
                onPress={() => {
                  haptic('light');
                  setRepeat(r.key);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 15,
                  borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0,
                  borderTopColor: c.divider,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fs(15), color: c.text }}>{r.title}</Text>
                  {!!r.subtitle && <Text style={{ fontSize: fs(12), color: c.textSub, marginTop: 2 }}>{r.subtitle}</Text>}
                </View>
                <Radio checked={on} />
              </Pressable>
            );
          })}
        </Card>

        {repeat === 'custom' && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingHorizontal: 4 }}>
            {[1, 2, 3, 4, 5, 6, 0].map(dow => {
              const on = days.includes(dow);
              return (
                <Pressable
                  key={dow}
                  onPress={() => toggleDay(dow)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: on ? c.primary : c.card,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: on ? c.primary : c.divider,
                  }}
                >
                  <Text style={{ fontSize: fs(13), color: on ? '#fff' : c.textSub, fontWeight: on ? '600' : '400' }}>
                    {WEEK_SHORT[dow]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
