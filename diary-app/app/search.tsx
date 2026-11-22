import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../src/components/text';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Clock, X } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeProvider';
import { actions, scopeEntries, useStore } from '../src/store/store';
import { MOODS } from '../src/data/constants';
import type { Entry, MoodKey } from '../src/store/types';
import { Chip, EmptyState, Screen, SearchBar, goBack } from '../src/components/ui';
import { EntryListCard } from '../src/components/EntryCard';
import { MoodIcon } from '../src/components/MoodIcon';
import { resolveSearchScope } from '../src/utils/editor';
import { buildSearchIndex, searchEntries } from '../src/utils/search';

const HOT_KEYWORDS = ['成长', '情绪', '旅行', '生活', '工作', '阅读', '自我', '感恩', '视频'];

/** 14 & 设计稿3 #14. 搜索页（最近搜索、热门关键词、结果高亮、无结果空状态） */
export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string; tag?: string; mood?: MoodKey; person?: string; scope?: string }>();
  const { c, fs } = useTheme();
  const allEntries = useStore(s => s.entries);
  const notebooks = useStore(s => s.notebooks);
  const tags = useStore(s => s.tags);
  const people = useStore(s => s.people);
  const recent = useStore(s => s.recentSearches);
  const scopeId = useMemo(() => resolveSearchScope(params.scope, notebooks), [params.scope, notebooks]);
  const scopeName = scopeId ? notebooks.find(n => n.id === scopeId)?.name : undefined;
  const [scopedOnly, setScopedOnly] = useState(true);
  const entries = useMemo(() => scopeEntries(allEntries, scopeId && scopedOnly ? scopeId : null), [allEntries, scopeId, scopedOnly]);

  const [query, setQuery] = useState(params.q ?? '');
  const [filterTag, setFilterTag] = useState<string | null>(params.tag ?? null);
  const [filterMood, setFilterMood] = useState<MoodKey | null>(params.mood ?? null);
  const [filterPerson, setFilterPerson] = useState<string | null>(params.person ?? null);

  const searching = !!(query.trim() || filterTag || filterMood || filterPerson);

  const deferredQuery = useDeferredValue(query);
  const index = useMemo(() => buildSearchIndex(entries, tags, people), [entries, tags, people]);
  const results = useMemo(() => searchEntries(index, deferredQuery, {
    tag: filterTag, mood: filterMood, person: filterPerson,
  }), [index, deferredQuery, filterTag, filterMood, filterPerson]);

  const topUsedTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      if (e.deletedAt || e.hidden || e.status !== 'published') continue;
      for (const tid of e.tags) counts.set(tid, (counts.get(tid) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, count]) => ({ tag: tags.find(x => x.id === id), count }))
      .filter((x): x is { tag: NonNullable<typeof x.tag>; count: number } => !!x.tag);
  }, [entries, tags]);

  const commitQuery = (q: string) => {
    setQuery(q);
    if (q.trim()) actions.pushSearch(q.trim());
  };

  const renderResult = useCallback(
    ({ item: entry }: { item: Entry }) => (
      <EntryListCard
        entry={entry}
        query={deferredQuery.trim()}
        onPress={() => {
          if (query.trim()) actions.pushSearch(query.trim());
          router.push({ pathname: '/memory/[id]', params: { id: entry.id } });
        }}
      />
    ),
    [query, deferredQuery],
  );

  return (
    <Screen enter="page" edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, gap: 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="返回" onPress={goBack} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -8 }}>
          <ChevronLeft size={24} color={c.text} strokeWidth={1.8} />
        </Pressable>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          onSubmit={() => {
            if (query.trim()) actions.pushSearch(query.trim());
          }}
          autoFocus={!params.tag && !params.mood && !params.person}
          style={{ flex: 1 }}
        />
      </View>

      {scopeId && scopeName && (
        <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 8 }}>
          <Chip size="sm" selected={scopedOnly} label={`只搜「${scopeName}」`} onPress={() => setScopedOnly(v => !v)} />
        </View>
      )}

      {(filterTag || filterMood || filterPerson) && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingBottom: 8 }}>
          {filterPerson && (
            <Chip
              size="sm"
              selected
              label={`和：${people.find(x => x.id === filterPerson)?.name ?? filterPerson}`}
              onRemove={() => setFilterPerson(null)}
            />
          )}
          {filterTag && (
            <Chip
              size="sm"
              selected
              label={`标签：${tags.find(x => x.id === filterTag)?.name ?? filterTag}`}
              onRemove={() => setFilterTag(null)}
            />
          )}
          {filterMood && (
            <Chip
              size="sm"
              selected
              label={`心情：${MOODS.find(x => x.key === filterMood)?.label ?? filterMood}`}
              onRemove={() => setFilterMood(null)}
            />
          )}
        </View>
      )}

      {!searching ? (
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}>
          {recent.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: fs(13), color: c.textSub, fontWeight: '600' }}>最近搜索</Text>
                <Pressable onPress={() => actions.clearSearches()}>
                  <Text style={{ fontSize: fs(12.5), color: c.textMuted }}>清空</Text>
                </Pressable>
              </View>
              <View>
                {recent.map((item, idx) => (
                  <View
                    key={item}
                    style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: c.divider }}
                  >
                    <Pressable
                      onPress={() => commitQuery(item)}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingVertical: 10 }}
                    >
                      <Clock size={15} color={c.textMuted} style={{ marginRight: 10 }} />
                      <Text style={{ flex: 1, fontSize: fs(14), color: c.text }}>{item}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`删除搜索记录：${item}`}
                      onPress={() => actions.removeSearch(item)}
                      style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 }}
                    >
                      <X size={15} color={c.textMuted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          )}

          <Text style={{ fontSize: fs(13), color: c.textSub, fontWeight: '600', marginBottom: 12 }}>
            {topUsedTags.length >= 4 ? '常用标签' : '建议关键词'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
            {topUsedTags.map(({ tag, count }) => (
              <Chip key={tag.id} label={`#${tag.name} · ${count}`} onPress={() => setFilterTag(tag.id)} />
            ))}
            {topUsedTags.length < 4 &&
              HOT_KEYWORDS.filter(kw => !topUsedTags.some(item => item.tag.name === kw))
                .slice(0, Math.max(0, 8 - topUsedTags.length))
                .map(kw => <Chip key={kw} label={kw} onPress={() => commitQuery(kw)} />)}
          </View>

          <Text style={{ fontSize: fs(13), color: c.textSub, fontWeight: '600', marginBottom: 12 }}>按心情筛选</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {MOODS.map(m => (
              <Chip key={m.key} label={m.label} icon={<MoodIcon mood={m.key} size={15} />} onPress={() => setFilterMood(m.key)} />
            ))}
          </View>

          {people.length > 0 && (
            <>
              <Text style={{ fontSize: fs(13), color: c.textSub, fontWeight: '600', marginTop: 24, marginBottom: 12 }}>按身边人筛选</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {people.map(p => (
                  <Chip key={p.id} label={p.name} onPress={() => setFilterPerson(p.id)} />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      ) : results.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 40 }}>
          <EmptyState
            illustration="emptySearch"
            imageSize={185}
            title="没有找到相关的日记"
            desc="试试更换关键词，或检查输入是否正确。"
            secondary="清除搜索条件"
            onSecondary={() => {
              setQuery('');
              setFilterTag(null);
              setFilterMood(null);
              setFilterPerson(null);
            }}
          />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          renderItem={renderResult}
          ListHeaderComponent={
            <Text style={{ fontSize: fs(12.5), color: c.textSub, marginBottom: 12 }}>找到 {results.length} 篇相关日记</Text>
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 32 }}
          initialNumToRender={12}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== 'web'}
        />
      )}
    </Screen>
  );
}
