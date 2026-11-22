import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Platform, StyleSheet, View } from 'react-native';
import { Text } from '../src/components/text';
import { animateNextLayout } from '../src/components/motion';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeProvider';
import { actions, useStore } from '../src/store/store';
import type { Entry } from '../src/store/types';
import { Button, Card, Checkbox, EmptyState, NavBar, Photo, Screen, TextAction } from '../src/components/ui';
import { useFeedback } from '../src/components/feedback';
import { fmtMonthDayTime } from '../src/utils/date';
import { excerpt } from '../src/utils/text';
import { IMAGES } from '../src/data/assets';

/** 13. 草稿箱（FlatList 虚拟化 + 批量管理） */
export default function DraftsScreen() {
  const { c, t, fs, r } = useTheme();
  const { toast, confirm } = useFeedback();
  const entries = useStore(s => s.entries);
  const [manage, setManage] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const drafts = useMemo(
    () => entries.filter(e => !e.deletedAt && !e.hidden && e.status === 'draft').sort((a, b) => b.updatedAt - a.updatedAt),
    [entries],
  );

  const toggleSelect = useCallback((id: string) => {
    setSelected(cur => (cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]));
  }, []);

  const deleteSelected = async () => {
    if (!selected.length) return;
    const ok = await confirm({
      title: `删除选中的 ${selected.length} 篇草稿？`,
      message: '删除后可在「最近删除」中恢复。',
      confirmText: '删除',
      destructive: true,
      icon: 'danger',
    });
    if (!ok) return;
    animateNextLayout();
    selected.forEach(id => actions.trashEntry(id));
    setSelected([]);
    setManage(false);
    toast('已移入最近删除');
  };

  const renderItem = useCallback(
    ({ item: d }: { item: Entry }) => {
      const checked = selected.includes(d.id);
      return (
        <Card
          onPress={() => {
            if (manage) toggleSelect(d.id);
            else router.push({ pathname: '/write', params: { id: d.id } });
          }}
          style={{ flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 12 }}
        >
          {manage && (
            <View style={{ marginRight: 12 }}>
              <Checkbox checked={checked} onChange={() => toggleSelect(d.id)} />
            </View>
          )}
          {d.photos[0] && (
            <Photo uri={d.photos[0]} style={{ width: 56, height: 56, marginRight: 12 }} radius={r(10)} />
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[t.readingTitle, { fontSize: fs(15.5), lineHeight: fs(23) }]} numberOfLines={1}>{d.title || '无题草稿'}</Text>
            <Text style={[t.sub, { marginTop: 4 }]} numberOfLines={1}>
              {d.body.trim() ? excerpt(d.body, 40) : '继续写下此刻的想法…'}
            </Text>
            <Text style={{ fontSize: fs(11.5), color: c.textMuted, marginTop: 4 }}>{fmtMonthDayTime(d.updatedAt)}</Text>
          </View>
          {!manage && <ChevronRight size={18} color={c.textMuted} />}
        </Card>
      );
    },
    [c.textMuted, fs, manage, r, selected, t.readingTitle, t.sub, toggleSelect],
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar
        title="草稿箱"
        right={
          drafts.length > 0 ? (
            <TextAction
              label={manage ? '完成' : '管理'}
              onPress={() => {
                setManage(v => !v);
                setSelected([]);
              }}
            />
          ) : undefined
        }
      />

      {drafts.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            illustration="emptyBook"
            imageSize={170}
            title="草稿箱里空空的"
            desc="写到一半暂存的日记会出现在这里。"
            action="写一篇日记"
            onAction={() => router.push('/write')}
          />
        </View>
      ) : (
        <>
          <FlatList
            data={drafts}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            ListHeaderComponent={
              <Text style={{ fontSize: fs(13), color: c.textSub, marginBottom: 12 }}>未完成的日记（{drafts.length}）</Text>
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 }}
            initialNumToRender={12}
            windowSize={7}
            removeClippedSubviews={Platform.OS !== 'web'}
          />

          {manage && (
            <View style={{ paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider }}>
              <Button title={`删除选中 (${selected.length})`} variant="danger" disabled={!selected.length} onPress={() => void deleteSelected()} />
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
