import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, Flame, Target } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions, useStore } from '../../src/store/store';
import { Button, Card, Group, NavBar, Row, Screen, Switch, haptic } from '../../src/components/ui';
import { useFeedback } from '../../src/components/feedback';
import { computeDailyGoalProgress } from '../../src/utils/grouping';
import { dayKey, startOfDay, WEEK_SHORT } from '../../src/utils/date';
import { wordCount } from '../../src/utils/text';

const PRESETS = [50, 100, 200, 300, 500];

/** 每日写作目标设置与近 7 天达标追踪 */
export default function GoalsSettingsScreen() {
  const { c, t, fs } = useTheme();
  const { toast } = useFeedback();
  const goals = useStore(s => s.goals);
  const entries = useStore(s => s.entries);
  const [customVal, setCustomVal] = useState(String(goals.dailyWords));

  const todayProg = useMemo(
    () => computeDailyGoalProgress(entries, goals.dailyWords),
    [entries, goals.dailyWords],
  );

  const last7Days = useMemo(() => {
    const today = startOfDay(Date.now());
    const map = new Map<string, number>();
    for (const e of entries) {
      if (e.deletedAt || e.hidden) continue;
      const k = dayKey(e.createdAt);
      map.set(k, (map.get(k) ?? 0) + wordCount(e.title) + wordCount(e.body));
    }
    const list: { label: string; words: number; achieved: boolean; isToday: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(today);
      dt.setDate(dt.getDate() - i);
      const k = dayKey(dt);
      const words = map.get(k) ?? 0;
      list.push({
        label: i === 0 ? '今天' : WEEK_SHORT[dt.getDay()],
        words,
        achieved: words >= Math.max(1, goals.dailyWords),
        isToday: i === 0,
      });
    }
    return list;
  }, [entries, goals.dailyWords]);

  const maxDayWords = Math.max(goals.dailyWords, ...last7Days.map(d => d.words), 1);
  const achievedDays = last7Days.filter(d => d.achieved).length;

  const applyCustom = () => {
    const num = Math.round(Number(customVal));
    if (!Number.isFinite(num) || num < 10 || num > 10000) {
      toast('请输入 10 到 10,000 之间的字数', { type: 'warning' });
      return;
    }
    haptic('light');
    actions.setGoals({ dailyWords: num });
    toast(`已设定每日目标 ${num} 字`);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar title="写作目标" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 36, gap: 14 }}>
        <Group style={{ marginBottom: 0 }}>
          <Row
            icon={Target}
            iconColor={c.primaryDark}
            title="开启每日写作目标"
            subtitle="在首页与编辑器顶部展示每日字数进度"
            right={
              <Switch
                value={goals.enabled}
                onChange={enabled => actions.setGoals({ enabled })}
              />
            }
          />
        </Group>

        {/* 今日进度卡 */}
        <Card style={{ backgroundColor: c.primaryFaint, borderColor: c.primarySoft }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={[t.h3, { color: c.primaryDark, fontSize: fs(15) }]}>今日完成度</Text>
            {todayProg.achieved ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: c.successSoft }}>
                <Check size={12} color={c.success} strokeWidth={3} />
                <Text style={{ fontSize: fs(11), color: c.success, fontWeight: '600' }}>今日已达标</Text>
              </View>
            ) : (
              <Text style={{ fontSize: fs(12), color: c.textSub }}>
                还差 {Math.max(0, todayProg.target - todayProg.written)} 字
              </Text>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 10 }}>
            <Text style={{ fontSize: fs(28), color: c.text, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
              {todayProg.written}
            </Text>
            <Text style={{ fontSize: fs(14), color: c.textSub }}>/ {todayProg.target} 字</Text>
          </View>

          <View style={{ height: 8, borderRadius: 4, backgroundColor: c.card, overflow: 'hidden' }}>
            <View
              style={{
                height: '100%',
                width: `${todayProg.percent}%`,
                borderRadius: 4,
                backgroundColor: todayProg.achieved ? c.success : c.primary,
              }}
            />
          </View>
        </Card>

        {/* 目标字数预设与自定义 */}
        <Card style={{ gap: 12 }}>
          <Text style={[t.h3, { fontSize: fs(15) }]}>每日目标字数</Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PRESETS.map(p => {
              const on = goals.dailyWords === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => {
                    haptic('light');
                    actions.setGoals({ dailyWords: p });
                    setCustomVal(String(p));
                  }}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: on ? c.primary : c.bgDeep,
                  }}
                >
                  <Text style={{ fontSize: fs(13), color: on ? '#fff' : c.text, fontWeight: on ? '600' : '400' }}>
                    {p} 字
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 }}>
            <TextInput
              value={customVal}
              onChangeText={setCustomVal}
              keyboardType="numeric"
              placeholder="自定义字数 (10~10000)"
              placeholderTextColor={c.textMuted}
              style={{
                flex: 1,
                height: 42,
                borderRadius: 12,
                paddingHorizontal: 12,
                backgroundColor: c.inputBg,
                color: c.text,
                fontSize: fs(14),
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: c.border,
                outlineStyle: 'none',
              } as any}
            />
            <Button title="应用" size="md" full={false} onPress={applyCustom} />
          </View>
        </Card>

        {/* 近 7 天达标情况 */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={[t.h3, { fontSize: fs(15) }]}>近 7 天达标情况</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Flame size={14} color={c.primary} />
              <Text style={{ fontSize: fs(12), color: c.primaryDark, fontWeight: '500' }}>
                达标 {achievedDays} / 7 天
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 128, paddingTop: 18 }}>
            {last7Days.map((d, idx) => {
              const barH = Math.max(6, Math.round((d.words / maxDayWords) * 74));
              return (
                <View key={idx} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: fs(10), color: d.words > 0 ? c.textSub : c.textMuted, marginBottom: 4, fontVariant: ['tabular-nums'] }}>
                    {d.words}
                  </Text>
                  <View
                    style={{
                      width: 18,
                      height: barH,
                      borderRadius: 7,
                      backgroundColor: d.achieved ? c.primary : d.words > 0 ? c.primarySoft : c.divider,
                    }}
                  />
                  <Text style={{ fontSize: fs(11), color: d.isToday ? c.primaryDark : c.textSub, fontWeight: d.isToday ? '600' : '400', marginTop: 6 }}>
                    {d.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}
