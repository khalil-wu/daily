import React, { useCallback } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { mixHex } from '../theme/palette';
import { Text } from './text';
import { router } from 'expo-router';
import { useTheme } from '../theme/ThemeProvider';
import { useActiveBook, useStore } from '../store/store';

/** 书内页面标题：大标题 + 当前这本书的小字（全部日记时不显示） */
export function ScreenTitle({ title, size = 22 }: { title: string; size?: number }) {
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

/**
 * 书脊：书内每一页左缘都留着这本书的颜色和一道订口阴影，
 * 让人始终知道自己在哪一本书里，而不是掉进了一个普通列表。
 */
export function BookSpine({ notebookId }: { notebookId?: string }) {
  const { c, dark } = useTheme();
  const active = useActiveBook();
  const notebooks = useStore(s => s.notebooks);
  // 写日记时跟着这一篇所属的那本书走，而不是上次打开的那本
  const book = notebookId ? notebooks.find(n => n.id === notebookId) ?? active : active;
  const color = book?.color ?? c.primary;
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 20, flexDirection: 'row' }}>
      <View style={{ width: 5, backgroundColor: mixHex(color, '#000000', dark ? 0.3 : 0.1) }} />
      <LinearGradient colors={[dark ? 'rgba(0,0,0,0.4)' : 'rgba(70,52,24,0.13)', 'rgba(0,0,0,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
    </View>
  );
}
