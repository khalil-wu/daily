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
import { PressableScale } from '../../src/components/motion';

/** 4. 心情选择页 */
export default function MoodPickerScreen() {
  const { c, t, fs, dark, look, r, ink, frame, frameInk } = useTheme();
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
                  ...(ink.on
                    ? on ? frameInk : frame
                    : {
                        borderWidth: on ? 1.5 : look.flat ? 1 : StyleSheet.hairlineWidth,
                        borderColor: on ? c.primary : look.flat ? c.border : c.divider,
                        shadowColor: c.shadow,
                        shadowOpacity: dark || look.flat ? 0 : 0.05,
                        shadowRadius: 10,
                        shadowOffset: { width: 0, height: 2 },
                        elevation: dark || look.flat ? 0 : 1,
                      }),
                }}
              >
                {ink.on && on && (
                  <View style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: c.primary, borderWidth: 1.25, borderColor: ink.line, alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={13} color="#182326" strokeWidth={3} />
                  </View>
                )}
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: moodTint(m, dark), alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
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
