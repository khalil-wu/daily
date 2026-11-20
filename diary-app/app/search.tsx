import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Clock, X } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeProvider';
import { actions, useStore } from '../src/store/store';
import { MOODS } from '../src/data/constants';
import type { Entry, MoodKey } from '../src/store/types';
import { personNames } from '../src/utils/people';
import { Chip, EmptyState, Screen, SearchBar, goBack } from '../src/components/ui';
import { EntryListCard } from '../src/components/EntryCard';
import { MoodIcon } from '../src/components/MoodIcon';
import { IMAGES } from '../src/data/assets';
import { plainText } from '../src/utils/text';
import { videoSearchWords } from '../src/utils/video';

const HOT_KEYWORDS = ['成长', '情绪', '旅行', '生活', '工作', '阅读', '自我', '感恩', '视频'];

/** 14 & 设计稿3 #14. 搜索页（最近搜索、热门关键词、结果高亮、无结果空状态） */
export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string; tag?: string; mood?: MoodKey; person?: string }>();
  const { c, fs } = useTheme();
  const entries = useStore(s => s.entries);
  const tags = useStore(s => s.tags);
  const people = useStore(s => s.people);
  const recent = useStore(s => s.recentSearches);

  const [query, setQuery] = useState(params.q ?? '');
  const [filterTag, setFilterTag] = useState<string | null>(params.tag ?? null);
  const [filterMood, setFilterMood] = useState<MoodKey | null>(params.mood ?? null);
  const [filterPerson, setFilterPerson] = useState<string | null>(params.person ?? null);

  const searching = !!(query.trim() || filterTag || filterMood || filterPerson);

  const results = useMemo(() => {
    if (!searching) return [];
    const q = query.trim().toLowerCase();
    return entries
      .filter(e => !e.deletedAt && !e.hidden && e.status === 'published')
      .filter(e => {
        if (filterTag && !e.tags.includes(filterTag)) return false;
        if (filterMood && e.mood !== filterMood) return false;
        if (filterPerson && !e.people.includes(filterPerson)) return false;
        if (!q) return true;
        const tagNames = e.tags.map(id => tags.find(tg => tg.id === id)?.name ?? '').join(' ');
        const peopleNames = e.people
          .map(id => people.find(p => p.id === id))
          .filter(Boolean)
          .flatMap(p => personNames(p!))
          .join(' ');
        const hay = `${e.title} ${plainText(e.body)} ${e.place?.name ?? ''} ${tagNames} ${peopleNames} ${videoSearchWords(e)}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [entries, tags, people, query, filterTag, filterMood, filterPerson, searching]);

  const commitQuery = (q: string) => {
    setQuery(q);
    if (q.trim()) actions.pushSearch(q.trim());
  };

  const renderResult = useCallback(
    ({ item: entry }: { item: Entry }) => (
      <EntryListCard
        entry={entry}
        query={query}
        onPress={() => {
          if (query.trim()) actions.pushSearch(query.trim());
          router.push({ pathname: '/memory/[id]', params: { id: entry.id } });
        }}
      />
    ),
    [query],
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 8 }}>
        <Pressable hitSlop={10} onPress={goBack} style={{ padding: 4 }}>
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
                <Text style={{ fontSize: fs(13.5), color: c.textSub, fontWeight: '500' }}>最近搜索</Text>
                <Pressable onPress={() => actions.clearSearches()}>
                  <Text style={{ fontSize: fs(12.5), color: c.textMuted }}>清空</Text>
                </Pressable>
              </View>
              <View>
                {recent.map((item, idx) => (
                  <Pressable
                    key={item}
                    onPress={() => commitQuery(item)}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: c.divider }}
                  >
                    <Clock size={15} color={c.textMuted} style={{ marginRight: 10 }} />
                    <Text style={{ flex: 1, fontSize: fs(14), color: c.text }}>{item}</Text>
                    <Pressable hitSlop={10} onPress={() => actions.removeSearch(item)}>
                      <X size={15} color={c.textMuted} />
                    </Pressable>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <Text style={{ fontSize: fs(13.5), color: c.textSub, fontWeight: '500', marginBottom: 12 }}>热门关键词</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
            {HOT_KEYWORDS.map(kw => (
              <Chip key={kw} label={kw} onPress={() => commitQuery(kw)} />
            ))}
          </View>

          <Text style={{ fontSize: fs(13.5), color: c.textSub, fontWeight: '500', marginBottom: 12 }}>按心情筛选</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {MOODS.map(m => (
              <Chip key={m.key} label={m.label} icon={<MoodIcon mood={m.key} size={15} />} onPress={() => setFilterMood(m.key)} />
            ))}
          </View>

          {people.length > 0 && (
            <>
              <Text style={{ fontSize: fs(13.5), color: c.textSub, fontWeight: '500', marginTop: 24, marginBottom: 12 }}>按身边人筛选</Text>
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
            image={IMAGES.emptySearch}
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
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 32 }}
          initialNumToRender={12}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== 'web'}
        />
      )}
    </Screen>
  );
}
