import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { Text } from '../../src/components/text';
import { router, useLocalSearchParams } from 'expo-router';
import { Cake, PenLine, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions, useStore } from '../../src/store/store';
import { PERSON_COLORS, RELATIONS, moodMeta, relationLabel } from '../../src/data/constants';
import type { RelationKey } from '../../src/store/types';
import { Button, Chip, EmptyState, Field, IconButton, NavBar, Screen, goBack, webSpaceAction } from '../../src/components/ui';
import { PersonAvatar } from '../../src/components/PersonAvatar';
import { EntryListCard } from '../../src/components/EntryCard';
import { useFeedback } from '../../src/components/feedback';
import { BottomSheet } from '../../src/components/motion';
import { daysUntilBirthday, entriesWithPerson, normalizeBirthday, summarizePerson } from '../../src/utils/people';
import { fmtFullDate } from '../../src/utils/date';
import { IMAGES } from '../../src/data/assets';

/** 身边人的一页：TA 是谁、和 TA 有关的日记时间线 */
export default function PersonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, t, fs, r } = useTheme();
  const { toast, confirm } = useFeedback();
  const people = useStore(s => s.people);
  const entries = useStore(s => s.entries);
  const person = people.find(p => p.id === id);

  const [editOpen, setEditOpen] = useState(false);
  const [fName, setFName] = useState('');
  const [nameError, setNameError] = useState('');
  const [birthdayError, setBirthdayError] = useState('');
  const [fAliases, setFAliases] = useState('');
  const [fRelation, setFRelation] = useState<RelationKey>('other');
  const [fBirthday, setFBirthday] = useState('');
  const [fNote, setFNote] = useState('');
  const [fColor, setFColor] = useState(PERSON_COLORS[0]);

  const summary = useMemo(() => (person ? summarizePerson(entries, person) : null), [entries, person]);
  const list = useMemo(() => (person ? entriesWithPerson(entries, person.id) : []), [entries, person]);

  if (!person || !summary) {
    return (
      <Screen edges={['top', 'bottom']}>
        <NavBar title="身边人" />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState illustration="emptyBook" title="没有找到这个人" desc="TA 可能已被移除。" action="返回" onAction={goBack} />
        </View>
      </Screen>
    );
  }

  const bday = daysUntilBirthday(person.birthday);
  const mood = moodMeta(summary.topMood);

  const openEdit = () => {
    setNameError('');
    setBirthdayError('');
    setFName(person.name);
    setFAliases(person.aliases.join('、'));
    setFRelation(person.relation);
    setFBirthday(person.birthday ?? '');
    setFNote(person.note ?? '');
    setFColor(person.color);
    setEditOpen(true);
  };

  const saveEdit = () => {
    const name = fName.trim();
    if (!name) {
      setNameError('名字不能为空');
      return;
    }
    const birthdayRaw = fBirthday.trim();
    if (birthdayRaw && !normalizeBirthday(birthdayRaw)) {
      setBirthdayError('生日写法不对，试试 3-8 或 12月25日');
      return;
    }
    actions.updatePerson(person.id, {
      name,
      relation: fRelation,
      aliases: fAliases.split(/[、,，;；]/).map(a => a.trim()).filter(Boolean),
      birthday: birthdayRaw ? normalizeBirthday(birthdayRaw) ?? undefined : undefined,
      note: fNote.trim() || undefined,
      color: fColor,
    });
    setEditOpen(false);
    toast('已保存');
  };

  const remove = async () => {
    const ok = await confirm({
      title: `移除「${person.name}」？`,
      message: `和 TA 有关的 ${summary.count} 篇日记都会保留，只是不再关联到这个人。`,
      confirmText: '移除',
      destructive: true,
      icon: 'danger',
    });
    if (!ok) return;
    actions.removePerson(person.id);
    toast(`已移除「${person.name}」，相关日记不受影响`);
    goBack();
  };

  const stats = [
    { label: '写到 TA', val: `${summary.count} 篇` },
    {
      label: '最近一次',
      val: summary.count === 0 ? '—' : summary.daysSince === 0 ? '今天' : `${summary.daysSince} 天前`,
    },
    { label: '常见心情', val: mood?.label ?? '—' },
  ];

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar
        title={person.name}
        right={<IconButton icon={PenLine} label="编辑" onPress={openEdit} />}
      />
      <FlatList data={list} keyExtractor={entry => entry.id}
        renderItem={({ item }) => <EntryListCard entry={item} onPress={() => router.push({ pathname: '/memory/[id]', params: { id: item.id } })} />}
        initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}
        ListHeaderComponent={<>

        {/* 人物卡 */}
        <View style={{ alignItems: 'center', paddingVertical: 18 }}>
          <PersonAvatar person={person} size={76} />
          <Text style={[t.h1, { fontSize: fs(21), marginTop: 12 }]}>{person.name}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <Chip size="sm" label={relationLabel(person.relation)} selected />
            {!!person.aliases.length && <Text style={{ fontSize: fs(12), color: c.textMuted }}>也叫：{person.aliases.join('、')}</Text>}
          </View>
          {bday !== null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: c.primaryFaint }}>
              <Cake size={13} color={c.primaryDark} />
              <Text style={{ fontSize: fs(12), color: c.primaryDark }}>
                {bday === 0 ? '今天是 TA 的生日' : `生日还有 ${bday} 天`}（{person.birthday}）
              </Text>
            </View>
          )}
          {!!person.note && <Text textRole="reading" style={{ fontSize: fs(13), color: c.textSub, marginTop: 10, textAlign: 'center' }}>{person.note}</Text>}
        </View>

        {/* 三个数字 */}
        <View style={{ flexDirection: 'row', backgroundColor: c.card, borderRadius: r(16), paddingVertical: 14, marginBottom: 20 }}>
          {stats.map((s, i) => (
            <View key={s.label} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i ? 0.5 : 0, borderLeftColor: c.divider }}>
              <Text style={{ fontSize: fs(15), color: c.text, fontWeight: '600' }}>{s.val}</Text>
              <Text style={{ fontSize: fs(11), color: c.textMuted, marginTop: 3 }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* 时间线 */}
        <Text style={{ fontSize: fs(13), color: c.textSub, fontWeight: '500', marginBottom: 10 }}>
          和 {person.name} 有关的日记
        </Text>
        </>}
        ListEmptyComponent={
          <View style={{ backgroundColor: c.cardAlt, borderRadius: r(16), padding: 22, alignItems: 'center' }}>
            <Text style={{ fontSize: fs(13), color: c.textSub, textAlign: 'center', lineHeight: fs(13) * 1.7 }}>
              还没有写到 TA。{'\n'}写日记时在「和谁在一起」里标记 {person.name}，那篇日记就会出现在这里。
            </Text>
            <Button title="去写一篇" variant="soft" size="md" full={false} style={{ marginTop: 14, minWidth: 120 }} onPress={() => router.push('/write')} />
          </View>
        }
        ListFooterComponent={<Pressable accessibilityRole="button" onPress={() => void remove()} style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 26, padding: 8 }}>
          <Trash2 size={14} color={c.danger} />
          <Text style={{ fontSize: fs(13), color: c.danger }}>移除这个人（日记保留）</Text>
        </Pressable>}
      />

      {/* 编辑面板 */}
      <BottomSheet visible={editOpen} onClose={() => setEditOpen(false)} title="编辑身边人" keyboard>
        <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
          <Text style={{ fontSize: fs(12.5), color: c.textSub, marginBottom: 6 }}>名字</Text>
          <Field accessibilityLabel="名字" error={nameError} value={fName} onChangeText={value => { setFName(value); setNameError(''); }} maxLength={12} />
          <Text style={{ fontSize: fs(12.5), color: c.textSub, marginBottom: 6 }}>其他叫法（用「、」隔开，日记里出现这些叫法也会认出来）</Text>
          <Field value={fAliases} onChangeText={setFAliases} placeholder="例如：老妈、娘" />
          <Text style={{ fontSize: fs(12.5), color: c.textSub, marginBottom: 10 }}>关系</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {RELATIONS.map(r => (
              <Chip key={r.key} label={r.label} selected={fRelation === r.key} onPress={() => setFRelation(r.key)} />
            ))}
          </View>
          <Text style={{ fontSize: fs(12.5), color: c.textSub, marginBottom: 6 }}>生日（可选，如 3-8）</Text>
          <Field accessibilityLabel="生日" error={birthdayError} value={fBirthday} onChangeText={value => { setFBirthday(value); setBirthdayError(''); }} placeholder="MM-DD" maxLength={10} />
          <Text style={{ fontSize: fs(12.5), color: c.textSub, marginBottom: 6 }}>备注（可选）</Text>
          <Field textRole="reading" value={fNote} onChangeText={setFNote} placeholder="关于 TA 想记住的事" maxLength={60} />
          <Text style={{ fontSize: fs(12.5), color: c.textSub, marginBottom: 10 }}>颜色</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
            {PERSON_COLORS.map((col, index) => (
              <Pressable
                key={col}
                accessibilityRole="radio" accessibilityLabel={`颜色 ${index + 1}`} accessibilityState={{ checked: fColor === col }} aria-checked={fColor === col}
                {...webSpaceAction(() => setFColor(col))}
                onPress={() => setFColor(col)}
                style={{
                  width: 44, height: 44, borderRadius: 22, backgroundColor: col,
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: fColor === col ? 3 : 0, borderColor: c.card,
                }}
              >
                {fColor === col && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#fff' }} />}
              </Pressable>
            ))}
          </View>
        </ScrollView>
        <Button title="保存" onPress={saveEdit} style={{ marginTop: 12 }} />
      </BottomSheet>
    </Screen>
  );
}
