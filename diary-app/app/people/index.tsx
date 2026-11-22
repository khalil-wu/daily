import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '../../src/components/text';
import { router } from 'expo-router';
import { Cake, ChevronRight, Plus, UserRound } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions, useStore } from '../../src/store/store';
import { RELATIONS } from '../../src/data/constants';
import type { RelationKey } from '../../src/store/types';
import { Button, Card, Chip, EmptyState, Field, NavBar, Screen } from '../../src/components/ui';
import { PersonAvatar } from '../../src/components/PersonAvatar';
import { MoodIcon } from '../../src/components/MoodIcon';
import { useFeedback } from '../../src/components/feedback';
import { BottomSheet, FadeIn } from '../../src/components/motion';
import { daysUntilBirthday, groupPeopleByRelation, summarizePeople } from '../../src/utils/people';
import { IMAGES } from '../../src/data/assets';
import { moodMeta } from '../../src/data/constants';

/** 身边人：日记里出现过的每一个人，只存在这台设备上，对方不会收到任何通知 */
export default function PeopleScreen() {
  const { c, fs, r } = useTheme();
  const { toast } = useFeedback();
  const people = useStore(s => s.people);
  const entries = useStore(s => s.entries);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRelation, setNewRelation] = useState<RelationKey>('friend');

  const groups = useMemo(() => groupPeopleByRelation(summarizePeople(entries, people)), [entries, people]);

  const addPerson = () => {
    const created = actions.addPerson(newName, newRelation);
    if (!created) {
      toast('请输入名字', { type: 'warning' });
      return;
    }
    setNewName('');
    setCreateOpen(false);
    toast(`已记下「${created.name}」`);
    router.push({ pathname: '/people/[id]', params: { id: created.id } });
  };

  return (
    <Screen enter="page" edges={['top', 'bottom']}>
      <NavBar
        title="身边人"
        right={
          <Pressable hitSlop={10} onPress={() => setCreateOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Plus size={16} color={c.primaryDark} />
            <Text style={{ fontSize: fs(14), color: c.primaryDark }}>记一个人</Text>
          </Pressable>
        }
      />
      {people.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            illustration="emptyBook"
            imageSize={170}
            title="日记里出现过的人"
            desc="在写日记时标记「和谁在一起」，每个人会在这里有自己的一页，不会打扰到对方。"
            action="记下第一个人"
            onAction={() => setCreateOpen(true)}
          />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
          <FadeIn dy={8}>
            <Text style={{ fontSize: fs(12), color: c.textMuted, marginTop: 4, marginBottom: 14, lineHeight: fs(12) * 1.6 }}>
              只保存在这台设备上，对方不会收到任何通知。
            </Text>
            {groups.map(g => (
              <View key={g.relation} style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: fs(13), color: c.textSub, fontWeight: '500', marginBottom: 10 }}>{g.label}</Text>
                <View style={{ gap: 10 }}>
                  {g.list.map(s => {
                    const bday = daysUntilBirthday(s.person.birthday);
                    const mood = moodMeta(s.topMood);
                    return (
                      <Card
                        key={s.person.id}
                        onPress={() => router.push({ pathname: '/people/[id]', params: { id: s.person.id } })}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}
                      >
                        <PersonAvatar person={s.person} size={44} />
                        <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ fontSize: fs(15.5), color: c.text, fontWeight: '500' }} numberOfLines={1}>{s.person.name}</Text>
                            {bday !== null && bday <= 30 && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: r(999), backgroundColor: c.primaryFaint }}>
                                <Cake size={10} color={c.primaryDark} />
                                <Text style={{ fontSize: fs(10.5), color: c.primaryDark }}>{bday === 0 ? '今天生日' : `${bday} 天后生日`}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={{ fontSize: fs(12), color: c.textSub, marginTop: 3 }} numberOfLines={1}>
                            {s.count > 0
                              ? `${s.count} 篇日记${s.daysSince === 0 ? ' · 今天刚写过' : s.daysSince != null ? ` · ${s.daysSince} 天前写过` : ''}`
                              : '还没有写到 TA'}
                          </Text>
                        </View>
                        {mood && <MoodIcon mood={mood.key} size={16} />}
                        <ChevronRight size={17} color={c.textMuted} style={{ marginLeft: 4 }} />
                      </Card>
                    );
                  })}
                </View>
              </View>
            ))}
          </FadeIn>
        </ScrollView>
      )}

      <BottomSheet visible={createOpen} onClose={() => setCreateOpen(false)} title="记下一个人" keyboard>
        <View style={{ flexShrink: 1, paddingTop: 6 }}>
          <Field icon={UserRound} value={newName} onChangeText={setNewName} placeholder="TA 的名字或你对 TA 的称呼" maxLength={12} autoFocus />
          <Text style={{ fontSize: fs(12.5), color: c.textSub, marginBottom: 10 }}>你们的关系</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {RELATIONS.map(r => (
              <Chip key={r.key} label={r.label} selected={newRelation === r.key} onPress={() => setNewRelation(r.key)} />
            ))}
          </View>
          <Button title="记下了" onPress={addPerson} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
