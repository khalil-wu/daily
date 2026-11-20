import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../src/theme/ThemeProvider';
import { actions, useStore } from '../src/store/store';
import { Button, NavBar, Radio, Screen, goBack, haptic } from '../src/components/ui';
import { useFeedback } from '../src/components/feedback';
import { IMAGES } from '../src/data/assets';
import { fmtDateTime } from '../src/utils/date';

const OPTIONS: { key: 'local' | 'cloud' | 'latest'; title: string; desc: string }[] = [
  { key: 'local', title: '保留本机', desc: '使用当前设备上的版本' },
  { key: 'cloud', title: '保留账号端', desc: '使用账号同步过来的版本' },
  { key: 'latest', title: '合并最近修改', desc: '合并双方的修改，并保留最新的版本' },
];

/** 11. 同步冲突处理（1:1 复刻设计稿3 #11） */
export default function SyncConflictScreen() {
  const { c, t, fs, dark } = useTheme();
  const { toast } = useFeedback();
  const conflicts = useStore(s => s.conflicts);
  const entries = useStore(s => s.entries);
  const [choice, setChoice] = useState<'local' | 'cloud' | 'latest'>('latest');
  const [busy, setBusy] = useState(false);

  const first = conflicts[0];
  const localEntry = first ? entries.find(e => e.id === first.entryId) : undefined;

  const confirmChoice = async () => {
    setBusy(true);
    if (conflicts.length > 0) {
      await actions.resolveConflicts(choice);
    }
    setBusy(false);
    toast('操作成功', { message: '同步冲突已按所选方式处理完成' });
    goBack();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 24 }}>
        <View style={{ alignItems: 'center', marginTop: 6, marginBottom: 20 }}>
          <Image source={IMAGES.syncConflict} style={{ width: 140, height: 140, borderRadius: 24, marginBottom: 12 }} resizeMode="cover" />
          <Text style={[t.h1, { fontSize: fs(21), textAlign: 'center' }]}>检测到同步冲突</Text>
          <Text style={[t.sub, { textAlign: 'center', marginTop: 8 }]}>
            两个账号对同一篇日记有不同的修改，请选择处理方式：
          </Text>
        </View>

        {first && (
          <View style={{ backgroundColor: c.primaryFaint, borderRadius: 14, padding: 14, marginBottom: 18 }}>
            <Text style={{ fontSize: fs(13), color: c.primaryDark, fontWeight: '600' }} numberOfLines={1}>
              冲突日记：{localEntry?.title || first.cloudEntry.title || '无题日记'}
            </Text>
            <Text style={{ fontSize: fs(12), color: c.textSub, marginTop: 4 }}>
              本机修改：{fmtDateTime(first.localUpdatedAt)}
            </Text>
            <Text style={{ fontSize: fs(12), color: c.textSub, marginTop: 2 }}>
              另一账号修改：{fmtDateTime(first.cloudUpdatedAt)}
            </Text>
          </View>
        )}

        <View style={{ gap: 12 }}>
          {OPTIONS.map(opt => {
            const on = choice === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => {
                  haptic('light');
                  setChoice(opt.key);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: on ? c.primaryFaint : c.card,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: on ? 1.5 : StyleSheet.hairlineWidth,
                  borderColor: on ? c.primary : c.divider,
                  shadowColor: c.shadow,
                  shadowOpacity: dark ? 0 : 0.04,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: dark ? 0 : 1,
                }}
              >
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={[t.h3, { fontSize: fs(15.5) }]}>{opt.title}</Text>
                  <Text style={[t.sub, { marginTop: 3 }]}>{opt.desc}</Text>
                </View>
                <Radio checked={on} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 22, paddingBottom: 18, paddingTop: 8 }}>
        <Button title="确认处理" loading={busy} onPress={() => void confirmChoice()} />
      </View>
    </Screen>
  );
}
