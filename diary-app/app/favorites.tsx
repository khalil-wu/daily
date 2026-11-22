import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Platform, View } from 'react-native';
import { Text } from '../src/components/text';
import { animateNextLayout } from '../src/components/motion';
import { router } from 'expo-router';
import { Heart, Pin } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeProvider';
import { actions, useStore } from '../src/store/store';
import type { Entry } from '../src/store/types';
import { Card, EmptyState, NavBar, Photo, Screen, Segmented, TextAction, haptic } from '../src/components/ui';
import { useFeedback } from '../src/components/feedback';
import { fmtMonthDayTime } from '../src/utils/date';
import { excerpt } from '../src/utils/text';
import { IMAGES } from '../src/data/assets';

/** 16. 收藏 / 置顶管理页（FlatList 虚拟化） */
export default function FavoritesScreen() {
  const { c, t, fs, r } = useTheme();
  const { toast } = useFeedback();
  const entries = useStore(s => s.entries);
  const [tab, setTab] = useState<'favorite' | 'pinned'>('favorite');
  const [manage, setManage] = useState(false);

  const list = useMemo(
    () =>
      entries
        .filter(e => !e.deletedAt && !e.hidden && (tab === 'favorite' ? e.favorite : e.pinned))
        .sort((a, b) => b.createdAt - a.createdAt),
    [entries, tab],
  );

  const renderItem = useCallback(
    ({ item: e }: { item: Entry }) => (
      <Card
        onPress={() => {
          if (manage) {
            haptic('light');
            if (tab === 'favorite') {
              animateNextLayout();
              actions.toggleFavorite(e.id);
              toast('已取消收藏');
            } else {
              animateNextLayout();
              actions.togglePinned(e.id);
              toast('已取消置顶');
            }
          } else {
            if (e.status === 'draft') router.push({ pathname: '/write', params: { id: e.id } });
            else router.push({ pathname: '/memory/[id]', params: { id: e.id } });
          }
        }}
        style={{ flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 12 }}
      >
        {e.photos[0] && <Photo uri={e.photos[0]} style={{ width: 54, height: 54, marginRight: 12 }} radius={r(10)} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[t.readingTitle, { fontSize: fs(15.5), lineHeight: fs(23) }]} numberOfLines={1}>{e.title || excerpt(e.body, 16) || '无题日记'}</Text>
          <Text style={{ fontSize: fs(12), color: c.textSub, marginTop: 4 }}>{fmtMonthDayTime(e.createdAt)}</Text>
        </View>
        <View style={{ paddingLeft: 10, alignItems: 'center' }}>
          {tab === 'favorite' ? (
            <Heart size={18} color={c.danger} fill={c.danger} />
          ) : (
            <Pin size={18} color={c.primaryDark} fill={c.primaryDark} />
          )}
          {manage && <Text style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>移除</Text>}
        </View>
      </Card>
    ),
    [c.danger, c.primaryDark, c.textMuted, c.textSub, fs, manage, r, t.readingTitle, tab, toast],
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar
        title="我的收藏"
        right={list.length > 0 ? <TextAction label={manage ? '完成' : '管理'} onPress={() => setManage(v => !v)} /> : undefined}
      />

      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <Segmented
          value={tab}
          onChange={setTab}
          items={[
            { key: 'favorite', label: '收藏日记' },
            { key: 'pinned', label: '置顶日记' },
          ]}
        />
      </View>

      {list.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            image={IMAGES.emptyBook}
            imageSize={170}
            title={tab === 'favorite' ? '还没有收藏日记' : '还没有置顶日记'}
            desc={tab === 'favorite' ? '在日记详情页点击底部收藏，珍贵的时刻就会出现在这里。' : '在日记详情页点击右上角“···”可以置顶日记。'}
          />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
          initialNumToRender={12}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== 'web'}
        />
      )}
    </Screen>
  );
}
