import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from './text';
import { useTheme } from '../theme/ThemeProvider';
import { useStore } from '../store/store';
import { composeDateTime, daysBetween, fmtMonthDay, fmtTime, startOfDay, WEEK_CN } from '../utils/date';
import { Button, Chip, Segmented, haptic } from './ui';
import { CalendarMonth } from './Charts';
import { WheelTimePicker } from './WheelTimePicker';
import { BottomSheet } from './motion';

/**
 * 写作页的「记录时间」面板：真正可以选任意一天、任意时刻（不能晚于此刻）。
 *
 * 组件来源：月历 = 日历页的 CalendarMonth（带每天的心情印记，补记时一眼看出哪天还空着），
 * 时间滚轮 = 提醒时间页的 WheelTimePicker，切换条 = Segmented，快捷项 = Chip。
 */
export function DateTimeSheet({ visible, value, onClose, onConfirm }: { visible: boolean; value: number; onClose: () => void; onConfirm: (ts: number) => void }) {
  const { c, t, fs } = useTheme();
  const entries = useStore(s => s.entries);
  const [mode, setMode] = useState<'date' | 'time'>('date');
  const [day, setDay] = useState(() => startOfDay(value));
  const [hour, setHour] = useState(() => new Date(value).getHours());
  const [minute, setMinute] = useState(() => new Date(value).getMinutes());
  const [view, setView] = useState(() => ({ year: new Date(value).getFullYear(), month: new Date(value).getMonth() }));
  // 快捷项改了时间后，让滚轮重新定位到新的时刻
  const [wheelKey, setWheelKey] = useState(0);

  const apply = (ts: number) => {
    const d = new Date(ts);
    setDay(startOfDay(ts));
    setHour(d.getHours());
    setMinute(d.getMinutes());
    setView({ year: d.getFullYear(), month: d.getMonth() });
    setWheelKey(k => k + 1);
  };

  useEffect(() => {
    if (visible) {
      apply(value);
      setMode('date');
    }
    // 仅在打开时同步一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const now = Date.now();
  const composed = composeDateTime(day, hour, minute, now);
  const clamped = composed !== new Date(day).setHours(hour, minute, 0, 0);
  const picked = new Date(day);
  const inView = picked.getFullYear() === view.year && picked.getMonth() === view.month;
  const ago = daysBetween(composed, now);
  const agoText = ago === 0 ? '今天' : ago === 1 ? '昨天' : ago === 2 ? '前天' : `${ago} 天前`;
  const visibleEntries = useMemo(() => entries.filter(e => !e.hidden), [entries]);

  const quick = [
    { label: '此刻', ts: () => Date.now() },
    { label: '昨晚', ts: () => new Date(startOfDay(Date.now()) - 86400000).setHours(21, 0, 0, 0) },
    { label: '前天', ts: () => new Date(startOfDay(Date.now()) - 2 * 86400000).setHours(hour, minute, 0, 0) },
    { label: '一周前', ts: () => new Date(startOfDay(Date.now()) - 7 * 86400000).setHours(hour, minute, 0, 0) },
  ];

  return (
    <BottomSheet visible={visible} onClose={onClose} title="记录时间" maxHeight={0.9}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 6 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
          <Text style={[t.h1, { fontSize: fs(21) }]}>
            {fmtMonthDay(composed)} {WEEK_CN[new Date(composed).getDay()]} {fmtTime(composed)}
          </Text>
          <Text style={{ fontSize: fs(12.5), color: c.textSub }}>{agoText}</Text>
        </View>
        {clamped && <Text style={{ fontSize: fs(11.5), color: c.textMuted, marginTop: 4 }}>日记不能写在未来，已调整为此刻</Text>}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: 12 }} contentContainerStyle={{ gap: 8 }}>
          {quick.map(q => (
            <Chip
              key={q.label}
              label={q.label}
              onPress={() => {
                haptic('light');
                apply(q.ts());
              }}
            />
          ))}
        </ScrollView>

        <Segmented
          style={{ marginTop: 14, marginBottom: 14 }}
          value={mode}
          onChange={setMode}
          items={[
            { key: 'date', label: '日期' },
            { key: 'time', label: '时间' },
          ]}
        />

        {/* 两种视图共用同一高度，切换时面板不跳动 */}
        <View style={{ minHeight: 280, justifyContent: mode === 'time' ? 'center' : 'flex-start' }}>
        {mode === 'date' ? (
          <CalendarMonth
            year={view.year}
            month={view.month}
            selectedDay={inView ? picked.getDate() : 0}
            entries={visibleEntries}
            maxTs={now}
            onSelectDay={d => {
              haptic('light');
              setDay(startOfDay(new Date(view.year, view.month, d)));
            }}
            onChangeMonth={delta => {
              const d = new Date(view.year, view.month + delta, 1);
              setView({ year: d.getFullYear(), month: d.getMonth() });
            }}
          />
        ) : (
          <WheelTimePicker
            key={wheelKey}
            hour={hour}
            minute={minute}
            onChange={(h, m) => {
              setHour(h);
              setMinute(m);
            }}
          />
        )}
        </View>
      </ScrollView>

      <Button
        title="确定"
        style={{ marginTop: 12 }}
        onPress={() => {
          onConfirm(composed);
          onClose();
        }}
      />
    </BottomSheet>
  );
}
