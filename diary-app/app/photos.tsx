import React, { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Text } from '../src/components/text';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Images, Play } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeProvider';
import { useStore } from '../src/store/store';
import { Chip, EmptyState, NavBar, Photo, Screen } from '../src/components/ui';
import { FadeIn, PressableScale } from '../src/components/motion';
import { PhotoViewer } from '../src/components/PhotoViewer';
import { posterUri } from '../src/services/videoStore';
import { collectMedia } from '../src/utils/video';
import { fmtDuration, fmtMonthDay } from '../src/utils/date';
import { IMAGES } from '../src/data/assets';

/** 影像记忆：只挂载可见媒体，保留照片与来源日记的一一对应。 */
export default function PhotosWallScreen() {
  const { fs, c, r } = useTheme();
  const entries = useStore(s => s.entries);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  const items = useMemo(() => collectMedia(entries), [entries]);
  const [filter, setFilter] = useState<'all' | 'photo' | 'video'>('all');
  const shown = useMemo(() => (filter === 'all' ? items : items.filter(item => item.kind === filter)), [items, filter]);
  const photos = useMemo(() => items.filter(item => item.kind === 'photo' && item.uri), [items]);
  const photoUris = useMemo(() => photos.map(item => item.uri!), [photos]);
  const photoIndex = useMemo(() => new Map(photos.map((item, index) => [item.key, index])), [photos]);
  const videoCount = items.length - photos.length;
  const openEntry = (entryId: string) => router.push({ pathname: '/memory/[id]', params: { id: entryId } });

  return (
    <Screen enter="page" edges={['top', 'bottom']}>
      <NavBar title="影像记忆" subtitle={items.length ? `共 ${photos.length} 张照片${videoCount ? ` · ${videoCount} 段视频` : ''}` : undefined} />
      {items.length === 0 ? <View style={{ flex: 1, justifyContent: 'center' }}>
        <EmptyState illustration="emptyBook" imageSize={170} title="还没有影像记录" desc="在写日记时插入照片或视频，它们会汇集成你的光影记忆墙。" action="去写日记" onAction={() => router.push('/write')} />
      </View> : <FlatList
        key={filter}
        data={shown} numColumns={3} keyExtractor={item => item.key} initialNumToRender={18} maxToRenderPerBatch={12} windowSize={5}
        showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 32 }}
        columnWrapperStyle={{ gap: 6, marginBottom: 6 }}
        ListHeaderComponent={videoCount ? (
          <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 12 }}>
            <Chip size="sm" label="全部" icon={<Images size={12} />} selected={filter === 'all'} onPress={() => setFilter('all')} />
            <Chip size="sm" label="照片" selected={filter === 'photo'} onPress={() => setFilter('photo')} />
            <Chip size="sm" label="视频" icon={<Play size={12} />} selected={filter === 'video'} onPress={() => setFilter('video')} />
          </View>
        ) : null}
        renderItem={({ item, index }) => <FadeIn delay={Math.min(index * 36, 320)} dy={8} duration={300} style={{ width: '32%', aspectRatio: 1 }}><PressableScale
          scaleTo={0.94}
          accessibilityRole="button" accessibilityLabel={`${fmtMonthDay(item.date)}的${item.kind === 'video' ? '视频，打开日记播放' : '照片'}`}
          onPress={() => item.kind === 'video' ? openEntry(item.entryId) : setViewerIdx(photoIndex.get(item.key) ?? null)}
          onLongPress={() => openEntry(item.entryId)}
          style={{ width: '100%', height: '100%', borderRadius: r(10), overflow: 'hidden' }}
        >
          <Photo uri={item.kind === 'video' ? posterUri(item.uri) : item.uri} style={{ width: '100%', height: '100%' }} radius={0} />
          {item.kind === 'video' && <View style={{ position: 'absolute', top: 5, right: 5, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: r(999), backgroundColor: 'rgba(18,16,14,0.68)' }}>
            <Play size={11} color="#fff" fill="#fff" />
            {!!item.video?.duration && <Text style={{ fontSize: fs(11), color: '#fff', fontVariant: ['tabular-nums'] }}>{fmtDuration(item.video.duration)}</Text>}
          </View>}
          <LinearGradient colors={['transparent', 'rgba(18,16,14,0.58)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 7, paddingTop: 18, paddingBottom: 5 }}>
            <Text style={{ fontSize: fs(11.5), color: '#FFFFFF', fontWeight: '500' }} numberOfLines={1}>{fmtMonthDay(item.date)}</Text>
          </LinearGradient>
        </PressableScale></FadeIn>}
        ListFooterComponent={<Text style={{ textAlign: 'center', fontSize: fs(12), color: c.textMuted, marginTop: 18 }}>轻触查看影像，照片中可打开对应日记</Text>}
      />}
      <PhotoViewer photos={photoUris} initialIndex={viewerIdx ?? 0} visible={viewerIdx !== null} onClose={() => setViewerIdx(null)} onOpenEntry={index => {
        const entry = photos[index];
        setViewerIdx(null);
        if (entry) openEntry(entry.entryId);
      }} />
    </Screen>
  );
}
