import { HiddenAccessBoundary } from '../src/components/HiddenAccessBoundary';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, View } from 'react-native';
import { Text } from '../src/components/text';
import { animateNextLayout, CrumpleRow, PressableScale, useReducedMotion } from '../src/components/motion';
import { RotateCcw, Trash2 } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeProvider';
import { TRASH_DAYS, actions, useStore } from '../src/store/store';
import type { Entry } from '../src/store/types';
import { Button, Card, EmptyState, NavBar, Photo, Screen, TextAction } from '../src/components/ui';
import { SwipeRow } from '../src/components/SwipeRow';
import { useFeedback } from '../src/components/feedback';
import { daysBetween, fmtMonthDay } from '../src/utils/date';
import { IMAGES } from '../src/data/assets';

/** 15. 删除确认与回收站（FlatList + 左滑恢复/彻底删除） */
export default function TrashScreen() {
  const hasHidden = useStore(state => state.entries.some(entry => entry.hidden && !!entry.deletedAt));
  return <HiddenAccessBoundary required={hasHidden}><TrashContents /></HiddenAccessBoundary>;
}

function TrashContents() {
  const { c, t, fs, r } = useTheme();
  const { toast, confirm, sheet } = useFeedback();
  const entries = useStore(s => s.entries);
  const reduced = useReducedMotion();
  const [restoringIds, setRestoringIds] = useState<ReadonlySet<string>>(new Set());
  const restoringRef = useRef(new Set<string>());

  const doRestore = useCallback(
    (e: Entry) => {
      restoringRef.current.delete(e.id);
      setRestoringIds(new Set(restoringRef.current));
      animateNextLayout();
      actions.restoreEntry(e.id);
      toast('已恢复日记');
    },
    [toast],
  );

  // 恢复 = 纸团展开：先放展开动画再放回列表，400ms 兜底不丢恢复
  const restoreWithUnfold = useCallback(
    (e: Entry) => {
      if (reduced) {
        doRestore(e);
        return;
      }
      restoringRef.current.add(e.id);
      setRestoringIds(new Set(restoringRef.current));
      setTimeout(() => {
        if (restoringRef.current.has(e.id)) doRestore(e);
      }, 400);
    },
    [reduced, doRestore],
  );

  const list = useMemo(
    () => entries.filter(e => !!e.deletedAt).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)),
    [entries],
  );

  const emptyAll = async () => {
    const ok = await confirm({
      title: '清空回收站？',
      message: '回收站中的所有日记将被永久删除，操作不可撤销。',
      confirmText: '清空',
      destructive: true,
      icon: 'danger',
    });
    if (!ok) return;
    animateNextLayout();
    actions.emptyTrash();
    toast('回收站已清空');
  };

  const confirmDestroy = useCallback(
    async (id: string, title: string) => {
      const ok = await confirm({
        title: '彻底删除？',
        message: `「${title || '无题日记'}」将被永久删除，无法找回。`,
        confirmText: '彻底删除',
        destructive: true,
        icon: 'danger',
      });
      if (!ok) return;
      animateNextLayout();
      actions.destroyEntry(id);
      toast('已彻底删除');
    },
    [confirm, toast],
  );

  const onItemPress = useCallback(
    (id: string, title: string) => {
      sheet(
        [
          {
            label: '恢复这篇日记',
            icon: RotateCcw,
            onPress: () => {
              const entry = entries.find(x => x.id === id);
              if (entry) restoreWithUnfold(entry);
            },
          },
          {
            label: '彻底删除',
            icon: Trash2,
            destructive: true,
            onPress: () => void confirmDestroy(id, title),
          },
        ],
        title || '无题日记',
      );
    },
    [confirmDestroy, entries, restoreWithUnfold, sheet],
  );

  const renderItem = useCallback(
    ({ item: e }: { item: Entry }) => {
      const delAt = e.deletedAt ?? Date.now();
      const remain = Math.max(1, TRASH_DAYS - daysBetween(delAt, Date.now()));
      return (
        <SwipeRow
          style={{ marginBottom: 12 }}
          actions={[
            {
              key: 'restore',
              label: '恢复',
              icon: RotateCcw,
              color: c.primary,
              onPress: () => restoreWithUnfold(e),
            },
            {
              key: 'destroy',
              label: '彻底删除',
              icon: Trash2,
              color: c.danger,
              onPress: () => void confirmDestroy(e.id, e.title),
            },
          ]}
        >
          <CrumpleRow active={restoringIds.has(e.id)} reverse onDone={() => doRestore(e)}>
          <Card
            padded={false}
            style={{ flexDirection: 'row', alignItems: 'center' }}
          >
            <PressableScale
              scaleTo={0.985}
              accessibilityRole="button"
              onPress={() => onItemPress(e.id, e.title)}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14, minWidth: 0 }}
            >
              {e.photos[0] && <Photo uri={e.photos[0]} style={{ width: 54, height: 54, marginRight: 12 }} radius={r(10)} />}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[t.readingTitle, { fontSize: fs(15.5), lineHeight: fs(23) }]} numberOfLines={1}>{e.title || '无题日记'}</Text>
                <Text style={{ fontSize: fs(12), color: c.textSub, marginTop: 4 }}>删除于 {fmtMonthDay(delAt)}</Text>
                <Text style={{ fontSize: fs(11.5), color: c.primaryDark, marginTop: 2 }}>剩余 {remain} 天</Text>
              </View>
            </PressableScale>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`恢复${e.title || '无题日记'}`}
              hitSlop={10}
              onPress={() => {
                animateNextLayout();
                actions.restoreEntry(e.id);
                toast('已恢复日记');
              }}
              style={{ minWidth: 44, minHeight: 44, marginRight: 10, alignItems: 'center', justifyContent: 'center', borderRadius: r(10), backgroundColor: c.primaryFaint }}
            >
              <RotateCcw size={16} color={c.primaryDark} />
            </Pressable>
          </Card>
          </CrumpleRow>
        </SwipeRow>
      );
    },
    [c.danger, c.primary, c.primaryDark, c.primaryFaint, c.textSub, confirmDestroy, doRestore, fs, onItemPress, r, restoringIds, restoreWithUnfold, t.readingTitle, toast],
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar
        title="最近删除"
        right={
          list.length > 0 ? (
            <TextAction
              label="全部恢复"
              onPress={() => {
                animateNextLayout();
                list.forEach(e => actions.restoreEntry(e.id));
                toast(`已恢复 ${list.length} 篇日记`);
              }}
            />
          ) : undefined
        }
      />

      {list.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            illustration="emptyBook"
            imageSize={170}
            title="最近删除为空"
            desc="删除的日记会在这里保留 30 天，方便随时恢复。"
          />
        </View>
      ) : (
        <>
          <FlatList
            data={list}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            ListHeaderComponent={
              <Text style={{ textAlign: 'center', fontSize: fs(12.5), color: c.textSub, paddingVertical: 8, marginBottom: 4 }}>
                已删除的日记会在 {TRASH_DAYS} 天后自动清除（左滑可快速恢复）
              </Text>
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 }}
            initialNumToRender={12}
            windowSize={7}
            removeClippedSubviews={Platform.OS !== 'web'}
          />

          <View style={{ paddingHorizontal: 20, paddingBottom: 18, paddingTop: 6 }}>
            <Button title="清空回收站" variant="secondary" onPress={() => void emptyAll()} />
          </View>
        </>
      )}
    </Screen>
  );
}
