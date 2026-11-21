import React, { useMemo, useRef, useState } from 'react';
import {
  Platform, Pressable, ScrollView, Share, StyleSheet, Text, View,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft, ChevronRight, Copy, Edit3, EyeOff, FileDown, Heart,
  MapPin, MoreHorizontal, Pin, Share2, Sparkles, Star, Trash2, X,
} from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions, useEntry, useStore } from '../../src/store/store';
import { DEFAULT_NOTEBOOK_ID, moodMeta, weatherMeta } from '../../src/data/constants';
import { Chip, EmptyState, IconButton, NavBar, Photo, Screen, goBack, haptic } from '../../src/components/ui';
import { MoodIcon, WeatherIcon } from '../../src/components/MoodIcon';
import { RichBody } from '../../src/components/RichBody';
import { AudioClipCard } from '../../src/components/AudioPlayer';
import { VideoBadge, VideoClipCard } from '../../src/components/VideoPlayer';
import { PhotoViewer } from '../../src/components/PhotoViewer';
import { PhotoLayoutView } from '../../src/components/PhotoLayout';
import { useFeedback } from '../../src/components/feedback';
import { PopDialog } from '../../src/components/motion';
import { fmtAgo, fmtMonthDay, fmtMonthDayTime, WEEK_CN } from '../../src/utils/date';
import { entryToMarkdown, exportTextFile } from '../../src/utils/transfer';
import { clamp, plainText, wordCount } from '../../src/utils/text';
import { toggleTodoAtLine } from '../../src/utils/richtext';
import { entryCover } from '../../src/utils/video';
import { posterUri } from '../../src/services/videoStore';
import { canSendEntry } from '../../src/utils/ai/privacy';
import { startReply, useAIStatus, useReplyJob } from '../../src/services/ai';
import { IMAGES } from '../../src/data/assets';

