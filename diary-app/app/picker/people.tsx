import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../src/components/text';
import { Check, Plus, UserRound } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions, useStore } from '../../src/store/store';
import { getEditorDraft, setEditorPeople } from '../../src/store/editorSession';
import { RELATIONS, relationLabel } from '../../src/data/constants';
import type { RelationKey } from '../../src/store/types';
import { Button, Chip, Field, NavBar, Screen, goBack, haptic, webSpaceAction } from '../../src/components/ui';
import { PersonAvatar } from '../../src/components/PersonAvatar';
import { useFeedback } from '../../src/components/feedback';
import { BottomSheet } from '../../src/components/motion';
import { groupPeopleByRelation, summarizePeople } from '../../src/utils/people';

/** 身边人选择页：标记这篇日记里有谁出现 */
export default function PeoplePickerScreen() {
  const { c, t, fs, r } = useTheme();
  const { toast } = useFeedback();
  const people = useStore(s => s.people);
  const entries = useStore(s => s.entries);
  const [selected, setSelected] = useState<string[]>(() => getEditorDraft()?.entry.people ?? []);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState('');
  const [newRelation, setNewRelation] = useState<RelationKey>('friend');

  const toggle = (id: string) => {
    haptic('light');
    setSelected(cur => (cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]));
  };

  const addPerson = () => {
    const created = actions.addPerson(newName, newRelation);
    if (!created) {
      setNameError('请输入名字');
      return;
    }
    setSelected(cur => (cur.includes(created.id) ? cur : [...cur, created.id]));
    setNewName('');
    setCreateOpen(false);
    toast(`已记下「${created.name}」`);
  };

  const confirm = () => {
    setEditorPeople(selected);
    goBack();
  };

  const groups = groupPeopleByRelation(summarizePeople(entries, people));

  return (
    <Screen enter="rise" edges={['top', 'bottom']}>
      <NavBar title="和谁在一起" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24 }}>
        {people.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 30 }}>
            <UserRound size={34} color={c.textMuted} strokeWidth={1.4} />
            <Text style={[t.sub, { marginTop: 12, textAlign: 'center' }]}>
              还没有记录身边的人。{'\n'}记下日记里出现的人，回头就能按人翻看。
            </Text>
          </View>
        )}
        {groups.map(g => (
          <View key={g.relation} style={{ marginBottom: 18 }}>
            <Text style={{ fontSize: fs(13), color: c.textSub, fontWeight: '500', marginBottom: 10 }}>{g.label}</Text>
            <View style={{ gap: 10 }}>
              {g.list.map(({ person }) => {
                const on = selected.includes(person.id);
                return (
                  <Pressable
                    key={person.id}
                    accessibilityRole="checkbox" accessibilityLabel={person.name} accessibilityState={{ checked: on }} aria-checked={on}
                    {...webSpaceAction(() => toggle(person.id))}
                    onPress={() => toggle(person.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: on ? c.primaryFaint : c.card,
                      borderRadius: r(14),
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderWidth: on ? 1.5 : StyleSheet.hairlineWidth,
                      borderColor: on ? c.primary : c.divider,
                    }}
                  >
                    <PersonAvatar person={person} size={34} />
                    <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                      <Text style={{ fontSize: fs(14.5), color: on ? c.primaryDark : c.text, fontWeight: on ? '600' : '400' }} numberOfLines={1}>
                        {person.name}
                      </Text>
                      {!!person.aliases.length && (
                        <Text style={{ fontSize: fs(11.5), color: c.textMuted, marginTop: 1 }} numberOfLines={1}>
                          也叫：{person.aliases.join('、')}
                        </Text>
                      )}
                    </View>
                    {on && <Check size={16} color={c.primaryDark} strokeWidth={2.3} />}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        <Pressable
          accessibilityRole="button" accessibilityLabel="记下一个人"
          onPress={() => { setNameError(''); setCreateOpen(true); }}
          style={{
            marginTop: 4,
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
          <Text style={{ fontSize: fs(14), color: c.textSub }}>记下一个人</Text>
        </Pressable>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingBottom: 18, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider, backgroundColor: c.bg }}>
        {selected.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            <Text style={{ fontSize: fs(12), color: c.textSub }}>和：</Text>
            {selected.map(id => {
              const p = people.find(x => x.id === id);
              return p ? <Chip key={id} size="sm" selected label={p.name} onRemove={() => toggle(id)} /> : null;
            })}
          </View>
        )}
        <Button title="确定" onPress={confirm} />
      </View>

      <BottomSheet visible={createOpen} onClose={() => setCreateOpen(false)} title="记下一个人" keyboard>
        <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
          <Field accessibilityLabel="名字" error={nameError} value={newName} onChangeText={value => { setNewName(value); setNameError(''); }} placeholder="TA 的名字或你对 TA 的称呼" maxLength={12} autoFocus />
          <Text style={{ fontSize: fs(12.5), color: c.textSub, marginBottom: 10 }}>你们的关系</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {RELATIONS.map(r => (
              <Chip key={r.key} label={r.label} selected={newRelation === r.key} onPress={() => setNewRelation(r.key)} />
            ))}
          </View>
        </ScrollView>
        <Button title="记下了" onPress={addPerson} style={{ marginTop: 12 }} />
      </BottomSheet>
    </Screen>
  );
}
