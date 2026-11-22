import React, { useMemo } from 'react';
import { FlatList, Platform, View } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '../src/store/store';
import { EmptyState, NavBar, Screen } from '../src/components/ui';
import { EntryListCard } from '../src/components/EntryCard';
import { HiddenAccessBoundary } from '../src/components/HiddenAccessBoundary';
import { IMAGES } from '../src/data/assets';

/** 隐藏日记列表（如已设置应用锁，则需验证后进入） */
export default function HiddenEntriesScreen() {
  return <HiddenAccessBoundary required><HiddenEntriesList /></HiddenAccessBoundary>;
}

function HiddenEntriesList() {
  const entries = useStore(s => s.entries);

  const list = useMemo(
    () => entries.filter(e => !e.deletedAt && e.hidden).sort((a, b) => b.createdAt - a.createdAt),
    [entries],
  );

  return (
    <Screen enter="page" edges={['top', 'bottom']}>
      <NavBar title="隐藏日记" />
      {list.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            illustration="privacyLock"
            imageSize={170}
            title="没有隐藏的日记"
            desc="在日记详情页右上角“···”中可以将私密日记隐藏，保护个人空间。"
          />
        </View>
      ) : (
        <FlatList data={list} keyExtractor={entry => entry.id}
          renderItem={({ item: entry }) => <EntryListCard entry={entry} onPress={() => {
            if (entry.status === 'draft') router.push({ pathname: '/write', params: { id: entry.id } });
            else router.push({ pathname: '/memory/[id]', params: { id: entry.id } });
          }} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 32 }}
          initialNumToRender={10} windowSize={7} removeClippedSubviews={Platform.OS !== 'web'} />
      )}
    </Screen>
  );
}