/** 14. 日记详情页（阅读进度 / 待办直接勾选 / 多图排版 / 上一篇下一篇） */
export default function MemoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, t, fs, contentWidth, dark } = useTheme();
  const { toast, confirm, sheet } = useFeedback();
  const entry = useEntry(id);
  const entries = useStore(s => s.entries);
  const tags = useStore(s => s.tags);
  const people = useStore(s => s.people);
  const notebooks = useStore(s => s.notebooks);
  const aiStatus = useAIStatus();
  const replyJob = useReplyJob(id);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [readProgress, setReadProgress] = useState(0);
  const scrollMeta = useRef({ viewportH: 0, contentH: 0 });

  const { prevEntry, nextEntry } = useMemo(() => {
    if (!entry || entry.status !== 'published' || entry.deletedAt || entry.hidden) {
      return { prevEntry: undefined, nextEntry: undefined };
    }
    const published = entries
      .filter(e => !e.deletedAt && !e.hidden && e.status === 'published')
      .sort((a, b) => b.createdAt - a.createdAt);
    const idx = published.findIndex(e => e.id === entry.id);
    if (idx === -1) return { prevEntry: undefined, nextEntry: undefined };
    return {
      prevEntry: idx > 0 ? published[idx - 1] : undefined, // 更新的一篇
      nextEntry: idx < published.length - 1 ? published[idx + 1] : undefined, // 更早的一篇
    };
  }, [entries, entry]);

  if (!entry) {
    return (
      <Screen edges={['top']}>
        <NavBar title="日记详情" />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState image={IMAGES.emptyBook} title="找不到这篇日记" desc="它可能已被删除或移动。" action="返回" onAction={goBack} />
        </View>
      </Screen>
    );
  }

  const mood = moodMeta(entry.mood);
  const weather = weatherMeta(entry.weather);
  const notebook = notebooks.find(n => n.id === (entry.notebookId || DEFAULT_NOTEBOOK_ID));
  const d = new Date(entry.createdAt);
  const padH = Math.round(28 - contentWidth * 14);
  const words = wordCount(entry.title) + wordCount(entry.body);
  const readMinutes = Math.max(1, Math.ceil(words / 350));
  // 分享卡配图：有照片用照片，只有视频时用视频封面
  const shareCover = entryCover(entry);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const viewportH = e.nativeEvent.layoutMeasurement.height;
    const contentH = e.nativeEvent.contentSize.height;
    const scrollable = contentH - viewportH;
    if (scrollable <= 12) {
      setReadProgress(offsetY > 2 ? 1 : 0);
    } else {
      setReadProgress(clamp(offsetY / scrollable, 0, 1));
    }
  };

  const copyShareText = async () => {
    const text = `${entry.title ? `${entry.title}\n` : ''}${fmtMonthDayTime(entry.createdAt)}\n\n${plainText(entry.body)}`;
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(text);
        toast('已复制日记内容到剪贴板');
      } catch {
        toast('复制失败，可尝试导出 Markdown', { type: 'warning' });
      }
      return;
    }
    try {
      await Share.share({ title: entry.title || '记得日记', message: text });
    } catch {}
  };

  const exportShareMd = async () => {
    const res = await exportTextFile(`${entry.title || '日记'}.md`, entryToMarkdown(entry, tags), 'text/markdown');
    if (res.ok) toast('已导出 Markdown 文件');
    else toast(res.message || '导出失败', { type: 'error' });
  };

  const openMore = () => {
    sheet([
      {
        label: entry.pinned ? '取消置顶' : '置顶日记',
        icon: Pin,
        onPress: () => {
          const next = actions.togglePinned(entry.id);
          toast(next ? '已置顶到首页' : '已取消置顶');
        },
      },
      {
        label: entry.hidden ? '取消隐藏' : '设为隐藏日记',
        icon: EyeOff,
        onPress: () => {
          const next = actions.toggleHidden(entry.id);
          toast(next ? '已隐藏，可在“隐私与安全”中查看' : '已恢复显示');
          if (next) goBack();
        },
      },
      {
        label: '导出为 Markdown',
        icon: FileDown,
        onPress: async () => {
          const res = await exportTextFile(`${entry.title || '日记'}.md`, entryToMarkdown(entry, tags), 'text/markdown');
          if (res.ok) toast('已导出 Markdown 文件');
          else toast(res.message || '导出失败', { type: 'error' });
        },
      },
      {
        label: '删除日记',
        icon: Trash2,
        destructive: true,
        onPress: async () => {
          const ok = await confirm({
            title: '移入最近删除？',
            message: '删除后可在「最近删除」中保留 30 天，随时恢复。',
            confirmText: '删除',
            destructive: true,
            icon: 'danger',
          });
          if (!ok) return;
          actions.trashEntry(entry.id);
          toast('已移入最近删除');
          goBack();
        },
      },
    ]);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <IconButton icon={Edit3} label="编辑" onPress={() => router.push({ pathname: '/write', params: { id: entry.id } })} />
            <IconButton icon={MoreHorizontal} label="更多" onPress={openMore} />
          </View>
        }
      />

      {/* 顶部线性阅读进度条 */}
      <View style={{ height: 2, backgroundColor: c.divider, width: '100%' }}>
        <View style={{ height: '100%', width: `${Math.round(readProgress * 100)}%`, backgroundColor: c.primary }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        onLayout={e => { scrollMeta.current.viewportH = e.nativeEvent.layout.height; }}
        onContentSizeChange={(_, h) => { scrollMeta.current.contentH = h; }}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: padH, paddingTop: 10, paddingBottom: 32 }}
      >
        {!!entry.title && <Text style={[t.h1, { fontSize: fs(23), lineHeight: fs(23) * 1.4 }]}>{entry.title}</Text>}

        {/* 元信息分两行（设计稿2 #14）：时间 + 日记本 ／ 地点 · 天气 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          <Text style={{ fontSize: fs(12.5), color: c.textSub }}>
            {fmtMonthDayTime(entry.createdAt)} {WEEK_CN[d.getDay()]}
          </Text>
          {notebook && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: c.cardAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: notebook.color }} />
              <Text style={{ fontSize: fs(11), color: c.textSub }}>{notebook.name}</Text>
            </View>
          )}
        </View>
        {(!!entry.place?.name || weather) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {!!entry.place?.name && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 }}>
                <MapPin size={12} color={c.textMuted} />
                <Text numberOfLines={1} style={{ fontSize: fs(12.5), color: c.textSub, flexShrink: 1 }}>{entry.place.name}</Text>
              </View>
            )}
            {!!entry.place?.name && weather && <Text style={{ fontSize: fs(12.5), color: c.textMuted }}>·</Text>}
            {weather && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <WeatherIcon weather={weather.key} size={14} />
                <Text style={{ fontSize: fs(12.5), color: c.textSub }}>
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
                bg={mood.soft}
                color={c.text}
              />
            )}
          </View>
        )}

        {/* 配图（支持网格/大图/轮播排版） */}
        <PhotoLayoutView
          photos={entry.photos}
          layout={entry.photoLayout}
          onPressPhoto={setViewerIdx}
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
              onToggleTodo={lineIdx => {
                actions.updateEntry(entry.id, { body: toggleTodoAtLine(entry.body, lineIdx) });
              }}
            />
          </View>
        )}

        <Text style={{ fontSize: fs(11.5), color: c.textMuted, marginTop: 26 }}>
          共 {words} 字 · 预计阅读 {readMinutes} 分钟
        </Text>

        {/* 「记得」的回信 */}
        {(entry.ai?.reply || (aiStatus === 'ready' && canSendEntry(entry))) && (
          <View style={{ marginTop: 18, backgroundColor: c.primaryFaint, borderRadius: 16, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: c.primarySoft }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Sparkles size={13} color={c.primaryDark} />
                <Text style={{ fontSize: fs(12), color: c.primaryDark, fontWeight: '600' }}>记得的回信</Text>
              </View>
              {entry.ai?.reply && (
                <Text style={{ fontSize: fs(11), color: c.textMuted }}>{fmtAgo(entry.ai.reply.at)}</Text>
              )}
            </View>
            {entry.ai?.reply ? (
              <Text style={{ fontSize: fs(13.5), color: c.text, lineHeight: fs(13.5) * 1.65, marginTop: 10 }}>{entry.ai.reply.text}</Text>
            ) : replyJob.status === 'loading' ? (
              <Text style={{ fontSize: fs(13), color: c.textSub, marginTop: 10 }}>记得正在读这篇日记…</Text>
            ) : replyJob.status === 'error' ? (
              <View style={{ marginTop: 10 }}>
                <Text style={{ fontSize: fs(12.5), color: c.danger }}>{replyJob.error}</Text>
                <Pressable onPress={() => void startReply(entry.id)} style={{ marginTop: 6 }}>
                  <Text style={{ fontSize: fs(12.5), color: c.primaryDark }}>再试一次 ›</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => void startReply(entry.id)} style={{ marginTop: 10 }}>
                <Text style={{ fontSize: fs(13), color: c.primaryDark, fontWeight: '500' }}>请「记得」回一封 ›</Text>
              </Pressable>
            )}
            {entry.ai?.reply && (
              <Pressable
                onPress={() => void startReply(entry.id)}
                disabled={replyJob.status === 'loading'}
                style={{ marginTop: 10, alignSelf: 'flex-start' }}
              >
                <Text style={{ fontSize: fs(12), color: c.textMuted }}>{replyJob.status === 'loading' ? '正在写…' : '再写一封'}</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* 上一篇 / 下一篇 导航卡片 */}
        {(prevEntry || nextEntry) && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 22, gap: 0 }}>
            {prevEntry ? (
              <Pressable
                onPress={() => router.replace({ pathname: '/memory/[id]', params: { id: prevEntry.id } })}
                style={({ pressed }) => ({
                  width: '48.2%',
                  backgroundColor: c.card,
                  borderRadius: 14,
                  padding: 12,
                  borderWidth: dark ? 0 : StyleSheet.hairlineWidth,
                  borderColor: c.divider,
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
                onPress={() => router.replace({ pathname: '/memory/[id]', params: { id: nextEntry.id } })}
                style={({ pressed }) => ({
                  width: '48.2%',
                  backgroundColor: c.card,
                  borderRadius: 14,
                  padding: 12,
                  alignItems: 'flex-end',
                  borderWidth: dark ? 0 : StyleSheet.hairlineWidth,
                  borderColor: c.divider,
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

      {/* 底部操作栏：分享 / 收藏 / 编辑 */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          height: 58,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: c.divider,
          backgroundColor: c.card,
        }}
      >
        <Pressable onPress={() => setShareOpen(true)} style={{ alignItems: 'center', gap: 3, paddingHorizontal: 18 }}>
          <Share2 size={18} color={c.textSub} strokeWidth={1.7} />
          <Text style={{ fontSize: fs(11), color: c.textSub }}>分享</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            haptic('light');
            const next = actions.toggleFavorite(entry.id);
            toast(next ? '已添加到我的收藏' : '已取消收藏');
          }}
          style={{ alignItems: 'center', gap: 3, paddingHorizontal: 18 }}
        >
          {entry.favorite ? (
            <Star size={18} color={c.warning} fill={c.warning} strokeWidth={1.7} />
          ) : (
            <Heart size={18} color={c.textSub} strokeWidth={1.7} />
          )}
          <Text style={{ fontSize: fs(11), color: entry.favorite ? c.primaryDark : c.textSub }}>
            {entry.favorite ? '已收藏' : '收藏'}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.push({ pathname: '/write', params: { id: entry.id } })} style={{ alignItems: 'center', gap: 3, paddingHorizontal: 18 }}>
          <Edit3 size={18} color={c.textSub} strokeWidth={1.7} />
          <Text style={{ fontSize: fs(11), color: c.textSub }}>编辑</Text>
        </Pressable>
      </View>

      <PhotoViewer photos={entry.photos} initialIndex={viewerIdx ?? 0} visible={viewerIdx !== null} onClose={() => setViewerIdx(null)} />

      {/* 手帐级「日签分享卡片」预览弹窗 */}
      <PopDialog
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        maxWidth={356}
        inset={24}
        style={{ backgroundColor: c.bg, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: c.primarySoft }}
      >
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={[t.h3, { fontSize: fs(15) }]}>日签分享卡</Text>
              <Pressable hitSlop={10} onPress={() => setShareOpen(false)}>
                <X size={18} color={c.textMuted} />
              </Pressable>
            </View>

            <View style={{ backgroundColor: c.card, borderRadius: 18, padding: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ fontSize: fs(11.5), color: c.textMuted }}>
                  {fmtMonthDayTime(entry.createdAt)} · {WEEK_CN[d.getDay()]}
                </Text>
                {mood && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: mood.soft }}>
                    <MoodIcon mood={mood.key} size={13} />
                    <Text style={{ fontSize: fs(11), color: '#2F2A26' }}>{mood.label}</Text>
                  </View>
                )}
              </View>

              {!!shareCover.uri && (
                <View style={{ marginBottom: 12 }}>
                  <Photo uri={shareCover.isVideo ? posterUri(shareCover.uri) : shareCover.uri} style={{ width: '100%', aspectRatio: 1.5 }} radius={12} />
                  {shareCover.isVideo && <VideoBadge duration={entry.videos[0]?.duration} style={{ position: 'absolute', right: 8, bottom: 8 }} />}
                </View>
              )}

              {!!entry.title && (
                <Text style={[t.h2, { fontSize: fs(17), marginBottom: 8 }]}>{entry.title}</Text>
              )}
              <Text style={[t.bodySerif, { fontSize: fs(13.5), lineHeight: fs(13.5) * 1.75 }]} numberOfLines={6}>
                {plainText(entry.body)}
              </Text>

              <View style={{ marginTop: 14, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Text numberOfLines={1} style={{ fontSize: fs(11), color: c.primaryDark, letterSpacing: 0.4, flex: 1, minWidth: 0 }}>记得日记 · 记下生活，记得自己</Text>
                {!!entry.place?.name && <Text numberOfLines={1} style={{ fontSize: fs(10.5), color: c.textMuted, flexShrink: 0 }}>{entry.place.name.split('·')[0].trim()}</Text>}
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Pressable
                onPress={() => {
                  setShareOpen(false);
                  void copyShareText();
                }}
                style={{ flex: 1, height: 42, borderRadius: 21, backgroundColor: c.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Copy size={15} color={c.textOnPrimary} />
                <Text style={{ fontSize: fs(13.5), color: c.textOnPrimary, fontWeight: '600' }}>{Platform.OS === 'web' ? '复制全文' : '分享文字'}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShareOpen(false);
                  void exportShareMd();
                }}
                style={{ flex: 1, height: 42, borderRadius: 21, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <FileDown size={15} color={c.textSub} />
                <Text style={{ fontSize: fs(13.5), color: c.textSub }}>导出 MD</Text>
              </Pressable>
            </View>
          </View>
      </PopDialog>
    </Screen>
  );
}
