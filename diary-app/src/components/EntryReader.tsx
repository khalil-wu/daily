import React from 'react';
import { Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Text } from './text';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react-native';
import { Image as ExpoImage } from 'expo-image';
import { useTheme } from '../theme/ThemeProvider';
import { useStore } from '../store/store';
import { DEFAULT_NOTEBOOK_ID, moodMeta, moodTint, paperColors, weatherMeta } from '../data/constants';
import { PAPER_IMAGES } from '../data/assets';
import { Chip } from './ui';
import { MoodIcon, WeatherIcon } from './MoodIcon';
import { RichBody } from './RichBody';
import { fmtPostmarkDate, PostcardNote, PostcardTriggerStamp } from './stationery';
import { AudioClipCard } from './AudioPlayer';
import { VideoClipCard } from './VideoPlayer';
import { PhotoLayoutView } from './PhotoLayout';
import { fmtAgo, fmtMonthDay, fmtMonthDayTime, WEEK_CN } from '../utils/date';
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

/** 阅读页正文：标题 / 元信息 / 配图 / 正文 / 回信 / 上下篇；翻页时每一页各挂一份 */
export const EntryReader = React.memo(function EntryReader({ entry, prevEntry, nextEntry, onOpenViewer, onTurn, onScroll }: EntryReaderProps) {
  const { c, t, fs, contentWidth, dark, r, frame } = useTheme();
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
  const paperBg = React.useMemo(
    () =>
      entry.paper && PAPER_IMAGES[entry.paper] ? (
        <ExpoImage source={PAPER_IMAGES[entry.paper] as any} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={120} pointerEvents="none" />
      ) : null,
    [entry.paper],
  );
  return (
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: padH, paddingTop: 12, paddingBottom: 32 }}
      >
        {/* 信纸内容区：标题+正文，文字配色由底纸决定 */}
        <View style={paperBg ? { borderRadius: r(18), overflow: 'hidden', paddingHorizontal: 20, paddingVertical: 20 } : undefined}>
          {paperBg}
        {!!entry.title && <Text style={[t.readingTitle, { fontSize: fs(24), lineHeight: fs(24) * 1.42, color: pcol?.text ?? c.text }]}>{entry.title}</Text>}

        {/* 元信息分两行：时间 + 日记本 ／ 地点 · 天气 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          <Text style={{ fontSize: fs(12.5), color: pcol?.sub ?? c.textSub }}>
            {fmtMonthDayTime(entry.createdAt)} {WEEK_CN[d.getDay()]}
          </Text>
          {notebook && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 2, borderRadius: r(999), backgroundColor: c.cardAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: notebook.color }} />
              <Text style={{ fontSize: fs(11), color: pcol?.sub ?? c.textSub }}>{notebook.name}</Text>
            </View>
          )}
        </View>
        {(!!entry.place?.name || weather) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {!!entry.place?.name && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 }}>
                <MapPin size={12} color={c.textMuted} />
                <Text numberOfLines={1} style={{ fontSize: fs(12.5), color: pcol?.sub ?? c.textSub, flexShrink: 1 }}>{entry.place.name}</Text>
              </View>
            )}
            {!!entry.place?.name && weather && <Text style={{ fontSize: fs(12.5), color: pcol?.placeholder ?? c.textMuted }}>·</Text>}
            {weather && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <WeatherIcon weather={weather.key} size={14} />
                <Text style={{ fontSize: fs(12.5), color: pcol?.sub ?? c.textSub }}>
                  {weather.label}{entry.temperature != null ? ` ${entry.temperature}°C` : ''}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* 标签、身边人与心情 */}
        {(entry.tags.length > 0 || entry.people.length > 0 || mood) && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            {entry.people.map(pid => {
              const p = people.find(x => x.id === pid);
              return p ? (
                <Chip
                  key={pid}
                  size="sm"
                  label={p.name}
                  bg={c.cardAlt}
                  color={c.textSub}
                  onPress={() => router.push({ pathname: '/people/[id]', params: { id: p.id } })}
                />
              ) : null;
            })}
            {entry.tags.map(tid => {
              const tg = tags.find(x => x.id === tid);
              return tg ? <Chip key={tid} size="sm" label={tg.name} bg={c.primaryFaint} color={c.primaryDark} /> : null;
            })}
            {mood && (
              <Chip
                size="sm"
                label={mood.label}
                icon={<MoodIcon mood={mood.key} size={14} />}
                bg={moodTint(mood, dark)}
                color={c.text}
              />
            )}
          </View>
        )}

        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.divider, marginTop: 16 }} />

        {/* 配图（支持网格/大图/轮播排版） */}
        <PhotoLayoutView
          photos={entry.photos}
          layout={entry.photoLayout}
          onPressPhoto={onOpenViewer}
        />

        {/* 视频：点开就地播放 */}
        {entry.videos.length > 0 && (
          <View style={{ gap: 12, marginTop: 18 }}>
            {entry.videos.map(clip => (
              <VideoClipCard key={clip.id} clip={clip} />
            ))}
          </View>
        )}

        {/* 语音 */}
        {entry.audios.length > 0 && (
          <View style={{ gap: 10, marginTop: 16 }}>
            {entry.audios.map(clip => (
              <AudioClipCard key={clip.id} clip={clip} />
            ))}
          </View>
        )}

        {/* 正文（待办清单支持直接点击切换勾选） */}
        {!!entry.body.trim() && (
          <View style={{ marginTop: 22 }}>
            <RichBody
              body={entry.body}
              colors={pcol ? { text: pcol.text, sub: pcol.sub, muted: pcol.placeholder } : undefined}
              onToggleTodo={lineIdx => {
                actions.updateEntry(entry.id, { body: toggleTodoAtLine(entry.body, lineIdx) });
              }}
            />
          </View>
        )}

        </View>

        {(() => {
          const canReply = aiStatus === 'ready' && canSendEntry(entry);
          const reply = entry.ai?.reply;
          const showPostcard = !!reply || (canReply && (replyJob.status === 'loading' || replyJob.status === 'error'));
          const showTrigger = !reply && canReply && replyJob.status === 'idle';
          return (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 22 }}>
                <Text style={{ fontSize: fs(11.5), color: c.textMuted }}>
                  共 {words} 字 · 预计阅读 {readMinutes} 分钟
                </Text>
                {showTrigger && <PostcardTriggerStamp onPress={() => void startReply(entry.id)} />}
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
            </>
          );
        })()}

        {/* 上一篇 / 下一篇 导航卡片 */}
        {(prevEntry || nextEntry) && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 22, gap: 0 }}>
            {prevEntry ? (
              <Pressable
                onPress={() => onTurn('prev')}
                style={({ pressed }) => ({
                  width: '48.2%',
                  backgroundColor: c.card,
                  borderRadius: r(14),
                  padding: 13,
                  ...frame,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <ChevronLeft size={13} color={c.textMuted} />
                  <Text style={{ fontSize: fs(11), color: c.textMuted }}>上一篇</Text>
                </View>
                <Text numberOfLines={1} style={{ fontSize: fs(13), color: c.text, fontWeight: '500', marginTop: 4 }}>
                  {prevEntry.title || fmtMonthDay(prevEntry.createdAt)}
                </Text>
              </Pressable>
            ) : (
              <View style={{ width: '48.2%' }} />
            )}

            {nextEntry ? (
              <Pressable
                onPress={() => onTurn('next')}
                style={({ pressed }) => ({
                  width: '48.2%',
                  backgroundColor: c.card,
                  borderRadius: r(14),
                  padding: 13,
                  alignItems: 'flex-end',
                  ...frame,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Text style={{ fontSize: fs(11), color: c.textMuted }}>下一篇</Text>
                  <ChevronRight size={13} color={c.textMuted} />
                </View>
                <Text numberOfLines={1} style={{ fontSize: fs(13), color: c.text, fontWeight: '500', marginTop: 4 }}>
                  {nextEntry.title || fmtMonthDay(nextEntry.createdAt)}
                </Text>
              </Pressable>
            ) : (
              <View style={{ width: '48.2%' }} />
            )}
          </View>
        )}
      </ScrollView>
  );
});
