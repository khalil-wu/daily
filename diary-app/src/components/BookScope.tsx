import React, { useCallback } from 'react';
import { View } from 'react-native';
import { Text } from './text';
import { router } from 'expo-router';
import { useTheme } from '../theme/ThemeProvider';
import { useActiveBook, useStore } from '../store/store';

/** 书内页面标题：大标题 + 当前这本书的小字（全部日记时不显示） */
export function ScreenTitle({ title, size = 26 }: { title: string; size?: number }) {
  const { c, t, fs } = useTheme();
  const book = useActiveBook();
  return (
    <View style={{ flexShrink: 1, minWidth: 0 }}>
      <Text style={[t.h1, { fontSize: fs(size) }]} numberOfLines={1}>{title}</Text>
      {book && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: book.color }} />
          <Text style={{ fontSize: fs(11), color: c.textSub }} numberOfLines={1}>{book.name}</Text>
        </View>
      )}
    </View>
  );
}

/** 合上书回到书架；没有历史（深链/刷新直接进入书内）时直接替换为书架 */
export function leaveBook() {
  if (router.canGoBack()) router.back();
  else router.replace('/shelf');
}

/** 书内搜索：从某本书里进入时默认只搜这一本 */
export function useOpenSearch() {
  const activeNotebook = useStore(s => s.activeNotebook);
  return useCallback(() => {
    if (activeNotebook) router.push({ pathname: '/search', params: { scope: activeNotebook } });
    else router.push('/search');
  }, [activeNotebook]);
}
