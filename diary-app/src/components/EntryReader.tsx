import React from 'react';
import { Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Text } from './text';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react-native';
import { Image as ExpoImage } from 'expo-image';
import { useTheme } from '../theme/ThemeProvider';
import { useStore } from '../store/store';
import { DEFAULT_NOTEBOOK_ID, moodMeta, paperColors, weatherMeta } from '../data/constants';
import { PAPER_IMAGES } from '../data/assets';
import { MoodIcon, WeatherIcon } from './MoodIcon';
import { RichBody } from './RichBody';
import { fmtPostmarkDate, PostcardNote, PostcardTriggerStamp } from './stationery';
import { AudioClipCard } from './AudioPlayer';
import { VideoClipCard } from './VideoPlayer';
import { PhotoLayoutView } from './PhotoLayout';
import { fmtAgo, fmtMonthDay, fmtTime, WEEK_CN } from '../utils/date';
import { toggleTodoAtLine } from '../utils/richtext';
import { wordCount } from '../utils/text';
import { canSendEntry } from '../utils/ai/privacy';
import { startReply, useAIStatus, useReplyJob } from '../services/ai';
import { actions } from '../store/store';
import type { Entry } from '../store/types';

export interface EntryReaderProps {
  entry: Entry;
  prevEntry?: Entry;
  nextEntry?: Entry;
  onOpenViewer: (index: number) => void;
  onTurn: (dir: 'prev' | 'next') => void;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

/**
 * 阅读页正文：先是这一天和当时的心情，然后标题、照片、正文；
 * 地点、天气、日记本、标签这些「档案信息」收到文末，不挡在读之前。翻页时每一页各挂一份。
 */
export const EntryReader = React.memo(function EntryReader({ entry, prevEntry, nextEntry, onOpenViewer, onTurn, onScroll }: EntryReaderProps) {
  const { c, t, fs, contentWidth, r } = useTheme();
  const tags = useStore(s => s.tags);
  const people = useStore(s => s.people);
  const notebooks = useStore(s => s.notebooks);
  const aiStatus = useAIStatus();
  const replyJob = useReplyJob(entry.id);
  const mood = moodMeta(entry.mood);
  const weather = weatherMeta(entry.weather);
  const notebook = notebooks.find(n => n.id === (entry.notebookId || DEFAULT_NOTEBOOK_ID));
  const d = new Date(entry.createdAt);
  const padH = Math.round(28 - contentWidth * 14);
  const words = wordCount(entry.title) + wordCount(entry.body);
  const pcol = paperColors(entry.paper);
  const readMinutes = Math.max(1, Math.ceil(words / 350));
  const sub = pcol?.sub ?? c.textSub;
  const paperBg = React.useMemo(
    () =>
      entry.paper && PAPER_IMAGES[entry.paper] ? (
        <ExpoImage source={PAPER_IMAGES[entry.paper] as any} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={120} pointerEvents="none" />
      ) : null,
    [entry.paper],
  );
  const entryTags = entry.tags.map(id => tags.find(x => x.id === id)).filter((x): x is NonNullable<typeof x> => !!x);
  const entryPeople = entry.people.map(id => people.find(x => x.id === id)).filter((x): x is NonNullable<typeof x> => !!x);

  const canReply = aiStatus === 'ready' && canSendEntry(entry);
  const reply = entry.ai?.reply;
  const showPostcard = !!reply || (canReply && (replyJob.status === 'loading' || replyJob.status === 'error'));
  const showTrigger = !reply && canReply && replyJob.status === 'idle';

  const metaItem = (key: string, icon: React.ReactNode, label: string) => (
    <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%' }}>
      {icon}
      <Text numberOfLines={1} style={{ fontSize: fs(12.5), color: c.textSub, flexShrink: 1 }}>{label}</Text>
    </View>
  );
  const pill = (key: string, label: string, onPress: () => void) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: 32, justifyContent: 'center', paddingHorizontal: 11, borderRadius: r(999), backgroundColor: c.cardAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider, opacity: pressed ? 0.6 : 1 })}
    >
      <Text style={{ fontSize: fs(12.5), color: c.textSub }}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{ paddingHorizontal: padH, paddingTop: 18, paddingBottom: 40 }}
    >
      {/* 信纸内容区：文字配色由底纸决定 */}
      <View style={paperBg ? { borderRadius: r(18), overflow: 'hidden', paddingHorizontal: 20, paddingVertical: 20 } : undefined}>
        {paperBg}
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <Text style={{ fontSize: fs(13), color: sub, fontVariant: ['tabular-nums'] }}>
            {d.getFullYear()}年{fmtMonthDay(entry.createdAt)} {WEEK_CN[d.getDay()]} · {fmtTime(entry.createdAt)}
          </Text>
          {mood && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MoodIcon mood={mood.key} size={18} />
              <Text style={{ fontSize: fs(13), color: sub }}>{mood.label}</Text>
            </View>
          )}
        </View>
        {!!entry.title && (
          <Text accessibilityRole="header" style={[t.readingTitle, { fontSize: fs(26), lineHeight: fs(26) * 1.4, marginTop: 8, color: pcol?.text ?? c.text }]}>{entry.title}</Text>
        )}

        {/* 配图（网格 / 大图 / 轮播排版） */}
        <PhotoLayoutView photos={entry.photos} layout={entry.photoLayout} onPressPhoto={onOpenViewer} />

        {/* 视频：点开就地播放 */}
        {entry.videos.length > 0 && (
          <View style={{ gap: 12, marginTop: 18 }}>
            {entry.videos.map(clip => <VideoClipCard key={clip.id} clip={clip} />)}
          </View>
        )}

        {/* 正文（待办清单支持直接点击切换勾选） */}
        {!!entry.body.trim() && (
          <View style={{ marginTop: entry.photos.length || entry.videos.length ? 22 : 16 }}>
            <RichBody
              body={entry.body}
              colors={pcol ? { text: pcol.text, sub: pcol.sub, muted: pcol.placeholder } : undefined}
              onToggleTodo={lineIdx => {
                actions.updateEntry(entry.id, { body: toggleTodoAtLine(entry.body, lineIdx) });
              }}
            />
          </View>
        )}

        {/* 语音 */}
        {entry.audios.length > 0 && (
          <View style={{ gap: 10, marginTop: 18 }}>
            {entry.audios.map(clip => <AudioClipCard key={clip.id} clip={clip} />)}
          </View>
        )}
      </View>

      {/* 文末档案：在哪、什么天气、哪本日记、和谁、什么标签 */}
      <View style={{ marginTop: 28, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider, gap: 12 }}>
        {(!!entry.place?.name || weather || notebook) && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 8 }}>
            {!!entry.place?.name && metaItem('place', <MapPin size={13} color={c.textMuted} />, entry.place.name)}
            {weather && metaItem('weather', <WeatherIcon weather={weather.key} size={15} />, `${weather.label}${entry.temperature != null ? ` ${entry.temperature}°C` : ''}`)}
            {notebook && metaItem('notebook', <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: notebook.color }} />, notebook.name)}
          </View>
        )}
        {(entryPeople.length > 0 || entryTags.length > 0) && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {entryPeople.map(p => pill(`p_${p.id}`, p.name, () => router.push({ pathname: '/people/[id]', params: { id: p.id } })))}
            {entryTags.map(tg => pill(`t_${tg.id}`, `#${tg.name}`, () => router.push({ pathname: '/search', params: { tag: tg.id } })))}
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <Text style={{ fontSize: fs(12), color: c.textMuted }}>共 {words} 字 · 约 {readMinutes} 分钟读完</Text>
          {showTrigger && <PostcardTriggerStamp onPress={() => void startReply(entry.id)} />}
        </View>
      </View>

      {showPostcard && (
        <PostcardNote
          style={{ marginTop: 16 }}
          salutation="见字如面 · 记得来信"
          meta={reply ? fmtAgo(reply.at) : undefined}
          postmark={fmtPostmarkDate(reply?.at ?? entry.createdAt)}
          body={reply?.text}
          loadingText={replyJob.status === 'loading' ? '记得正在读这篇日记…' : undefined}
          errorText={replyJob.status === 'error' ? replyJob.error : undefined}
          actionLabel={reply ? '重寄一封' : replyJob.status === 'error' ? '再试一次 ›' : undefined}
          actionBusy={replyJob.status === 'loading'}
          actionDisabled={!canReply}
          onAction={canReply ? () => void startReply(entry.id) : undefined}
        />
      )}

      {/* 上一篇 / 下一篇：也可以左右滑动翻页 */}
      {(prevEntry || nextEntry) && (
        <View style={{ flexDirection: 'row', marginTop: 24, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.divider }}>
          <TurnLink dir="prev" entry={prevEntry} onPress={() => onTurn('prev')} />
          <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: c.divider, marginVertical: 12 }} />
          <TurnLink dir="next" entry={nextEntry} onPress={() => onTurn('next')} />
        </View>
      )}
    </ScrollView>
  );
});

function TurnLink({ dir, entry, onPress }: { dir: 'prev' | 'next'; entry?: Entry; onPress: () => void }) {
  const { c, fs } = useTheme();
  if (!entry) return <View style={{ flex: 1 }} />;
  const end = dir === 'next';
  const label = dir === 'prev' ? '上一篇' : '下一篇';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}：${entry.title || fmtMonthDay(entry.createdAt)}`}
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, minWidth: 0, paddingVertical: 14, paddingLeft: end ? 12 : 0, paddingRight: end ? 0 : 12, alignItems: end ? 'flex-end' : 'flex-start', opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        {!end && <ChevronLeft size={13} color={c.textMuted} />}
        <Text style={{ fontSize: fs(11.5), color: c.textMuted }}>{label} · {fmtMonthDay(entry.createdAt)}</Text>
        {end && <ChevronRight size={13} color={c.textMuted} />}
      </View>
      <Text numberOfLines={1} style={{ fontSize: fs(14), color: c.text, fontWeight: '500', marginTop: 4, textAlign: end ? 'right' : 'left' }}>
        {entry.title || '无题日记'}
      </Text>
    </Pressable>
  );
}
