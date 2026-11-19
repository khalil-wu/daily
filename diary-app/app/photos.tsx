import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Play } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeProvider';
import { useStore } from '../src/store/store';
import { EmptyState, NavBar, Photo, Screen } from '../src/components/ui';
import { PhotoViewer } from '../src/components/PhotoViewer';
import { posterUri } from '../src/services/videoStore';
import { collectMedia } from '../src/utils/video';
import { fmtDuration, fmtMonthDay } from '../src/utils/date';
import { IMAGES } from '../src/data/assets';

/** 影像记忆 / 照片与视频墙 */
export default function PhotosWallScreen() {
  const { fs, c } = useTheme();
  const entries = useStore(s => s.entries);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);

  const items = useMemo(() => collectMedia(entries), [entries]);
  const photoUris = useMemo(() => items.filter(i => i.kind === 'photo' && i.uri).map(i => i.uri!), [items]);
  const photoCount = useMemo(() => items.filter(i => i.kind === 'photo').length, [items]);
  const videoCount = items.length - photoCount;

  const openItem = (idx: number) => {
    const it = items[idx];
    if (it.kind === 'video') {
      // 视频到日记详情页里播放（播放器挂在详情页，避免在这里预载解码器）
      router.push({ pathname: '/memory/[id]', params: { id: it.entryId } });
    } else {
      const photoIdx = photoUris.indexOf(it.uri!);
      if (photoIdx >= 0) setViewerIdx(photoIdx);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar
        title="影像记忆"
        subtitle={items.length ? `共 ${photoCount} 张照片${videoCount ? ` · ${videoCount} 段视频` : ''}` : undefined}
      />

      {items.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            image={IMAGES.emptyBook}
            imageSize={170}
            title="还没有影像记录"
            desc="在写日记时插入照片或视频，它们会汇集成你的光影记忆墙。"
            action="去写日记"
            onAction={() => router.push('/write')}
          />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 32 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {items.map((it, idx) => (
              <Pressable
                key={it.key}
                onPress={() => openItem(idx)}
                onLongPress={() => router.push({ pathname: '/memory/[id]', params: { id: it.entryId } })}
                style={{ width: '32%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden' }}
              >
                <Photo uri={it.kind === 'video' ? posterUri(it.uri) : it.uri} style={{ width: '100%', height: '100%' }} radius={0} />
                {it.kind === 'video' && (
                  <View style={{ position: 'absolute', top: 5, right: 5, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 999, backgroundColor: 'rgba(28,24,20,0.55)' }}>
                    <Play size={9} color="#fff" fill="#fff" />
                    {!!it.video?.duration && <Text style={{ fontSize: fs(9), color: '#fff', fontVariant: ['tabular-nums'] }}>{fmtDuration(it.video.duration)}</Text>}
                  </View>
                )}
                <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: 'rgba(28,24,20,0.38)' }}>
                  <Text style={{ fontSize: fs(10), color: '#fff' }} numberOfLines={1}>{fmtMonthDay(it.date)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
          <Text style={{ textAlign: 'center', fontSize: fs(12), color: c.textMuted, marginTop: 18 }}>
            轻触查看，长按跳转到对应日记
          </Text>
        </ScrollView>
      )}

      <PhotoViewer photos={photoUris} initialIndex={viewerIdx ?? 0} visible={viewerIdx !== null} onClose={() => setViewerIdx(null)} />
    </Screen>
  );
}
