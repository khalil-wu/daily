import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../src/components/text';
import { Check, Plus } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions, useStore } from '../../src/store/store';
import { getEditorDraft, setEditorTags } from '../../src/store/editorSession';
import { TAG_ICONS } from '../../src/data/constants';
import { Button, Chip, Field, NavBar, Screen, goBack, haptic, webSpaceAction } from '../../src/components/ui';
import { getTagIcon } from '../../src/components/MoodIcon';
import { useFeedback } from '../../src/components/feedback';
import { BottomSheet } from '../../src/components/motion';

/** 5. 标签选择页（1:1 复刻设计稿2 #5） */
export default function TagPickerScreen() {
  const { c, t, fs, dark, r } = useTheme();
  const { toast } = useFeedback();
  const tags = useStore(s => s.tags);
  const [selected, setSelected] = useState<string[]>(() => getEditorDraft()?.entry.tags ?? []);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState('');
  const [newIcon, setNewIcon] = useState<string>('Star');

  const toggle = (id: string) => {
    haptic('light');
    setSelected(cur => (cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]));
  };

  const addCustomTag = () => {
    const clean = newName.trim();
    if (!clean) {
      setNameError('请输入标签名称');
      return;
    }
    const created = actions.addTag(clean, newIcon);
    setSelected(cur => (cur.includes(created.id) ? cur : [...cur, created.id]));
    setNewName('');
    setCreateOpen(false);
    toast(`已创建标签「${created.name}」`);
  };

  const confirm = () => {
    setEditorTags(selected);
    goBack();
  };

  return (
    <Screen enter="rise" edges={['top', 'bottom']}>
      <NavBar title="选择标签" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
          {tags.map(tg => {
            const on = selected.includes(tg.id);
            const Icon = getTagIcon(tg.icon);
            return (
              <Pressable
                key={tg.id}
                accessibilityRole="checkbox" accessibilityLabel={tg.name} accessibilityState={{ checked: on }} aria-checked={on}
                {...webSpaceAction(() => toggle(tg.id))}
                onPress={() => toggle(tg.id)}
                style={{
                  width: '48.2%',
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: on ? c.primaryFaint : c.card,
                  borderRadius: r(14),
                  paddingHorizontal: 14,
                  paddingVertical: 14,
                  borderWidth: on ? 1.5 : StyleSheet.hairlineWidth,
                  borderColor: on ? c.primary : c.divider,
                  shadowColor: c.shadow,
                  shadowOpacity: dark ? 0 : 0.04,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: dark ? 0 : 1,
                }}
              >
                <Icon size={18} color={on ? c.primaryDark : c.textSub} strokeWidth={1.7} />
                <Text style={{ flex: 1, marginLeft: 10, fontSize: fs(14.5), color: on ? c.primaryDark : c.text, fontWeight: on ? '600' : '400' }} numberOfLines={1}>
                  {tg.name}
                </Text>
                {on && <Check size={16} color={c.primaryDark} strokeWidth={2.3} />}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button" accessibilityLabel="新建标签"
          onPress={() => { setNameError(''); setCreateOpen(true); }}
          style={{
            marginTop: 16,
            height: 46,
            borderRadius: r(14),
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: c.border,
            backgroundColor: c.cardAlt,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Plus size={16} color={c.textSub} />
          <Text style={{ fontSize: fs(14), color: c.textSub }}>新建标签</Text>
        </Pressable>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingBottom: 18, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider, backgroundColor: c.bg }}>
        {selected.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            <Text style={{ fontSize: fs(12), color: c.textSub }}>已选择 {selected.length} 个标签：</Text>
            {selected.map(id => {
              const tg = tags.find(x => x.id === id);
              return tg ? <Chip key={id} size="sm" selected label={tg.name} onRemove={() => toggle(id)} /> : null;
            })}
          </View>
        )}
        <Button title="确定" onPress={confirm} />
      </View>

      {/* 新建自定义标签弹窗 */}
      <BottomSheet visible={createOpen} onClose={() => setCreateOpen(false)} title="新建标签" keyboard>
          <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
            <Field accessibilityLabel="标签名称" error={nameError} value={newName} onChangeText={value => { setNewName(value); setNameError(''); }} placeholder="输入标签名称（如：摄影、冥想）" maxLength={10} autoFocus />
            <Text style={{ fontSize: fs(12.5), color: c.textSub, marginBottom: 10 }}>选择一个图标</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
              {TAG_ICONS.map(iconName => {
                const Icon = getTagIcon(iconName);
                const on = newIcon === iconName;
                return (
                  <Pressable
                    key={iconName}
                    accessibilityRole="radio" accessibilityLabel={`图标 ${TAG_ICONS.indexOf(iconName) + 1}`} accessibilityState={{ checked: on }} aria-checked={on}
                    {...webSpaceAction(() => setNewIcon(iconName))}
                    onPress={() => setNewIcon(iconName)}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: r(12),
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: on ? c.primary : c.card,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: on ? c.primary : c.divider,
                    }}
                  >
                    <Icon size={18} color={on ? c.textOnPrimary : c.textSub} />
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          <Button title="创建标签" onPress={addCustomTag} style={{ marginTop: 12 }} />
      </BottomSheet>
    </Screen>
  );
}
