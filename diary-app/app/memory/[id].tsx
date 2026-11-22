import React, { useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, Share, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Text } from '../../src/components/text';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft, ChevronRight, Copy, Edit3, EyeOff, FileDown, Heart,
  MapPin, MoreHorizontal, Pin, Share2, Trash2, X,
} from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { BookSpine } from '../../src/components/BookScope';
import { actions, scopeEntries, useEntry, useStore } from '../../src/store/store';
import { EntryReader } from '../../src/components/EntryReader';
import { PageTurner, type PageRole, type PageTurnerHandle } from '../../src/components/PageTurner';
import type { Entry } from '../../src/store/types';
import { DEFAULT_NOTEBOOK_ID, moodMeta, moodTint, paperColors, weatherMeta } from '../../src/data/constants';
import { PAPER_IMAGES } from '../../src/data/assets';
import { Image as ExpoImage } from 'expo-image';
import { Chip, EmptyState, IconButton, NavBar, Photo, Screen, goBack, haptic } from '../../src/components/ui';
import { MoodIcon, WeatherIcon } from '../../src/components/MoodIcon';
import { RichBody } from '../../src/components/RichBody';
import { AudioClipCard } from '../../src/components/AudioPlayer';
import { VideoBadge, VideoClipCard } from '../../src/components/VideoPlayer';
import { PhotoViewer } from '../../src/components/PhotoViewer';
import { PhotoLayoutView } from '../../src/components/PhotoLayout';
import { useFeedback } from '../../src/components/feedback';
import { PopDialog } from '../../src/components/motion';
import { fmtAgo, fmtMonthDay, fmtMonthDayTime, fmtTime, WEEK_CN } from '../../src/utils/date';
import { entryToMarkdown, exportTextFile } from '../../src/utils/transfer';
import { clamp, plainText, wordCount } from '../../src/utils/text';
import { toggleTodoAtLine } from '../../src/utils/richtext';
import { entryCover } from '../../src/utils/video';
import { posterUri } from '../../src/services/videoStore';
import { canSendEntry } from '../../src/utils/ai/privacy';
import { startReply, useAIStatus, useReplyJob } from '../../src/services/ai';
import { IMAGES } from '../../src/data/assets';
import { HiddenAccessBoundary } from '../../src/components/HiddenAccessBoundary';

/** 14. 日记详情页（阅读进度 / 待办直接勾选 / 多图排版 / 上一篇下一篇） */
export default function MemoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <HiddenAccessBoundary entryId={id}><MemoryDetailContent /></HiddenAccessBoundary>;
}

function MemoryDetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, t, fs, contentWidth, dark, r, frame } = useTheme();
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
  const readProgress = useRef(new Animated.Value(0)).current;

  const activeNotebook = useStore(s => s.activeNotebook);
  const { prevEntry, nextEntry } = useMemo(() => {
    if (!entry || entry.status !== 'published' || entry.deletedAt || entry.hidden) {
      return { prevEntry: undefined, nextEntry: undefined };
    }
    const visible = entries.filter(e => !e.deletedAt && !e.hidden && e.status === 'published').sort((a, b) => b.createdAt - a.createdAt);
    const scoped = scopeEntries(visible, activeNotebook);
    const list = scoped.some(e => e.id === entry.id) ? scoped : visible;
    const idx = list.findIndex(e => e.id === entry.id);
    if (idx === -1) return { prevEntry: undefined, nextEntry: undefined };
    return {
      prevEntry: idx > 0 ? list[idx - 1] : undefined, // 更新的一篇
      nextEntry: idx < list.length - 1 ? list[idx + 1] : undefined, // 更早的一篇
    };
  }, [entries, entry, activeNotebook]);

  const turner = useRef<PageTurnerHandle>(null);
  const lastDrag = useRef(0);
  const onDragged = React.useCallback(() => { lastDrag.current = Date.now(); }, []);
  const openViewer = React.useCallback((i: number) => {
    if (Date.now() - lastDrag.current > 400) setViewerIdx(i);
  }, []);
  const onScroll = React.useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const scrollable = e.nativeEvent.contentSize.height - e.nativeEvent.layoutMeasurement.height;
    readProgress.setValue(scrollable <= 12 ? (offsetY > 2 ? 1 : 0) : clamp(offsetY / scrollable, 0, 1));
  }, [readProgress]);
  const commitTurn = React.useCallback((dir: 'prev' | 'next') => {
    const target = dir === 'next' ? nextEntry : prevEntry;
    if (!target) return;
    readProgress.setValue(0);
    router.setParams({ id: target.id });
  }, [nextEntry, prevEntry, readProgress]);
  const onTurn = React.useCallback((dir: 'prev' | 'next') => turner.current?.turn(dir), []);
  const renderPage = React.useCallback(
    (e: Entry, role: PageRole) => (
      <EntryReader
        entry={e}
        prevEntry={role === 'cur' ? prevEntry : undefined}
        nextEntry={role === 'cur' ? nextEntry : undefined}
        onOpenViewer={openViewer}
        onTurn={onTurn}
        onScroll={role === 'cur' ? onScroll : undefined}
      />
    ),
    [prevEntry, nextEntry, onTurn, onScroll, openViewer],
  );

  const paperBg = React.useMemo(
    () =>
      entry?.paper && PAPER_IMAGES[entry.paper] ? (
        <ExpoImage source={PAPER_IMAGES[entry.paper] as any} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={120} pointerEvents="none" />
      ) : null,
    [entry?.paper],
  );

  if (!entry) {
    return (
      <Screen edges={['top']}>
        <NavBar title="日记详情" />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState illustration="emptyBook" title="找不到这篇日记" desc="它可能已被删除或移动。" action="返回" onAction={goBack} />
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
  const pcol = paperColors(entry.paper);
  const readMinutes = Math.max(1, Math.ceil(words / 350));
  // 分享卡配图：有照片用照片，只有视频时用视频封面
  const shareCover = entryCover(entry);

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
    <Screen edges={['top', 'bottom']} enter="page" overlay={<BookSpine />}>
      <NavBar
        right={<IconButton icon={MoreHorizontal} label="更多" onPress={openMore} />}
      />

      {/* 顶部线性阅读进度条 */}
      <View style={{ height: 2, backgroundColor: c.divider, width: '100%' }}>
        <Animated.View style={{ height: '100%', width: readProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), backgroundColor: c.primary }} />
      </View>

      <PageTurner
        ref={turner}
        prev={prevEntry}
        cur={entry}
        next={nextEntry}
        onCommit={commitTurn}
        onDragged={onDragged}
        renderPage={renderPage}
      />

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
        <Pressable accessibilityRole="button" accessibilityLabel="分享" onPress={() => setShareOpen(true)} style={{ minHeight: 44, minWidth: 56, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 18 }}>
          <Share2 size={19} color={c.textSub} strokeWidth={1.8} />
          <Text style={{ fontSize: fs(11), color: c.textSub }}>分享</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={entry.favorite ? '取消收藏' : '收藏'}
          onPress={() => {
            haptic('light');
            const next = actions.toggleFavorite(entry.id);
            toast(next ? '已添加到我的收藏' : '已取消收藏');
          }}
          style={{ minHeight: 44, minWidth: 56, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 18 }}
        >
          <Heart size={19} color={entry.favorite ? c.danger : c.textSub} fill={entry.favorite ? c.danger : 'none'} strokeWidth={1.8} />
          <Text style={{ fontSize: fs(11), color: entry.favorite ? c.danger : c.textSub }}>
            {entry.favorite ? '已收藏' : '收藏'}
          </Text>
        </Pressable>

        <Pressable accessibilityRole="button" accessibilityLabel="编辑" onPress={() => router.push({ pathname: '/write', params: { id: entry.id } })} style={{ minHeight: 44, minWidth: 56, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 18 }}>
          <Edit3 size={19} color={c.textSub} strokeWidth={1.8} />
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
        style={{ backgroundColor: c.bg, borderRadius: r(24), padding: 20, borderWidth: 1, borderColor: c.primarySoft }}
      >
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={[t.h3, { fontSize: fs(15) }]}>日签分享卡</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="关闭分享卡片" hitSlop={10} onPress={() => setShareOpen(false)} style={{ minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' }}>
                <X size={18} color={c.textMuted} />
              </Pressable>
            </View>

            <View style={{ backgroundColor: c.card, borderRadius: r(18), padding: 18, ...frame }}>
              {/* 杂志日签日期头 */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                  <Text style={[t.h1, { fontSize: fs(32), lineHeight: fs(34), fontVariant: ['tabular-nums'] }]}>{d.getDate()}</Text>
                  <View style={{ paddingBottom: 2 }}>
                    <Text style={{ fontSize: fs(11.5), color: c.textSub, fontWeight: '500' }}>
                      {d.getFullYear()}年{d.getMonth() + 1}月 · {WEEK_CN[d.getDay()]}
                    </Text>
                    <Text style={{ fontSize: fs(11), color: c.textMuted, marginTop: 1 }}>{fmtTime(entry.createdAt)}</Text>
                  </View>
                </View>
                {mood && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: r(999), backgroundColor: moodTint(mood, dark) }}>
                    <MoodIcon mood={mood.key} size={13} />
                    <Text style={{ fontSize: fs(11), color: c.text }}>{mood.label}</Text>
                  </View>
                )}
              </View>

              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.divider, marginVertical: 12 }} />

              {!!shareCover.uri && (
                <View style={{ marginBottom: 12 }}>
                  <Photo uri={shareCover.isVideo ? posterUri(shareCover.uri) : shareCover.uri} style={{ width: '100%', aspectRatio: 1.5 }} radius={r(12)} />
                  {shareCover.isVideo && <VideoBadge duration={entry.videos[0]?.duration} style={{ position: 'absolute', right: 8, bottom: 8 }} />}
                </View>
              )}

              {!!entry.title && (
                <Text style={[t.readingTitle, { fontSize: fs(17), lineHeight: fs(26), marginBottom: 8 }]}>{entry.title}</Text>
              )}
              <Text style={[t.bodySerif, { fontSize: fs(13.5), lineHeight: fs(13.5) * 1.75 }]} numberOfLines={6}>
                {plainText(entry.body)}
              </Text>

              <View style={{ marginTop: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
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
                style={{ flex: 1, minHeight: 44, borderRadius: r(999), backgroundColor: c.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Copy size={15} color={c.textOnPrimary} />
                <Text style={{ fontSize: fs(13.5), color: c.textOnPrimary, fontWeight: '600' }}>{Platform.OS === 'web' ? '复制全文' : '分享文字'}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShareOpen(false);
                  void exportShareMd();
                }}
                style={{ flex: 1, minHeight: 44, borderRadius: r(999), backgroundColor: c.card, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
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
