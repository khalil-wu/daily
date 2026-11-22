import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Text } from '../../src/components/text';
import { useTheme } from '../../src/theme/ThemeProvider';
import { getEditorDraft, setEditorMood } from '../../src/store/editorSession';
import { MOODS, MOOD_ORDER, moodTint } from '../../src/data/constants';
import type { MoodKey } from '../../src/store/types';
import { Button, NavBar, Screen, goBack, haptic, webSpaceAction } from '../../src/components/ui';
import { MoodIcon } from '../../src/components/MoodIcon';
import { Jelly, PressableScale } from '../../src/components/motion';

/** 4. 心情选择页 */
export default function MoodPickerScreen() {
  const { c, t, fs, dark, r } = useTheme();
  const [selected, setSelected] = useState<MoodKey | undefined>(() => getEditorDraft()?.entry.mood);

  const toggleMood = (key: MoodKey) => {
    haptic('light');
    setSelected(cur => cur === key ? undefined : key);
  };

  const confirm = () => {
    setEditorMood(selected);
    goBack();
  };

  return (
    <Screen enter="rise" edges={['top', 'bottom']}>
      <NavBar title="选择心情" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 24 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 }}>
          {MOOD_ORDER.map(key => {
            const m = MOODS.find(x => x.key === key)!;
            const on = selected === key;
            return (
              <PressableScale
                key={key}
                accessibilityRole="radio" accessibilityLabel={`${m.label}，${m.desc}`} accessibilityState={{ checked: on }} aria-checked={on}
                scaleTo={0.96}
                {...webSpaceAction(() => toggleMood(key))}
                onPress={() => toggleMood(key)}
                style={{
                  width: '48%',
                  backgroundColor: on ? c.primaryFaint : c.card,
                  borderRadius: r(18),
                  paddingVertical: 16,
                  paddingHorizontal: 14,
                  alignItems: 'center',
                  borderWidth: on ? 1.5 : StyleSheet.hairlineWidth,
                  borderColor: on ? c.primary : c.divider,
                }}
              >
                {on && (
                  <View style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={12} color={c.textOnPrimary} strokeWidth={3} />
                  </View>
                )}
                <Jelly active={on} style={{ marginBottom: 10 }}>
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: moodTint(m, dark), alignItems: 'center', justifyContent: 'center' }}>
                    <MoodIcon mood={m.key} size={36} />
                  </View>
                </Jelly>
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
