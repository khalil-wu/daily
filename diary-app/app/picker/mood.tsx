import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { getEditorDraft, setEditorMood } from '../../src/store/editorSession';
import { MOODS, MOOD_ORDER } from '../../src/data/constants';
import type { MoodKey } from '../../src/store/types';
import { Button, NavBar, Screen, goBack, haptic } from '../../src/components/ui';
import { MoodIcon } from '../../src/components/MoodIcon';
import { PressableScale } from '../../src/components/motion';

/** 4. 心情选择页（1:1 复刻设计稿2 #4） */
export default function MoodPickerScreen() {
  const { c, t, fs, dark } = useTheme();
  const [selected, setSelected] = useState<MoodKey | undefined>(() => getEditorDraft()?.entry.mood);

  const confirm = () => {
    setEditorMood(selected);
    goBack();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar title="选择心情" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 24 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 }}>
          {MOOD_ORDER.map(key => {
            const m = MOODS.find(x => x.key === key)!;
            const on = selected === key;
            return (
              <PressableScale
                key={key}
                scaleTo={0.96}
                onPress={() => {
                  haptic('light');
                  setSelected(cur => (cur === key ? undefined : key));
                }}
                style={{
                  width: '48%',
                  backgroundColor: on ? c.primaryFaint : c.card,
                  borderRadius: 18,
                  paddingVertical: 20,
                  paddingHorizontal: 14,
                  alignItems: 'center',
                  borderWidth: on ? 1.5 : StyleSheet.hairlineWidth,
                  borderColor: on ? c.primary : c.divider,
                  shadowColor: c.shadow,
                  shadowOpacity: dark ? 0 : 0.05,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: dark ? 0 : 1,
                }}
              >
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: m.soft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <MoodIcon mood={m.key} size={36} />
                </View>
                <Text style={[t.h3, { fontSize: fs(16) }]}>{m.label}</Text>
                <Text style={{ fontSize: fs(12), color: c.textSub, marginTop: 4 }}>{m.desc}</Text>
              </PressableScale>
            );
          })}
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 22, paddingBottom: 18, paddingTop: 8 }}>
        <Button title="确定" onPress={confirm} />
      </View>
    </Screen>
  );
}
